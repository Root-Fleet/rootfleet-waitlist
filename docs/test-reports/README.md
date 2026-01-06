# Testing Strategy & System Validation

This document describes the testing strategy applied to the Rootfleet Waitlist system, the order in which tests were conducted, and how insights from each phase informed system design decisions.

The goal of this testing effort was not only to validate correctness, but to **understand system behavior under real-world and extreme conditions**, and to use empirical evidence to guide architectural evolution.

---

## Testing Philosophy

Testing was conducted progressively, moving from correctness to durability:

1. Verify that the system behaves correctly
2. Ensure the system can safely handle expected traffic
3. Intentionally exceed limits to discover failure modes
4. Use observed bottlenecks to redesign for scalability and resilience

This mirrors how production systems are validated in real engineering environments.

---

## Test Types & Execution Order

The following test types were conducted in sequence:

### 1. Functional Tests
Functional tests validated that individual API endpoints behaved correctly under normal usage:
- Input validation
- Expected HTTP responses
- Idempotency behavior
- Correct database writes

These tests ensured the system was logically correct before subjecting it to load.

📄 See: `doc/test-reports/001-functional-tests.md`

---

### 2. End-to-End (E2E) Tests
End-to-end tests validated the full user journey across system boundaries.

- **Production E2E** includes:
  - API request
  - Database persistence
  - Email confirmation delivery via Resend
- **Preview/Staging E2E** intentionally disabled email delivery to:
  - Isolate API and database durability
  - Prevent third-party rate limits from masking core bottlenecks

This separation allowed controlled testing of infrastructure limits.

📄 See: `doc/test-reports/002-e2e-tests.md`

---

### 3. Smoke Tests
Smoke tests were executed after each deployment to quickly confirm system availability.

These tests answered one question:
> “Is the system alive and responding?”

They were lightweight, fast, and non-destructive.

📄 See: `doc/test-reports/003-smoke-tests.md`

---

### 4. Load Tests
Load testing simulated **expected real-world traffic** to evaluate system behavior under normal operating conditions.

Key goals:
- Measure latency under sustained load
- Observe database write performance
- Identify early signs of degradation

Results showed stable behavior, acceptable latency (~380ms average), and ~3,000 successful database writes in ~80 seconds with no failure conditions.

📄 See: `doc/test-reports/004-load-tests.md`

---

### 5. Stress Tests
Stress testing intentionally pushed the system beyond safe limits to observe failure behavior.

This phase focused on:
- Discovering bottlenecks
- Understanding failure modes
- Measuring maximum sustainable throughput

The system successfully handled ~46,000 database writes before experiencing increased latency and network-level timeouts, without data corruption.

📄 See: `doc/test-reports/005-stress-tests.md`

---

### 6. Postmortem & Redesign
Insights from stress testing informed architectural redesign decisions, including:
- Introducing queuing for database writes
- Decoupling API responsiveness from persistence
- Preparing the system for horizontal scalability

This phase documents what failed, why it failed, and how the system will evolve.

📄 See: `doc/adr/ADR-008-Postmortem-Architectural-redesign.md`

---

## Unit & Integration Testing

Unit and integration tests were introduced **after initial system-level validation** to ensure correctness during architectural evolution.

- **Unit tests** validate isolated logic (validation, idempotency, transformations)
- **Integration tests** validate interactions between:
  - API
  - Database (D1)
  - Queueing mechanisms (Redis / future streaming systems)

These tests ensure future changes do not regress system behavior.

---

## Why This Matters

This testing approach demonstrates:
- Discipline in test layering
- Data-driven architectural decisions
- Clear separation of concerns
- Production-oriented engineering thinking

The system was not only tested to pass, but tested to **fail safely, predictably, and inform improvement**.
