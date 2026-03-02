const pool = require('../db/connection');

const findMatchingContacts = async (email, phoneNumber) => {
    console.log(`[DB INFO] Finding matching contacts for Email: ${email}, Phone: ${phoneNumber}`);
    try {
        const [matchingContacts] = await pool.execute(
            `SELECT * FROM Contact WHERE 
             (email = ? AND email IS NOT NULL) OR 
             (phoneNumber = ? AND phoneNumber IS NOT NULL)`,
            [email, phoneNumber]
        );
        return matchingContacts;
    } catch (error) {
        console.error(`[DB ERROR] Error finding matching contacts:`, error);
        throw error;
    }
};

const insertPrimaryContact = async (email, phoneNumber) => {
    console.log(`[DB INFO] Inserting new primary contact: Email: ${email}, Phone: ${phoneNumber}`);
    try {
        const [result] = await pool.execute(
            `INSERT INTO Contact (email, phoneNumber, linkPrecedence) 
             VALUES (?, ?, 'primary')`,
            [email, phoneNumber]
        );
        return result.insertId;
    } catch (error) {
        console.error(`[DB ERROR] Error inserting primary contact:`, error);
        throw error;
    }
};

const findClusterContactsByPrimaryIds = async (primaryIds) => {
    console.log(`[DB INFO] Finding cluster contacts for primary IDs: [${Array.from(primaryIds).join(', ')}]`);
    try {
        const placeholders = Array.from(primaryIds).map(() => '?').join(',');
        const queryParams = Array.from(primaryIds).concat(Array.from(primaryIds));
        const [clusterContacts] = await pool.execute(
            `SELECT * FROM Contact WHERE id IN (${placeholders}) OR linkedId IN (${placeholders})`,
            queryParams
        );
        return clusterContacts;
    } catch (error) {
        console.error(`[DB ERROR] Error finding cluster contacts:`, error);
        throw error;
    }
};

const updateContactPrecedenceAndLinkedId = async (contactId, newLinkedId) => {
    console.log(`[DB INFO] Updating contact ${contactId} to secondary, linked to target primary ${newLinkedId}`);
    try {
        await pool.execute(
            `UPDATE Contact SET linkPrecedence = 'secondary', linkedId = ?, updatedAt = NOW() WHERE id = ?`,
            [newLinkedId, contactId]
        );
    } catch (error) {
        console.error(`[DB ERROR] Error updating contact ${contactId} linkPrecedence:`, error);
        throw error;
    }
};

const updateLinkedIdForSecondaries = async (oldLinkedId, newLinkedId) => {
    console.log(`[DB INFO] Redirecting secondaries from old primary ${oldLinkedId} to new primary ${newLinkedId}`);
    try {
        await pool.execute(
            `UPDATE Contact SET linkedId = ?, updatedAt = NOW() WHERE linkedId = ?`,
            [newLinkedId, oldLinkedId]
        );
    } catch (error) {
        console.error(`[DB ERROR] Error updating secondaries from old primary ${oldLinkedId}:`, error);
        throw error;
    }
};

const insertSecondaryContact = async (email, phoneNumber, linkedId) => {
    console.log(`[DB INFO] Inserting new secondary contact linked to primary ${linkedId}: Email: ${email}, Phone: ${phoneNumber}`);
    try {
        const [result] = await pool.execute(
            `INSERT INTO Contact (email, phoneNumber, linkedId, linkPrecedence) 
             VALUES (?, ?, ?, 'secondary')`,
            [email, phoneNumber, linkedId]
        );
        return result.insertId;
    } catch (error) {
        console.error(`[DB ERROR] Error inserting secondary contact:`, error);
        throw error;
    }
};

module.exports = {
    findMatchingContacts,
    insertPrimaryContact,
    findClusterContactsByPrimaryIds,
    updateContactPrecedenceAndLinkedId,
    updateLinkedIdForSecondaries,
    insertSecondaryContact
};
