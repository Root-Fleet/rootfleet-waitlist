# ADR-001: Cloudflare Pages + Pages Functions

## Status
Accepted

## Context
Rootfleet requires a globally available waitlist system with minimal operational overhead.
The system needs to serve a static landing page and a small API for handling signups and sending emails.

Traditional server-based architectures introduce unnecessary complexity
(deployment pipelines, server maintenance, scaling concerns).

## Decision
Use **Cloudflare Pages** for static asset hosting and **Pages Functions**
(Workers runtime) for API endpoints.

## Consequences
### Positive
- Global edge deployment by default
- Zero server maintenance
- Fast deployments tied directly to Git pushes
- Simple rollback via Git history

### Negative
- Workers runtime constraints (no full Node.js APIs)
- Debugging differs from traditional servers
