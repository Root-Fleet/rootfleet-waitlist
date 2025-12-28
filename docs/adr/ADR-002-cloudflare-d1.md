# ADR-002: Cloudflare D1 for Waitlist Persistence

## Status
Accepted

## Context
The waitlist requires persistent storage with strong consistency.
The data model is simple and does not require complex relational queries.

Operating a managed PostgreSQL or MySQL instance would increase cost and
operational complexity beyond current needs.

## Decision
Use **Cloudflare D1** (SQLite-compatible) as the primary persistence layer.

## Consequences
### Positive
- Tight integration with Workers
- Simple SQL-based schema
- Strong consistency
- Easy local development via Wrangler

### Negative
- Fewer advanced features compared to full RDBMS
- Schema evolution must be handled carefully via migrations
