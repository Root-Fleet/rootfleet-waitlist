# ADR-007: Backend API Architecture (Vanilla JavaScript with Cloudflare Pages Functions)

## Status
Accepted

## Context
The system requires backend functionality to:

- Handle user-submitted data (waitlist signup)
- Perform validation and persistence
- Integrate with external services (email)
- Expose simple endpoints for frontend consumption
- Remain lightweight, fast, and cost-effective at low to moderate scale

Using a traditional backend framework (Express, NestJS, etc.) or a dedicated server would introduce additional:
- Runtime overhead
- Deployment complexity
- Long-lived process management
- Framework abstractions that are unnecessary for the current scope

Cloudflare Pages Functions natively execute JavaScript at the edge and provide filesystem-based routing without requiring an application framework.

## Decision
Implement the backend API using **vanilla JavaScript** running on **Cloudflare Pages Functions**.

Key characteristics:
- Plain JavaScript (no backend framework)
- Filesystem-based routing under `/functions/api/*`
- JSON over HTTP for all API communication
- Stateless request handling
- Explicit control over validation, persistence, and side effects
- Direct integration with Cloudflare-native services (D1, Workers, Cron)

The frontend communicates with the backend exclusively through these HTTP endpoints (e.g. `/api/waitlist`, `/api/waitlist/count`).

## Consequences

### Positive
- Minimal runtime and deployment complexity
- Very low latency via edge execution
- No framework lock-in or hidden abstractions
- Clear and explicit control over request lifecycle
- Easy reasoning about performance and failure modes
- Strong alignment with the minimal frontend stack

### Negative
- More manual code for validation and structure
- Fewer built-in abstractions for large or complex APIs
- Requires discipline to maintain consistency as the API surface grows
