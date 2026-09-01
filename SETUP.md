# KCT Financials — Setup Guide

> Fork of [BigCapital](https://github.com/bigcapitalhq/bigcapital) — customized for FedEx Ground ISP accounting.  
> Target deployment: `financials.kingcapitalgrp.com`

---

## Table of Contents

1. [Running Locally with Docker](#running-locally-with-docker)
2. [What Was Stripped from the UI](#what-was-stripped)
3. [FedEx ISP Chart of Accounts (COA) Seed](#fedex-isp-coa-seed)
4. [Branding & Logo](#branding--logo)
5. [Plaid Bank Feed Integration](#plaid-bank-feed-integration)
6. [Required Docker Env Vars — Production](#required-docker-env-vars--production)
7. [Stack Notes](#stack-notes)

---

## Running Locally with Docker

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) + Docker Compose
- On macOS without Docker Desktop: [Colima](https://github.com/abiosoft/colima)

```bash
# Start Colima if not running (macOS only)
colima start

# Clone (or use existing checkout)
cd ~/.openclaw/workspace/kct-financials

# Configure environment
cp .env.example .env
# Edit .env — set BASE_URL and mail vars at minimum (see below)

# Pull prebuilt images (~1.5 GB) — uses GitHub Container Registry
docker compose --file docker-compose.prod.yml pull

# Start all services
docker compose --file docker-compose.prod.yml up -d

# Verify
docker ps
```

The app is available at **http://localhost:8000** once all containers are running.

> **First run:** Create your account at the signup page — no default credentials are provided.

### Database Migration

A `database_migration` container runs automatically on first start and applies all schema migrations. It exits after completion. Verify it finished cleanly:

```bash
docker ps -a | grep migration        # find container ID
docker logs -f <migration_container_id>
```

### Stopping / Restarting

```bash
docker compose --file docker-compose.prod.yml down   # stop
docker compose --file docker-compose.prod.yml up -d  # start again
```

---

## What Was Stripped

Changes are purely **UI nav suppressions** — backend code is untouched and can be re-enabled via git revert if needed.

| Module Removed | Reason | Where to Re-enable |
|---|---|---|
| **Items / Inventory** (sidebar group + Items overlay) | ISPs don't carry physical inventory | `packages/webapp/src/constants/sidebarMenu.tsx` — restore the `Sales & Inventory` group |
| **Inventory Adjustments** (sub-item) | Part of inventory module | Same file |
| **Inventory reports** (Inventory Item Details, Inventory Valuation) | No physical inventory | Same file — restore the `sidebar.inventory` group in Reports |
| **Tax Rates** (Accounting nav item) | International tax complexity not needed for US ISP ops | Same file — restore the `Tax Rates` link in the Financial overlay |
| **Sales Tax Liability Summary** (Reports > Taxes group) | US ISP; single-state or simple tax | Same file — restore the `Taxes` group in Reports |
| **Purchases by Items / Sales by Items** (Reports) | Item-level reports irrelevant without inventory | Same file |
| **Point of Sale** | Not present in BigCapital upstream | N/A |
| **Manufacturing** | Not present in BigCapital upstream | N/A |

**File changed:** `packages/webapp/src/constants/sidebarMenu.tsx`

All comments marking stripped sections are preserved in that file for easy reference.

---

## FedEx ISP Chart of Accounts (COA) Seed

### Current seed location
```
packages/server/src/database/tenant/seeds/data/accounts.ts   ← account data (401 lines)
packages/server/src/database/tenant/seeds/core/20190423085242_seed_accounts.ts  ← seeder that loads it
```

### What it does
The seeder runs on new organization creation and inserts the default COA into MySQL. It reads `AccountsData` from `accounts.ts` and maps each entry with the org's base currency and a `seededAt` timestamp.

### Replacing with a FedEx ISP COA

1. Open `packages/server/src/database/tenant/seeds/data/accounts.ts`
2. Replace the `AccountsData` export array with FedEx ISP-specific accounts. Use the existing object shape:
   ```ts
   {
     name: 'Transportation Revenue',   // account name (run through i18n)
     slug: 'transportation-revenue',
     account_type: 'income',           // BigCapital account type key
     code: '4000',
     description: '',
     active: 1,
     index: 1,
     predefined: 1,
   }
   ```
3. Account type keys available: `income`, `other-income`, `cost-of-good-sold`, `expense`, `other-expense`, `other-current-asset`, `fixed-asset`, `other-asset`, `other-current-liability`, `long-term-liability`, `equity`, `accounts-payable`, `accounts-receivable`, `bank`, `cash` (see server migrations for full enum).
4. The seed only runs on **new org creation** — existing orgs won't be affected. To re-seed an existing org, run a manual migration.

### Suggested FedEx ISP top-level accounts (starting point)

```
4000 Transportation Revenue
4100 Fuel Surcharge Revenue
4200 Other Revenue

5000 Driver Labor (payroll)
5100 Fuel
5200 Vehicle Lease / Depreciation
5300 Vehicle Maintenance & Repairs
5400 Insurance (Commercial Auto, WC, GL)
5500 FedEx Package Handling Fees
5600 Admin & Overhead

1000 Checking (Operating)
1010 Payroll Account
1020 Fuel Card Clearing
2000 Accounts Payable
2100 Payroll Liabilities
3000 Owner's Equity
```

---

## Branding & Logo

### Already changed
| File | Change |
|---|---|
| `packages/webapp/index.html` | `<title>KCT Financials</title>`, updated meta description |
| `packages/webapp/package.json` | `name: @kct-financials/webapp` |
| `packages/server/package.json` | `name: @kct-financials/server` |
| `package.json` (root) | `name: kct-financials-monorepo` |

### Remaining branding work

| What | Where |
|---|---|
| **App logo** (splash screen & sidebar) | `packages/webapp/src/components/Dashboard/BigcapitalLoading.tsx` — replace `icon="bigcapital"` / `icon="bigcapital-alt"` with an `<img>` pointing to your logo |
| **Logo icon SVG** | `packages/webapp/src/icons/` — look for the BigcapitalIcon component; replace SVG path data |
| **Favicon** | `packages/webapp/public/favicon-32.ico`, `logo192.png`, `logo512.png` |
| **Sidebar background color** | `packages/webapp/src/style/_variables.scss` → `--color-sidebar-background: #01115e` (dark navy) |
| **Primary accent color** | Same file → `--color-primary: #8abbff` (light blue, dark mode) / `--color-primary` in light section |
| **"Bigcapital" text in loading component** | `BigcapitalLoading.tsx` — the icon name references (`bigcapital`, `bigcapital-alt`) |

---

## Plaid Bank Feed Integration

Plaid is already wired up in both the server and webapp. It's opt-in via env vars — if you leave them blank, the bank sync button just won't appear.

### Server files
- `packages/server/src/common/config/plaid.ts` — config reads env vars
- Migrations: `20240201160214_create_plaid_items_Table.ts`, `20240716114732_add_plaid_item_id_to_accounts_table.ts`, etc.

### Frontend files
- `packages/webapp/src/containers/Banking/Plaid/PlaidLanchLink.tsx` — Plaid Link modal trigger
- `packages/webapp/src/containers/CashFlow/CashFlowAccounts/CashflowAccountsPlaidLink.tsx` — cashflow list integration
- `packages/webapp/src/containers/CashFlow/Icons/PlaidIcon.tsx` — icon

### To enable Plaid
```env
PLAID_ENV=sandbox           # or 'development' for real accounts
PLAID_CLIENT_ID=your_id
PLAID_SECRET=your_secret
PLAID_LINK_WEBHOOK=https://financials.kingcapitalgrp.com/api/webhooks/plaid
```

---

## Required Docker Env Vars — Production

Copy `.env.example` → `.env` and set at minimum:

```env
# JWT (required — change this!)
APP_JWT_SECRET=<random 32+ char string>
JWT_SECRET=<different random string>

# Database passwords (set once; cannot change after first boot without wiping volumes)
DB_PASSWORD=<strong password>
DB_ROOT_PASSWORD=<strong root password>

# Mail (required for email notifications, invites, invoice sends)
MAIL_HOST=smtp.example.com
MAIL_USERNAME=noreply@kingcapitalgrp.com
MAIL_PASSWORD=<password>
MAIL_PORT=587
MAIL_SECURE=false
MAIL_FROM_NAME=KCT Financials
MAIL_FROM_ADDRESS=noreply@kingcapitalgrp.com

# App URL
BASE_URL=https://financials.kingcapitalgrp.com

# Sign-up restriction (lock down to KCT domain only)
SIGNUP_ALLOWED_DOMAINS=kingcapitalgrp.com
# or restrict to specific emails:
# SIGNUP_ALLOWED_EMAILS=josh@kingcapitalgrp.com,ichiro@kingcapitalgrp.com

# PDF printing (Gotenberg — already configured in docker-compose.prod.yml)
GOTENBERG_URL=http://gotenberg:3000
GOTENBERG_DOCS_URL=http://server:3000/public/

# Object storage (Garage S3-compatible — configured in docker-compose.prod.yml)
GARAGE_RPC_SECRET=<openssl rand -hex 32>
GARAGE_ADMIN_TOKEN=<openssl rand -hex 16>
S3_ACCESS_KEY_ID=<generated after first Garage setup run>
S3_SECRET_ACCESS_KEY=<generated after first Garage setup run>

# Plaid (optional — leave blank to disable bank sync)
PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=sandbox
```

### Garage (S3) first-time setup
After first `docker compose up -d`, run the setup script to initialize Garage and get S3 keys:
```bash
docker compose exec garage bash /garage-setup/setup.sh
# Copy the printed S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY into .env
# Then restart: docker compose --file docker-compose.prod.yml restart
```

---

## Stack Notes

- **Database:** MySQL/MariaDB (managed by Docker) — separate from KCT's Supabase. Integration point = BigCapital REST API (`/api/...`).
- **Multi-tenancy:** BigCapital supports multiple organizations per install. Each org gets its own tenant database (`bigcapital_tenant_<id>`).
- **Auth:** JWT-based. No SSO yet — future work.
- **Background jobs:** Redis queue (already in docker-compose).
- **PDF generation:** Gotenberg (headless Chrome).
- **File storage:** Garage (self-hosted S3-compatible) for attachments.
- **Subscription/billing:** LemonSqueezy integration exists upstream but is not required — can leave `LEMONSQUEEZY_*` vars blank.
- **Monorepo:** Lerna + pnpm workspaces. `packages/webapp` = React/Vite frontend. `packages/server` = Node/NestJS backend.
- **Upstream branch:** `main` (synced from `bigcapitalhq/bigcapital`). KCT-specific changes on `main` via PR from `develop`.

---

## Future Work

- [ ] Replace default BigCapital COA with FedEx ISP COA (`packages/server/src/database/tenant/seeds/data/accounts.ts`)
- [ ] Logo + favicon replacement
- [ ] Sidebar color update (`--color-sidebar-background` → KCT brand color)
- [ ] Point `financials.kingcapitalgrp.com` DNS → server, set `BASE_URL`, configure Nginx/SSL
- [ ] Garage S3 setup script for production
- [ ] Configure `SIGNUP_ALLOWED_DOMAINS` to lock signups to `kingcapitalgrp.com`
- [ ] Evaluate Plaid for bank feed (connect KCT operating accounts)
- [ ] BigCapital REST API → Supabase bidirectional sync design
- [ ] SaaS tenant isolation design for resell to other ISPs
