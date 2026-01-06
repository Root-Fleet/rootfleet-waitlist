# Stress Testing Report

## Objective
The goal of this stress test was to determine:
- The maximum sustainable write throughput of the waitlist API
- How the system behaves under increasing concurrent load
- The failure mode of the system when limits are exceeded

This test intentionally pushed the system beyond expected production load.

---

## System Under Test

- Platform: Cloudflare Pages + Functions
- Database: Cloudflare D1 (SQLite)
- Background jobs (emails): Disabled in staging
- Load testing tool: k6
- Test environment: Staging (isolated from production)

---

## Load Profile

The test was executed in progressive stages:

| Phase | Virtual Users | Duration | Purpose |
|-----|-------------|----------|--------|
| Smoke Test | 10 VUs | 30s | Validate correctness |
| Load Test | 50–100 VUs | 1–2 min | Observe latency growth |
| Stress Test | Up to 1000 VUs | 3+ min | Identify breaking point |

Each VU continuously issued POST requests to `/api/waitlist`.

---

## Observed Results

- Total completed iterations before failure: ~47,800
- Successful DB writes before failure: ~46,600
- Average latency before degradation: ~300ms
- Average latency near failure: ~1000ms+
- Failure mode: Network timeouts (`dial: i/o timeout`)
- No data corruption observed

---

## Failure Analysis

The system did not crash permanently.
Instead:
- Requests began timing out
- The database became the bottleneck
- Cloudflare Workers automatically recovered after load subsided

This indicates a **graceful degradation** pattern rather than catastrophic failure.

---

## Key Findings

1. The API layer can accept high concurrency
2. The database write path is the primary bottleneck
3. Synchronous DB writes limit horizontal scalability
4. Retry-free synchronous writes amplify load spikes

---

## Conclusion

The system demonstrated:
- Strong resilience under moderate load
- Predictable degradation under extreme load
- A clear need for write decoupling via queuing

This informed the next architectural redesign.
