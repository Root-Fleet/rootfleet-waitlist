# Smoke Tests Report

**Date:** 2026-01-06
**Environment:** Staging / Preview
**System under test:** Rootfleet Waitlist API

---

## Purpose

Smoke tests are **preliminary sanity checks** to ensure the system is **up, running, and responsive** before deeper testing (load, stress).

- Verify **endpoints are reachable**
- Confirm **basic functionality works**
- Detect any **critical failures** early

---

## Key Checks

| Check | Expected Result |
|-------|----------------|
| Endpoint health (`GET /api/waitlist/health`) | Returns `200 OK` with status and env info |
| Simple signup request | Returns `200 OK`, `status: joined` |
| Basic database write | Record exists in D1 |
| Idempotency check | Re-submitting same email returns `already_joined` |
| Response time | < 500ms for single requests |

---

## Results

| Scenario | Result | Notes |
|----------|--------|-------|
| Health check | ✅ Passed | Endpoint returned `{"env":"preview","d1":"bound"}` |
| Simple signup | ✅ Passed | Signup inserted successfully into D1 |
| Duplicate signup | ✅ Passed | Returned `already_joined` without duplicates |
| Database verification | ✅ Passed | Fields correctly stored |
| Response latency | ✅ Passed | Avg ~380ms during single requests |

**Additional Observations:**

- Smoke test completed successfully with **10 virtual users over 30s**
- System **ready for load tests**, no errors observed

---

## Summary

The smoke test confirmed:

- System is **up and reachable**
- Endpoints respond correctly
- Basic user flows execute successfully

Smoke testing **provides confidence** to proceed with **load and stress testing**.

---

## Lessons Learned

- Smoke tests act as a **safety gate** before executing resource-intensive tests
- Quick detection of endpoint or DB issues reduces wasted effort on load/stress testing
- Establishes baseline **latency and success rates** for small traffic
