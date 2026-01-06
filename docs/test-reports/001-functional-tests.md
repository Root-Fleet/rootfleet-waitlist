# Functional Tests Report

**Date:** 2026-01-06
**Environment:** Staging / Preview
**System under test:** Rootfleet Waitlist API

---

## 1. Purpose

Functional tests ensure that **each API endpoint behaves correctly and consistently** under normal conditions.
The goal is to validate the **core correctness** of the system before exposing it to higher levels of load or end-to-end scenarios.

---

## 2. Scope

Functional tests covered:

1. **Waitlist API endpoint** (`POST /api/waitlist`)
2. Input validation and required fields:
   - `email`
   - `role` (fleet_owner / driver)
   - `fleetSize` (1-5, 6-20, etc.)
   - `companyName`
3. Idempotency:
   - Re-joining with the same email should **not create duplicates**
   - Correct response for already joined users
4. Database persistence:
   - Ensure records are written to **D1 database**
   - Verify `status` and `rid` fields
5. Correct HTTP response codes:
   - `200 OK` for successful join
   - `400 Bad Request` for missing fields or invalid input
   - `409 Conflict` if trying to join again (in staging preview, handled as `already_joined`)

---

## 3. Test Design

Tests were executed using **curl** and **k6 scripts in lightweight mode** for deterministic correctness verification.

### Example requests:

```bash
# Valid signup
curl -X POST https://staging.rootfleet-waitlist.pages.dev/api/waitlist \
  -H "Content-Type: application/json" \
  -d '{"email":"functionaltest+1@example.com","role":"fleet_owner","fleetSize":"1-5","companyName":"TestCorp"}'

# Missing email
curl -X POST https://staging.rootfleet-waitlist.pages.dev/api/waitlist \
  -H "Content-Type: application/json" \
  -d '{"role":"fleet_owner","fleetSize":"1-5","companyName":"TestCorp"}'


## Key Checks

| Check | Expected Result |
|-------|----------------|
| Required fields missing | Returns `400 Bad Request` |
| Successful signup | Returns `200 OK`, `status: joined` |
| Duplicate signup | Returns `200 OK`, `status: already_joined` |
| Database write | Record exists in D1 table with correct `email`, `role`, `fleetSize`, `status` |

---

## Results

| Scenario | Result | Notes |
|----------|--------|-------|
| Valid signup | ✅ Passed | Record correctly inserted into D1 |
| Missing fields | ✅ Passed | Returned `400 Bad Request` |
| Duplicate signup | ✅ Passed | Returned `already_joined` without creating duplicate |
| Database verification | ✅ Passed | `status` and `rid` fields correctly stored |

---

## Summary

All functional behaviors were verified and passed without error.
The system correctly enforces validation, idempotency, and database persistence.
This establishes a **baseline of correctness** for all subsequent tests.

---

## Lessons Learned

- Verifying **API correctness early** prevents false positives in load/stress tests
- **Idempotency checks** are critical before adding load to avoid database duplication
- Functional tests are essential for building confidence in the system’s basic behavior
