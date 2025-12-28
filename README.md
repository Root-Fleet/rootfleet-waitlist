# Rootfleet Waitlist

Production-ready waitlist system for **Rootfleet**, built on **Cloudflare Pages** with **Pages Functions (Workers runtime)**, **D1** for persistence, and **Resend** for transactional email.

This repository represents a **stable, deployed system** currently used in production.

---

## Live URLs

- https://waitlist.rootfleet.com
- https://rootfleet.com
- https://www.rootfleet.com

All domains point to the same Cloudflare Pages deployment.

---

## What This System Does

The Rootfleet waitlist system:

- Serves a static landing page for early access signups
- Collects waitlist entries via a serverless API
- Stores entries in a Cloudflare D1 database
- Sends confirmation emails via Resend
- Displays a live waitlist count for social proof
- Is designed to be rollback-safe and operationally simple

---

## High-Level Architecture

```text
Browser
  |
  | HTTPS
  v
Cloudflare Pages (static assets)
  |
  | /api/*
  v
Cloudflare Pages Functions (Workers runtime)
  |
  |--> D1 (waitlist persistence)
  |--> Resend (confirmation emails)
```

Key characteristics:
- No traditional servers
- Global edge deployment
- Git-based deployments
- Minimal operational surface area

---

## Tech Stack

### Frontend
- HTML
- CSS
- Vanilla JavaScript
- Served via Cloudflare Pages

### Backend
- Cloudflare Pages Functions
- Workers runtime
- JavaScript (ES Modules)

### Database
- Cloudflare D1 (SQLite-compatible)
- Managed via SQL migrations

### Email
- Resend (transactional)
- Domain-authenticated (SPF, DKIM, DMARC)

### DNS & TLS
- Cloudflare DNS
- TLS handled by Cloudflare

---

## Repository Structure

```text
rootfleet-waitlist/
├─ public/
│  ├─ index.html          # Landing page UI
│  ├─ styles.css          # Styling
│  ├─ app.js              # Client-side logic
│  ├─ favicons / logos
│
├─ functions/
│  └─ api/
│     └─ waitlist/
│        ├─ index.js      # POST /api/waitlist
│        └─ count.js      # GET /api/waitlist/count
│
├─ lib/
│  └─ resend.js           # Resend API wrapper
│
├─ templates/
│  └─ waitlistConfirmationEmail.js
│
├─ migrations/
│  └─ 0001_create_waitlist.sql
│
├─ scripts/
│  └─ rollback-to-stable.sh
│
├─ wrangler.toml
└─ README.md
```

---

## API Overview

### POST `/api/waitlist`

Creates a waitlist entry and sends a confirmation email.

**Request**
```json
{
  "email": "user@example.com",
  "role": "fleet_owner",
  "fleetSize": "1-5",
  "companyName": "Acme Logistics"
}
```

**Behaviour**
- Validates input
- Prevents duplicate signups by email
- Persists entry in D1
- Sends confirmation email

---

### GET `/api/waitlist/count`

Returns the current number of waitlist entries.

```json
{ "count": 42 }
```

Used by the UI for social proof.

---

## Local Development

### Prerequisites
- Node.js 18+
- Wrangler CLI (via `npx`)

### Install
```bash
npm install
```

### Run locally
```bash
npx wrangler pages dev public
```

This starts:
- Static site
- API endpoints
- Local D1 instance

---

## Database (D1)

- Schema is defined in `migrations/`
- Migrations are forward-only
- Email addresses are treated as idempotent identifiers

### Apply migrations locally
```bash
npx wrangler d1 migrations apply DB --local
```

### Apply migrations to production
```bash
npx wrangler d1 migrations apply DB
```

---

## Environment Variables

Configured in Cloudflare Pages settings.

| Variable | Purpose |
|--------|--------|
| `RESEND_API_KEY` | Resend API key |
| `FROM_EMAIL` | Sender address |
| `ENVIRONMENT` | `preview` or `production` |
| `MAINTENANCE_MODE` | Kill switch for new signups |

---

## Production Safety & Rollback

### Stable Production Tag
- `prod-stable-2025-12-28`

### Rollback Strategy

Primary rollback method is **deploying a known-good tag via a rollback branch**.

```bash
./scripts/rollback-to-stable.sh
```

This:
- Creates a branch pointing to the stable tag
- Pushes it to GitHub
- Allows Cloudflare Pages to deploy it immediately

This approach avoids rewriting history and works well under pressure.

---

## Maintenance Mode

New signups can be disabled instantly without redeploying.

- Set `MAINTENANCE_MODE=on` in Cloudflare Pages
- API returns `503 Service Unavailable`
- UI shows a friendly message

Used during incidents or external outages.

---

## Architecture Decision Records (ADR)

Architectural decisions for this system are documented in:

- `docs/adr/`

Each ADR explains **what decision was made**, **why**, and **what trade-offs were accepted**.
---

## Current Status

- ✅ Deployed to production
- ✅ Stable UI and API
- ✅ Rollback-safe
- ✅ Ready for controlled iteration

