# ADR-006: Minimal Frontend Stack (Vanilla HTML, CSS, and JavaScript)

## Status
Accepted

## Context
The frontend of the system currently serves a focused purpose:
- Collect waitlist signups
- Display basic dynamic data (e.g. waitlist count)
- Interact with a small number of API endpoints

Introducing a frontend framework (React, Vue, etc.) would add:
- Build tooling and configuration
- Additional runtime complexity
- Higher cognitive load for a small surface area

Performance, simplicity, and ease of iteration are prioritized at this stage.

## Decision
Use a **minimal frontend stack** consisting of:
- Vanilla HTML for structure
- Vanilla CSS for styling
- Vanilla JavaScript for interactivity and API calls

The frontend is hosted via Cloudflare Pages and communicates with backend logic exclusively through HTTP APIs under `/api/*`.

No frontend framework or build step is introduced at this stage.

## Consequences

### Positive
- Very fast load times and minimal client-side overhead
- No build pipeline or framework dependencies
- Simple mental model for frontend behavior
- Easy debugging directly in the browser
- Reduced maintenance cost for a small application

### Negative
- Fewer abstractions for complex UI composition
- Manual management of DOM updates as complexity grows
- Potential future migration cost if a framework becomes necessary
