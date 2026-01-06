# End-to-End (E2E) Tests Report

**Date:** 2026-01-06
**Environment:** Staging / Preview
**System under test:** Rootfleet Waitlist API + Email Delivery

---

## Purpose

E2E tests validate the **complete user journey**, ensuring all system components work together:

- API request
- Database persistence
- Email confirmation delivery (Resend integration)

For staging, **email delivery was paused** to focus on API and DB durability, preventing third-party rate limits from affecting results.

---

## Key Checks

| Check | Expected Result |
|-------|----------------|
| Valid signup flow | `200 OK`, `status: joined` |
| Database persistence | Record exists in D1 table with correct `email`, `role`, `fleetSize`, `status` |
| Email delivery | In production: email sent and inbox receives confirmation |
| Duplicate signup | `200 OK`, `status: already_joined` |
| Invalid input | `400 Bad Request` |
| Idempotency | Multiple requests with same email do not create duplicates |

---

## Results

| Scenario | Result | Notes |
|----------|--------|-------|
| Valid signup | ✅ Passed | DB write confirmed |
| Duplicate signup | ✅ Passed | `already_joined` returned, no duplication |
| Missing required fields | ✅ Passed | Returned `400 Bad Request` |
| Email delivery (prod) | ✅ Passed | Confirmation sent via Resend |
| Staging email disabled | ✅ Passed | System processed signup without third-party call |

**Additional Observations:**

- Staging handled **3000 successful DB writes in ~80s** during controlled load test
- Latency averaged ~380ms, within acceptable range

---

## Summary

E2E testing confirmed that the system **successfully executes the full user journey**:

- API correctness
- DB persistence
- Email delivery (prod only)

Staging allowed us to **isolate API behavior** without interference from third-party systems.

---

## Lessons Learned

- Isolating email delivery is **essential for deterministic staging tests**
- Tracking both API response and DB writes provides **accurate insight into system durability**
- Observed latency and DB writes provide a **baseline for load/stress testing**
