# Architecture Redesign Rationale

## Problem Statement

Initial stress testing revealed that synchronous database writes were the primary scalability bottleneck.

Under high concurrency:
- Request latency increased significantly
- Database write contention caused timeouts
- The API layer was unable to scale independently

---

## Design Goals

- Increase write throughput
- Improve API responsiveness
- Isolate failures in downstream systems
- Reduce coupling between request handling and persistence

---

## Redesign Overview

We introduced an asynchronous write model using Redis-backed queues.

### Before
Client → API → D1 (synchronous)

### After
Client → API → Redis Queue → DB Worker → D1

---

## Why Redis LISTS

Redis LISTS were chosen as the initial queue mechanism due to:
- Low operational cost
- Simplicity
- Predictable performance
- Suitability for single-consumer write workloads

---

## Failure Handling Strategy

To avoid data loss:
- Jobs are atomically moved to a processing queue
- Failed jobs are retried
- Idempotent DB writes are enforced

---

## Expected Improvements

- API latency becomes independent of DB performance
- Burst traffic is absorbed by the queue
- Database load becomes smooth and controlled
- System remains responsive during spikes

---

## Known Limitations

- Manual retry logic
- Single-consumer scaling
- Limited observability

These limitations are addressed in the next evolution phase.
