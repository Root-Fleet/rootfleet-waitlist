# Waitlist System Test Checklist
_A single copy-paste checklist for Category 3: Data Integrity & Correctness_

---

## Goal

Prove the waitlist system behaves correctly under real usage:

- Same email submitted many times → **exactly one DB row**
- Duplicates handled gracefully (no errors, no re-sends)
- Payloads normalized (trimmed + lowercased)
- Invalid inputs rejected (no DB writes)
- Email delivery is **exactly once**
- Trigger path is primary; cron is a safe backstop
- No double sends, ever

---

## Before You Start

### 0) Test Emails (use `+` aliases)
Use unique aliases so results are isolated:

- `you+idempo@gmail.com`
- `you+normalize@gmail.com`
- `you+badrole1@gmail.com`
- `you+badrole2@gmail.com`
- `you+badfleet1@gmail.com`
- `you+badfleet2@gmail.com`

---

### 1) Useful DB Inspection Queries (Cloudflare D1 – remote)
Replace `<DB_NAME>` and email values as needed.

```bash
wrangler d1 execute <DB_NAME> --remote --command \
"SELECT email,
        role,
        fleet_size,
        company_name,
        email_status,
        email_source,
        resend_message_id,
        email_sent_at,
        email_attempts
 FROM waitlist
 WHERE email='you+idempo@gmail.com';"

```bash
 A. Idempotency (Email Uniqueness)
Test: Submit the same email 10×.

for i in $(seq 1 10); do
  curl -s -X POST https://rootfleet-waitlist.pages.dev/api/waitlist \
    -H "content-type: application/json" \
    -d '{"email":"you+idempo@gmail.com","role":"fleet_owner","fleetSize":"6-20","companyName":"Acme"}'
  echo
done

### Expected:

- 1st response: status = joined

- All subsequent responses: status = already_joined

- DB: exactly 1 row

- Inbox: exactly 1 email

- DB Check:


## B. Normalization (Casing + Whitespace)
### Test: Submit the same logical email with different casing.

curl -X POST https://rootfleet-waitlist.pages.dev/api/waitlist \
  -H "content-type: application/json" \
  -d '{"email":"Test@Email.com","role":"fleet_owner","fleetSize":"6-20"}'

curl -X POST https://rootfleet-waitlist.pages.dev/api/waitlist \
  -H "content-type: application/json" \
  -d '{"email":"test@email.com","role":"fleet_owner","fleetSize":"6-20"}'

curl -X POST https://rootfleet-waitlist.pages.dev/api/waitlist \
  -H "content-type: application/json" \
  -d '{"email":"TEST@EMAIL.COM","role":"fleet_owner","fleetSize":"6-20"}'


### Expected:

- DB stores email lowercase + trimmed

- DB: exactly 1 row

- Inbox: exactly 1 email

- DB Check:

SELECT email, COUNT(*)
FROM waitlist
WHERE email='test@email.com'
GROUP BY email;

## C. Validation Edge Cases
### Missing / Invalid Email

curl -X POST https://rootfleet-waitlist.pages.dev/api/waitlist \
  -H "content-type: application/json" \
  -d '{"role":"fleet_owner","fleetSize":"6-20"}'

curl -X POST https://rootfleet-waitlist.pages.dev/api/waitlist \
  -H "content-type: application/json" \
  -d '{"email":"bad","role":"fleet_owner","fleetSize":"6-20"}'

## Missing / Invalid Role

curl -X POST https://rootfleet-waitlist.pages.dev/api/waitlist \
  -H "content-type: application/json" \
  -d '{"email":"you+badrole1@gmail.com","fleetSize":"6-20"}'

curl -X POST https://rootfleet-waitlist.pages.dev/api/waitlist \
  -H "content-type: application/json" \
  -d '{"email":"you+badrole2@gmail.com","role":"ceo","fleetSize":"6-20"}'

## Missing / Invalid Fleet Size

curl -X POST https://rootfleet-waitlist.pages.dev/api/waitlist \
  -H "content-type: application/json" \
  -d '{"email":"you+badfleet1@gmail.com","role":"fleet_owner"}'

curl -X POST https://rootfleet-waitlist.pages.dev/api/waitlist \
  -H "content-type: application/json" \
  -d '{"email":"you+badfleet2@gmail.com","role":"fleet_owner","fleetSize":"999"}'

### Expected (all cases):

- API returns HTTP 400

- DB creates 0 rows

- No emails sent

### DB Check:

SELECT COUNT(*)
FROM waitlist
WHERE email IN (
  'you+badrole1@gmail.com',
  'you+badrole2@gmail.com',
  'you+badfleet1@gmail.com',
  'you+badfleet2@gmail.com'
);

## D. Exactly-Once Email Sending

### Test:
After one valid signup, manually call the trigger endpoint multiple times.

curl -X POST https://waitlist-email-consumer.<your-subdomain>.workers.dev/trigger \
  -H "x-trigger-secret: <SECRET>"
Repeat 3–5×.

### Expected:

- DB transitions: pending → processing → sent once

- resend_message_id set once

- Inbox: exactly 1 email

### DB Check:

SELECT email_status, resend_message_id, email_sent_at
FROM waitlist
WHERE email='you+idempo@gmail.com';

## E. Trigger vs Cron Backstop Correctness

### Test:

- Temporarily break trigger (wrong secret or URL)

- Submit once

- Wait for cron interval

###  Expected:

- Email eventually delivered

- DB shows email_source = cron

- Inbox: exactly 1 email

### DB Check:

SELECT email_status, email_source
FROM waitlist
WHERE email='you+idempo@gmail.com';

## Definition of Done ✅

- Same email submitted repeatedly → 1 DB row

- Invalid payloads → 0 DB rows

- Emails sent exactly once

- Trigger and cron paths both safe

- Observability sufficient to debug in minutes, not hours

## This doc still requires amendments
