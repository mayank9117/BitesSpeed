# Bitespeed Identity Reconciliation Service

This document provides instructions on how to run, test, and deploy the Identity Reconciliation Service.

## 1. Setup Database

You must have a MySQL server running.
1. Connect to your MySQL server.
2. Run the `db.sql` file provided in this project to create the `bitespeed` database and the `Contact` table.

```bash
mysql -u root -p < db.sql
```

## 2. Run Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. By default, the app expects to connect to a MySQL instance on `localhost` with user `root` and no password. To change this, set environment variables before running:
   ```bash
   # Windows PowerShell
   $env:DB_USER="your_user"; $env:DB_PASSWORD="your_password"; npm start

   # Mac/Linux
   DB_USER=your_user DB_PASSWORD=your_password npm start
   ```

3. The server runs at `http://localhost:3000`.

## 3. Example cURL Requests

Here are examples of the core functionality:

**A. Create a new primary contact**
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{ "email": "lorraine@hillvalley.edu", "phoneNumber": "123456" }'
```

**B. Add new information to an existing contact (Creates Secondary)**
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{ "email": "mcfly@hillvalley.edu", "phoneNumber": "123456" }'
```

**C. Same info (Does not create duplicate, just returns cluster)**
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{ "email": "lorraine@hillvalley.edu", "phoneNumber": "123456" }'
```

**D. Merge two existing primary contacts**
Assuming `george@hillvalley.edu` with phone `789` was created separately in the past, sending a request linking his email with Lorraine's phone `123456`:
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{ "email": "george@hillvalley.edu", "phoneNumber": "123456" }'
```

## 4. Example Response

A successful JSON response unifying Lorraine and George's contacts under the oldest primary contact looks like:
```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu", "george@hillvalley.edu"],
    "phoneNumbers": ["123456", "789"],
    "secondaryContactIds": [2, 3]
  }
}
```

## 5. Explanation of Merging Logic

The controller strictly adheres to the following logic algorithm:

1. **Validation**: Must include either `email` or `phoneNumber`.
2. **Lookup**: Fetch any rows directly matching the incoming `email` OR `phoneNumber`.
3. **Cluster Resolution**: 
   - If **NO MATCHES** are found, this is an entirely new user. Insert a new row with `linkPrecedence = 'primary'`.
   - If **MATCHES** are found, trace all matching profiles to their root primary IDs. Fetch every profile associated with those primary IDs. This group is the "Cluster".
4. **Primary Re-assignment**: 
   - Inside the cluster, find all primary contacts. 
   - Identify the oldest primary contact chronologically. 
   - Update every *other* primary contact to be `secondary`, assigning their `linkedId` to the oldest primary.
   - Update any secondaries that pointed to the *other* primaries to now point directly to the oldest primary.
5. **New Information Storage**: 
   - After the cluster is standardized, look at the incoming payload. If it provides an `email` or `phoneNumber` that *does not currently exist within the cluster*, append a new `secondary` contact containing that new data linked to the unified primary.
   - If the incoming payload provides data that is already inside the cluster, *no duplicate rows are created*.
6. **Delivery**: Format the response array cleanly putting the primary's identifiers first, followed by unique secondary identifiers.

## 5. Deployment Instructions (Render)

Render makes it extremely easy to host Node.js and external MySQL DBs. Since Render does not natively host MySQL inside the free tier dashboard easily without custom Docker mounts, you typically want to use a provider like Aiven, PlanetScale, or TiDB to host the MySQL database for free, and connectRender to it.

1. Create a MySQL DB online (e.g. Aiven free tier). Get the connection URL.
2. Push this source code to a GitHub repository.
3. Log into **Render.com**.
4. Click **New +** -> **Web Service**.
5. Connect your GitHub repository.
6. Configure the setup:
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
7. In the Render Dashboard under **Environment Variables**, add the variables required by `db/connection.js`:
   - `DB_HOST` (e.g., db-myapp.aivencloud.com)
   - `DB_USER`
   - `DB_PASSWORD`
   - `DB_NAME`
8. Click **Deploy**. Render will automatically provision an SSL secured domain. Update your cURL requests to point to your new `.onrender.com` domain instead of `localhost`.
