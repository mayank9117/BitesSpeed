const pool = require('../db/connection');

const identify = async (req, res) => {
    try {
        const { email, phoneNumber } = req.body;

        // Validation: At least one of email or phoneNumber must be provided
        if (!email && !phoneNumber) {
            return res.status(400).json({ error: 'Either email or phoneNumber must be provided.' });
        }

        // Convert undefined to null for SQL and ensure phoneNumber is a string
        const inputEmail = email || null;
        const inputPhone = phoneNumber ? String(phoneNumber) : null;

        // ==========================================
        // STEP 1: Search existing contacts
        // ==========================================
        // We search for contacts that match *either* the provided email or phone number.
        const [matchingContacts] = await pool.execute(
            `SELECT * FROM Contact WHERE 
       (email = ? AND email IS NOT NULL) OR 
       (phoneNumber = ? AND phoneNumber IS NOT NULL)`,
            [inputEmail, inputPhone]
        );

        // ==========================================
        // STEP 2: If no contact found -> Insert new primary
        // ==========================================
        if (matchingContacts.length === 0) {
            const [result] = await pool.execute(
                `INSERT INTO Contact (email, phoneNumber, linkPrecedence) 
         VALUES (?, ?, 'primary')`,
                [inputEmail, inputPhone]
            );

            const newContactId = result.insertId;

            return res.status(200).json({
                contact: {
                    primaryContactId: newContactId,
                    emails: inputEmail ? [inputEmail] : [],
                    phoneNumbers: inputPhone ? [inputPhone] : [],
                    secondaryContactIds: []
                }
            });
        }

        // ==========================================
        // STEP 3: Contacts found -> Gather all related contacts & merge if needed
        // ==========================================
        // A) Collect all related contacts
        // Find all the primary IDs associated with the matching contacts.
        const primaryIds = new Set();
        for (const contact of matchingContacts) {
            if (contact.linkPrecedence === 'primary') {
                primaryIds.add(contact.id);
            } else {
                primaryIds.add(contact.linkedId);
            }
        }

        // Fetch ALL contacts that belong to these primary IDs to form the entire cluster.
        const placeholders = Array.from(primaryIds).map(() => '?').join(',');
        const queryParams = Array.from(primaryIds).concat(Array.from(primaryIds));
        const [clusterContacts] = await pool.execute(
            `SELECT * FROM Contact WHERE id IN (${placeholders}) OR linkedId IN (${placeholders})`,
            queryParams
        );

        // B) Identify the oldest primary
        let allPrimaries = clusterContacts.filter(c => c.linkPrecedence === 'primary');

        // Safety fallback (in case DB corrupted and only secondaries exist)
        if (allPrimaries.length === 0) {
            allPrimaries = clusterContacts;
        }

        // Sort to find the oldest primary (smallest id / earliest createdAt will be first)
        allPrimaries.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt) || a.id - b.id);
        const oldestPrimary = allPrimaries[0];
        const targetPrimaryId = oldestPrimary.id;

        // C) Convert other primary contacts into secondary
        const otherPrimaries = allPrimaries.slice(1);
        for (const other of otherPrimaries) {
            // Update this alternative primary to be a secondary of the oldest primary
            await pool.execute(
                `UPDATE Contact SET linkPrecedence = 'secondary', linkedId = ?, updatedAt = NOW() WHERE id = ?`,
                [targetPrimaryId, other.id]
            );

            // Keep our working array updated
            other.linkPrecedence = 'secondary';
            other.linkedId = targetPrimaryId;

            // Update any secondaries that were pointing to the old primary to point to the new one
            await pool.execute(
                `UPDATE Contact SET linkedId = ?, updatedAt = NOW() WHERE linkedId = ?`,
                [targetPrimaryId, other.id]
            );

            clusterContacts.forEach(c => {
                if (c.linkedId === other.id) {
                    c.linkedId = targetPrimaryId;
                }
            });
        }

        // ==========================================
        // STEP 4: Check if incoming request contains new info
        // ==========================================
        const hasNewEmail = inputEmail && !clusterContacts.some(c => c.email === inputEmail);
        const hasNewPhone = inputPhone && !clusterContacts.some(c => c.phoneNumber === inputPhone);

        // If there's new email OR new phone, insert a new secondary linked to the target primary.
        // Important: if both matching fields exist anywhere in the cluster, we don't insert a duplicate row.
        if (hasNewEmail || hasNewPhone) {
            const [insertResult] = await pool.execute(
                `INSERT INTO Contact (email, phoneNumber, linkedId, linkPrecedence) 
         VALUES (?, ?, ?, 'secondary')`,
                [inputEmail, inputPhone, targetPrimaryId]
            );

            // Add the newly created contact to our cluster list for final processing
            clusterContacts.push({
                id: insertResult.insertId,
                email: inputEmail,
                phoneNumber: inputPhone,
                linkedId: targetPrimaryId,
                linkPrecedence: 'secondary'
            });
        }

        // ==========================================
        // STEP 5 & 6: Prepare final response
        // ==========================================
        const emailsSet = new Set();
        const phonesSet = new Set();
        const secondaryContactIds = [];

        // Prioritize the primary contact's email/phone in the response array
        const finalPrimary = clusterContacts.find(c => c.id === targetPrimaryId);
        if (finalPrimary) {
            if (finalPrimary.email) emailsSet.add(finalPrimary.email);
            if (finalPrimary.phoneNumber) phonesSet.add(finalPrimary.phoneNumber);
        }

        // Add exactly remaining unique properties and track secondaries
        for (const contact of clusterContacts) {
            if (contact.email) emailsSet.add(contact.email);
            if (contact.phoneNumber) phonesSet.add(contact.phoneNumber);
            if (contact.linkPrecedence === 'secondary') {
                secondaryContactIds.push(contact.id);
            }
        }

        return res.status(200).json({
            contact: {
                primaryContactId: targetPrimaryId,
                emails: Array.from(emailsSet),
                phoneNumbers: Array.from(phonesSet),
                secondaryContactIds
            }
        });

    } catch (error) {
        console.error('Error in /identify:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    identify
};
