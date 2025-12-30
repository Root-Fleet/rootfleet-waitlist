# ADR-004: Hybrid Waitlist Email Delivery (Best-Effort + Cron Backstop)

## Status
Accepted

## Context
The waitlist signup endpoint (`POST /api/waitlist`) must:

- Respond quickly to users
- Persist signup data reliably
- Send a confirmation email
- Provide observability for debugging and performance analysis

The original synchronous design performed all work (database writes and email sending) inside the request lifecycle. This caused increased latency and made it difficult to distinguish whether slowness originated from the database or the email provider.

Cloudflare Queues were evaluated to move email sending out of the request path, but Queues are not available on the Free plan. A solution was required that:
- Improves latency
- Preserves reliability
- Works within Free plan constraints

## Decision
Adopt a **hybrid email delivery architecture** consisting of:

1. **Best-effort immediate email sending**
   - After inserting the waitlist record, the API returns a response immediately.
   - Email sending is attempted in the background using `ctx.waitUntil(...)`.
   - This path does not block the user response.

2. **Cron-based backstop worker**
   - A scheduled Worker runs every minute.
   - It scans for waitlist records with pending email status.
   - It retries email delivery with backoff and updates status accordingly.

3. **Shared job logic**
   - Core email-sending and status-update logic lives in a shared module.
   - Both the API handler and cron worker reuse this logic to avoid duplication.

## Consequences
### Positive
- Significantly faster user-facing request/response cycle
- Reliable eventual delivery of confirmation emails
- Clear separation between request handling and background processing
- Improved observability through structured logs and correlation IDs
- Fully compatible with the Cloudflare Free plan
- DRY implementation via shared modules

### Negative
- Confirmation email may be delayed (up to the cron interval) if the immediate attempt does not complete
- Slightly more architectural complexity than a synchronous approach
- Requires careful state management to avoid duplicate sends
