const contactModel = require('../models/contactModel');

const logPrefix = `[API /identify]`;

const handleNoMatches = async (email, phone) => {
    console.log(`${logPrefix} No matches found. Creating new primary contact.`);
    const newContactId = await contactModel.insertPrimaryContact(email, phone);

    return {
        contact: {
            primaryContactId: newContactId,
            emails: email ? [email] : [],
            phoneNumbers: phone ? [phone] : [],
            secondaryContactIds: []
        }
    };
};

const getClusterContacts = async (matchingContacts) => {
    const primaryIds = new Set();
    for (const contact of matchingContacts) {
        if (contact.linkPrecedence === 'primary') {
            primaryIds.add(contact.id);
        } else {
            primaryIds.add(contact.linkedId);
        }
    }

    const clusterContacts = await contactModel.findClusterContactsByPrimaryIds(primaryIds);
    console.log(`${logPrefix} Retrieved ${clusterContacts.length} total contacts belonging to cluster of primary IDs:`, Array.from(primaryIds));
    return clusterContacts;
};

const mergePrimaryContacts = async (clusterContacts) => {
    let allPrimaries = clusterContacts.filter(c => c.linkPrecedence === 'primary');

    if (allPrimaries.length === 0) {
        console.warn(`${logPrefix} Warning: Cluster missing primary contacts. Falling back to treating all cluster contacts as valid candidates.`);
        allPrimaries = clusterContacts;
    }

    allPrimaries.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt) || a.id - b.id);
    const oldestPrimary = allPrimaries[0];
    const targetPrimaryId = oldestPrimary.id;

    console.log(`${logPrefix} Primary ID resolved to: ${targetPrimaryId} (Oldest candidate)`);

    const otherPrimaries = allPrimaries.slice(1);
    if (otherPrimaries.length > 0) {
        console.log(`${logPrefix} Found ${otherPrimaries.length} younger primary contacts to merge into ID ${targetPrimaryId}.`);
    }

    for (const other of otherPrimaries) {
        console.log(`${logPrefix} Converting younger primary (ID: ${other.id}) to secondary linked to ${targetPrimaryId}`);

        await contactModel.updateContactPrecedenceAndLinkedId(other.id, targetPrimaryId);

        other.linkPrecedence = 'secondary';
        other.linkedId = targetPrimaryId;

        await contactModel.updateLinkedIdForSecondaries(other.id, targetPrimaryId);

        clusterContacts.forEach(c => {
            if (c.linkedId === other.id) {
                c.linkedId = targetPrimaryId;
            }
        });
    }

    return targetPrimaryId;
};

const checkAndInsertNewInfo = async (email, phone, clusterContacts, targetPrimaryId) => {
    const hasNewEmail = email && !clusterContacts.some(c => c.email === email);
    const hasNewPhone = phone && !clusterContacts.some(c => c.phoneNumber === phone);

    if (hasNewEmail || hasNewPhone) {
        console.log(`${logPrefix} New distinct information detected. Creating new secondary contact linked to ${targetPrimaryId}.`);
        const newSecondaryId = await contactModel.insertSecondaryContact(email, phone, targetPrimaryId);

        clusterContacts.push({
            id: newSecondaryId,
            email: email,
            phoneNumber: phone,
            linkedId: targetPrimaryId,
            linkPrecedence: 'secondary'
        });
    } else {
        console.log(`${logPrefix} No new distinct email or phone information provided in the request.`);
    }
};

const buildResponse = (clusterContacts, targetPrimaryId) => {
    const emailsSet = new Set();
    const phonesSet = new Set();
    const secondaryContactIds = [];

    const finalPrimary = clusterContacts.find(c => c.id === targetPrimaryId);
    if (finalPrimary) {
        if (finalPrimary.email) emailsSet.add(finalPrimary.email);
        if (finalPrimary.phoneNumber) phonesSet.add(finalPrimary.phoneNumber);
    }

    for (const contact of clusterContacts) {
        if (contact.email) emailsSet.add(contact.email);
        if (contact.phoneNumber) phonesSet.add(contact.phoneNumber);
        if (contact.linkPrecedence === 'secondary') {
            secondaryContactIds.push(contact.id);
        }
    }

    return {
        contact: {
            primaryContactId: targetPrimaryId,
            emails: Array.from(emailsSet),
            phoneNumbers: Array.from(phonesSet),
            secondaryContactIds
        }
    };
};

const identify = async (req, res) => {
    console.log(`${logPrefix} Processing request body:`, JSON.stringify(req.body));

    try {
        const { email, phoneNumber } = req.body;

        if (!email && !phoneNumber) {
            console.warn(`${logPrefix} Request rejected: Missing both email and phoneNumber.`);
            return res.status(400).json({ error: 'Either email or phoneNumber must be provided.' });
        }

        const inputEmail = email || null;
        const inputPhone = phoneNumber ? String(phoneNumber) : null;

        const matchingContacts = await contactModel.findMatchingContacts(inputEmail, inputPhone);
        console.log(`${logPrefix} Found ${matchingContacts.length} matching contacts in the DB.`);

        if (matchingContacts.length === 0) {
            const response = await handleNoMatches(inputEmail, inputPhone);
            console.log(`${logPrefix} Responding with newly created primary contact:`, JSON.stringify(response));
            return res.status(200).json(response);
        }

        const clusterContacts = await getClusterContacts(matchingContacts);
        const targetPrimaryId = await mergePrimaryContacts(clusterContacts);

        await checkAndInsertNewInfo(inputEmail, inputPhone, clusterContacts, targetPrimaryId);

        const response = buildResponse(clusterContacts, targetPrimaryId);

        console.log(`${logPrefix} Request processed successfully. Returning merged cluster view.`);
        return res.status(200).json(response);

    } catch (error) {
        console.error(`${logPrefix} [FATAL ERROR] Exception caught handling /identify:`, error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    identify
};
