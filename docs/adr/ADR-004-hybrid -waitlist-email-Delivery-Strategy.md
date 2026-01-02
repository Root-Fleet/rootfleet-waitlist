# ADR-004: Hybrid Triggered Email Delivery with Cron Backstop

## Status
Accepted

## Context
The waitlist signup endpoint (`POST /api/waitlist`) must:

- Persist signup data reliably
- Send a confirmation email
- Avoid duplicate sends
- Provide strong observability for debugging and performance analysis
- Operate within Cloudflare Free plan constraints

A purely synchronous approach increases latency and tightly couples the user response time to the email provider.

A cron-only approach causes noticeable delays in email delivery, resulting in a poor user experience.

Cloudflare Queues were evaluated to offload email delivery from the request lifecycle, but they are not available on the Free plan.

A solution was required that balances:

- User experience
- Reliability
- Debuggability
- Platform constraints

## Decision
Adopt a **hybrid triggered email delivery architecture with a cron backstop**, consisting of the following components:

### 1. Triggered Immediate Delivery (Primary Path)
- After inserting the waitlist record, the API enqueues a lightweight job into Redis.
- The API explicitly triggers the email consumer Worker via HTTP (`/trigger`).
- The API **may await the trigger response**, bounded by a short timeout, in order to:
  - Ensure deterministic execution in runtimes without `ctx.waitUntil`
  - Capture reliable logs of trigger outcomes (`processed`, `failed`, `remaining`)
- When successful, the confirmation email is sent almost immediately.

### 2. Cron-Based Backstop Delivery (Secondary Path)
- A scheduled Worker runs periodically (e.g. every minute).
- It scans for waitlist records that remain in a `pending` state.
- It retries email delivery using the same shared job logic.
- This guarantees eventual delivery even if the trigger path fails or is delayed.

### 3. Idempotent, Shared Job Logic
- Email sending logic is centralized in a shared module.
- Both trigger and cron paths reuse this logic to avoid duplication.
- Database state transitions (`pending → processing → sent | failed`) ensure:
  - Exactly-once delivery
  - No duplicate emails
  - Safe retries under concurrency or partial failure

### 4. Source Attribution & Observability
- Each email record is stamped with `email_source`:
  - `trigger` or `cron`
- Structured logs include a correlation ID (`rid`) across:
  - API request (Cloudflare Pages)
  - Trigger call and response
  - Consumer drain and email send
  - Database updates

## Consequences

### Positive
- Near-instant email delivery in the common case
- Guaranteed eventual delivery via cron
- Strong protection against duplicate emails
- Clear operational visibility and audit trail
- Fully compatible with Cloudflare Free plan
- Shared, DRY implementation across trigger and cron paths

### Trade-offs
- API response time may include trigger duration in runtimes without `ctx.waitUntil`
- Slightly increased architectural complexity
- Timeout tuning required to balance UX responsiveness with observability
