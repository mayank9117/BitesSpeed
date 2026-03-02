# Bitespeed Identity Reconciliation - API Test Cases

Below are the `curl` commands for all the edge cases and scenarios handling the Identity Reconciliation logic.

> **Note for Windows Users:** If you are running these in PowerShell, ensure you use `curl.exe` instead of `curl`, or run them in Command Prompt (CMD) or Git Bash to avoid PowerShell's `Invoke-WebRequest` alias issues.

---

### Scenario 1: Creating a brand new contact
When no contact exists, a new `primary` contact is created.

**Request:**
```bash
curl.exe -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"lorraine@hillvalley.edu\", \"phoneNumber\": \"123456\"}"
```

**Expected Result:**
Creates a new primary contact.
```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["lorraine@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": []
  }
}
```

---

### Scenario 2: Adding a new phone number to an existing contact
When an existing email is provided but with a new phone number, a `secondary` contact is created and linked.

**Request:**
```bash
curl.exe -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"lorraine@hillvalley.edu\", \"phoneNumber\": \"123456789\"}"
```

**Expected Result:**
Creates a secondary contact linked to the primary.
```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["lorraine@hillvalley.edu"],
    "phoneNumbers": ["123456", "123456789"],
    "secondaryContactIds": [2]
  }
}
```

---

### Scenario 3: Adding a new email to an existing contact
When an existing phone number is provided but with a new email, a `secondary` contact is created and linked.

**Request:**
```bash
curl.exe -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"mcfly@hillvalley.edu\", \"phoneNumber\": \"123456\"}"
```

**Expected Result:**
Creates another secondary contact linked to the primary.
```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"],
    "phoneNumbers": ["123456", "123456789"],
    "secondaryContactIds": [2, 3]
  }
}
```

---

### Scenario 4: Querying with the exact same details (No Duplicate Row Creation)
When a request is made with details that already exist in the primary/secondary cluster, no new rows are created. It just returns the consolidated cluster.

**Request:**
```bash
curl.exe -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"lorraine@hillvalley.edu\", \"phoneNumber\": \"123456\"}"
```

**Expected Result:**
Same response as before, no new `secondaryContactIds` generated.

---

### Scenario 5: Missing Email or Phone Number
The API should accept partial information as long as at least one of them is present.

**Request (Only Email):**
```bash
curl.exe -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"mcfly@hillvalley.edu\", \"phoneNumber\": null}"
```

**Request (Only Phone):**
```bash
curl.exe -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d "{\"email\": null, \"phoneNumber\": \"123456789\"}"
```

---

### Scenario 6: Merging two separate Primary Contacts
This tests the edge case where two completely independent contacts exist, and a new request links them together.

**Step 6A: Create Primary Contact A**
```bash
curl.exe -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"doc@brown.com\", \"phoneNumber\": \"99999\"}"
```

**Step 6B: Create Primary Contact B (Different email & phone)**
```bash
curl.exe -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"marty@mcfly.com\", \"phoneNumber\": \"88888\"}"
```

**Step 6C: Link Contact A and B (Cross-Request)**
Here, we send a request containing Contact A's email and Contact B's phone number. The system will identify both `primary` contacts, elect the older one as `primary`, convert the newer one to `secondary`, and return the consolidated result.

```bash
curl.exe -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"doc@brown.com\", \"phoneNumber\": \"88888\"}"
```

**Expected Result:**
One becomes the primary (Id: 4), the other becomes secondary (Id: 5). No 3rd contact is created because the `doc@brown.com` and `88888` already exist individually in the cluster.
```json
{
  "contact": {
    "primaryContactId": 4,
    "emails": ["doc@brown.com", "marty@mcfly.com"],
    "phoneNumbers": ["99999", "88888"],
    "secondaryContactIds": [5]
  }
}
```
