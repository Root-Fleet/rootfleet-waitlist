# Load Tests Report

**Date:** 2026-01-06
**Environment:** Staging / Preview
**System under test:** Rootfleet Waitlist API

---

## Purpose

Load tests validate the system's **behavior under controlled but increased traffic**, measuring:

- Latency
- Throughput (requests per second)
- Database write durability
- Correctness under concurrent users

The goal is to identify the **capacity of the system under moderate traffic** before moving to stress tests.

---

## Key Checks

| Check | Expected Result |
|-------|----------------|
| Endpoint response | Returns `200 OK` with `joined` or `already_joined` |
| Database writes | Records successfully stored in D1 |
| Latency | Average response time within acceptable range (≤ 500ms) |
| Success rate | > 90% requests succeed |
| Idempotency | Duplicate requests handled gracefully |

---

## Test Design

- **Virtual Users (VUs):** 10
- **Duration:** 30–80s, gradually ramping traffic
- **Requests:** `POST /api/waitlist` with generated emails
- **Payload:** `{email, role, fleetSize, companyName}`
- **Metrics captured:**
  - Request latency (min, max, avg, p90, p95)
  - Total successful and failed DB writes
  - Iterations completed

---

## Results

| Metric | Observed |
|--------|----------|
| Avg Latency | ~380ms |
| Min Latency | ~233ms |
| Max Latency | ~728ms |
| Requests Completed | 464–509 |
| Successful DB Writes | ~3,000 within 80s |
| Failed Requests | 0 (all passed checks) |
| HTTP Errors | None |
| Success Rate | 100% |
| Iterations per VU | ~50 per VU over 30s |

**Additional Observations:**

- System handled **moderate concurrency** without errors
- Database writes completed successfully; D1 did not throttle
- Latency remained stable under ~10 VUs
- Provides **baseline capacity metrics** before stress testing

---

## Summary

The load test demonstrates that the system can handle **moderate load** effectively:

- ~3,000 users successfully written to DB in ~80s
- Avg latency ~380ms, well within acceptable range
- System **ready for higher concurrency/stress tests**

---

## Lessons Learned

- Moderate load does not trigger DB or endpoint errors
- Provides baseline for **scaling decisions**
- Helps **calibrate thresholds for stress testing**
- Confirms system handles **idempotency and validation under load**

---

**Next Steps:**
Proceed to **Stress Test** to identify **maximum system capacity** and thresholds where failures begin.
