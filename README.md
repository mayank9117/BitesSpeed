# 🧠 Bitespeed Identity Reconciliation Service

This project implements a backend service for identity reconciliation using Node.js, Express, and MySQL.

The goal is to identify and consolidate multiple contact records belonging to the same user based on shared email or phone number.

---

## 🚀 Tech Stack

- Node.js
- Express.js
- MySQL
- mysql2 (promise-based)

---

## 📌 Problem Statement

Users may place multiple orders using different emails and phone numbers.

The system must:

- Identify if contacts belong to the same person.
- Merge them under a single **primary contact**.
- Maintain other linked contacts as **secondary contacts**.
- Return a consolidated contact response.

---

## 🗄 Database Schema

```sql
CREATE DATABASE IF NOT EXISTS bitespeed;
USE bitespeed;

CREATE TABLE IF NOT EXISTS Contact (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phoneNumber VARCHAR(20),
    email VARCHAR(255),
    linkedId INT NULL,
    linkPrecedence ENUM('primary', 'secondary') NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deletedAt DATETIME NULL,
    FOREIGN KEY (linkedId) REFERENCES Contact(id)
);
```

---

## 🔥 API Endpoint

### `POST /identify`

### Request Body (JSON)

```json
{
  "email": "string (optional)",
  "phoneNumber": "string (optional)"
}
```

At least one field must be provided.

---

## ✅ Response Format

```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["primary@email.com", "secondary@email.com"],
    "phoneNumbers": ["999999", "888888"],
    "secondaryContactIds": [2, 3]
  }
}
```

---

# 🧠 How the Identity Logic Works

### Step 1: Lookup
Find all contacts where:
- email matches OR
- phoneNumber matches

---

### Step 2: No Match Found
If no records exist:
- Create new contact
- Mark as `primary`
- Return response

---

### Step 3: Match Found
If records exist:
- Identify all linked contacts
- Find the oldest primary contact
- Convert other primaries to secondary
- Link them to oldest primary

---

### Step 4: New Information Handling
If request contains new email/phone not present in cluster:
- Insert new secondary record
- Link to primary

---

### Step 5: Consolidated Response
Return:
- Oldest primary ID
- Unique emails
- Unique phone numbers
- All secondary contact IDs

---

# 🖥 Running Locally

## 1️⃣ Install Dependencies

```bash
npm install
```

---

## 2️⃣ Setup MySQL

Make sure MySQL server is running.

Login to MySQL:

```bash
mysql -u root -p
```

Then run:

```sql
SOURCE C:/Users/your-username/path-to-project/db.sql;
```

---

## 3️⃣ Start Server

If password is set:

### Windows PowerShell
```powershell
$env:DB_PASSWORD="your_password"
npm start
```

### CMD
```cmd
set DB_PASSWORD=your_password
npm start
```

If no password:
```bash
npm start
```

---

Server will run on:

```
http://localhost:3000
```

---

# 🧪 Testing Using Postman

### Method: POST  
### URL:
```
http://localhost:3000/identify
```

### Body → raw → JSON

```json
{
  "email": "lorraine@hillvalley.edu",
  "phoneNumber": "123456"
}
```

Click **Send**.

---

# 🔎 Edge Cases Handled

- New user creation
- Duplicate prevention
- Multiple secondary contacts
- Merge of two primary contacts
- Oldest primary preserved
- Unique email and phone extraction

---

# 👨‍💻 Author

Mayank Kumar  
Backend Developer | Node.js | MySQL | System Design Enthusiast

---

# 🎯 Project Summary

This project demonstrates:

- Relational database design
- Primary-secondary record linking
- Identity reconciliation logic
- Backend API design
- Real-world data merging strategy
