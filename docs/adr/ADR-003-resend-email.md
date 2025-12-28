# ADR-003: Resend for Transactional Email

## Status
Accepted

## Context
The system must send confirmation emails reliably and with good deliverability.
Email reputation, authentication, and observability are critical even at low volumes.

## Decision
Use **Resend** for transactional email delivery.

## Consequences
### Positive
- Clean and simple API
- Good deliverability tooling
- Easy SPF, DKIM, and DMARC setup
- Suitable for early-stage and scaling needs

### Negative
- External dependency for email delivery
- Gmail sender logo (BIMI) requires additional configuration and cost
