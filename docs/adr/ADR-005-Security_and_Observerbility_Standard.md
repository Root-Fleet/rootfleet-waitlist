# ADR-005: Security and Observability Standards (Structured Logs & Correlation IDs)

## Status
Accepted

## Context
As the system grows beyond simple static pages, it becomes increasingly important to:

- Understand what happens during each request
- Debug failures across asynchronous boundaries (API → background job → email provider)
- Reason about performance bottlenecks (database vs external services)
- Avoid logging sensitive data while still retaining useful diagnostics

Traditional unstructured `console.log` statements make it difficult to correlate events across requests and background processing.

## Decision
Adopt **structured logging with correlation IDs** as a standard across the system.

Specifically:
- Every request or background job generates a unique request identifier (`rid`)
- All logs are emitted as structured JSON
- Logs include contextual fields (event name, timing, status, identifiers)
- Sensitive data (PII, secrets) is excluded or redacted

This standard applies to:
- Cloudflare Pages Functions
- Background Workers (cron-based jobs)
- External service integrations (e.g. Resend)

## Consequences

### Positive
- Clear traceability of a single request or job across multiple components
- Easier debugging of production issues using Cloudflare logs
- Ability to identify performance bottlenecks using timing fields
- Consistent logging format across synchronous and asynchronous code
- Improved security posture by avoiding accidental sensitive-data logging

### Negative
- Slightly more verbose logging code
- Requires discipline to consistently include `rid` and structured fields
- Logs may be less human-readable without formatting tools
