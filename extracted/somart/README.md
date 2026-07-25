# SoMart — Your Campus. Your Marketplace.

A closed-campus peer-to-peer marketplace for students: **sell**, **rent**, chat, agree on a price, and seal every deal in person with **dual-OTP handover verification**. SoMart never processes payments — it only connects students.

> **Disclaimer:** SoMart only facilitates connections between students. All payments and settlements are handled directly between users. The platform does not process or guarantee payments and is not responsible for payment-related disputes.

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Backend | Node.js + Express |
| Database | SQLite (dev, zero-setup) / **PostgreSQL** (production) via **Prisma** |
| Auth | JWT in httpOnly cookies, bcrypt password hashing, email-domain restriction |

## Features

- Institutional-email-only signup (domain configurable via `ALLOWED_EMAIL_DOMAIN`), email verification, forgot/reset password
- Sale & rental listings with categories, conditions, images, search, filters, sorting
- Buyer/seller deal workflow: request → accept → both confirm the agreed amount → **dual OTP handover** → completed
- Rental workflow with dates, deposit, rental tracking, and a **second dual-OTP verification at return**
- OTPs: 6-digit CSPRNG, stored **hashed**, expiring, attempt-limited, per-party regeneration, never shown to the opposite party
- Internal messaging, in-app notifications, ratings & reviews (only for OTP-completed deals), reporting system
- Admin: separate `/admin/login`, users/listings/transactions management, reports queue, analytics with charts, audit log; admins **cannot** complete transactions (cancel-override only, reason required + audited)
- Soft deletion everywhere — sold/removed items disappear from the marketplace but history is preserved

## Quick start (local / Replit)

```bash
npm install                # installs server deps + generates Prisma client
npm run db:setup           # creates SQLite db (prisma/dev.db) from prisma/init.sql
npm run db:seed            # demo data: 12 students, 26 listings, transactions
npm run dev                # Express on :3000 + Vite dev server on :5173
```

Open http://localhost:5173 (dev) — the Vite proxy forwards `/api` and `/uploads` to :3000.

**Production:**

```bash
npm run build              # builds client into client/dist
npm run start              # Express serves API + built frontend on :3000
```

### Demo credentials (after seeding)

- **Student:** any seeded user, e.g. `aarav.sharma@bitsom.edu.in` / `Student@123` (all 12 use the same password)
- **Admin:** go to `/admin/login` → username/password from `ADMIN_USERNAME` / `ADMIN_PASSWORD` env vars (defaults in `.env`: `admin` / `Admin@1234`)

## Environment variables

Copy `.env.example` to `.env` (a dev `.env` is included):

```
DATABASE_URL="file:./dev.db"        # or postgresql://user:pass@host:5432/somart
SESSION_SECRET=<long random string>
ALLOWED_EMAIL_DOMAIN=bitsom.edu.in  # change the allowed campus domain here
ADMIN_USERNAME=admin
ADMIN_PASSWORD=Admin@1234
EMAIL_SERVICE_API_KEY=              # empty = dev mode (codes logged to console & returned in dev responses)
OTP_EXPIRY_MINUTES=30
OTP_MAX_ATTEMPTS=5
PORT=3000
```

On **Replit**, set these in **Secrets** — never hardcode them. `.replit` is included: the deploy build runs install → client build → db setup → seed, and serves with `npm run start` on port 3000 → 80.

## Switching to PostgreSQL (production)

1. In `prisma/schema.prisma` change `provider = "sqlite"` → `provider = "postgresql"` (the schema uses no SQLite-only features).
2. Set `DATABASE_URL` to your Postgres connection string (Replit DB / Neon / Supabase).
3. Run `npx prisma db push` (or `npx prisma migrate dev --name init`) then `npm run db:seed`.

`server/lib/prisma.js` auto-detects: `file:` URLs use the better-sqlite3 driver adapter; anything else uses the standard Prisma client.

> **Note on the SQLite dev setup:** the project uses Prisma's `queryCompiler` + `driverAdapters` (no native engine binaries needed), which also makes it work in offline/restricted environments. `npm run db:setup` applies `prisma/init.sql` directly; on Postgres you use normal Prisma migrations instead.

## Prisma migrations

- Dev (SQLite): `npm run db:setup` (DDL in `prisma/init.sql`, mirrors `schema.prisma`)
- Postgres: `npx prisma migrate dev --name init` / `npx prisma db push`
- Regenerate client after schema changes: `npx prisma generate`
- Seed: `npm run db:seed` (idempotent — wipes and re-creates demo data)

## Project structure

```
somart/
├─ server/            Express API (auth, listings, transactions, messages, admin…)
│  ├─ routes/         /api/auth /api/listings /api/transactions /api/messages /api/admin …
│  ├─ middleware/     JWT session, verified-user & admin guards, audit logging
│  └─ lib/            prisma client, OTP generation/hashing, notifications
├─ client/            React + TS + Vite + Tailwind SPA (built into client/dist)
├─ prisma/            schema.prisma, init.sql, setup-db.js, seed.js
├─ uploads/           user-uploaded listing images (served at /uploads)
├─ .env.example  .replit  package.json
```

## Key API routes (all relative, no hardcoded hosts)

- `POST /api/auth/signup|login|logout|verify-email|forgot-password|reset-password`, `POST /api/auth/admin/login`
- `GET/POST/PUT/DELETE /api/listings`, `GET /api/listings/home`
- `POST /api/transactions` (I'm Interested / Request to Rent), `/respond`, `/agree`, `/otp/regenerate`, `/otp/verify`, `/start-return`, `/cancel`, `/review`
- `GET/POST /api/messages…`, `GET /api/notifications`, `POST /api/reports`
- `GET /api/admin/users|listings|transactions|reports|analytics|audit-logs`

## Security & business rules (enforced server-side)

Only verified institutional emails can transact; users can't buy/rent their own listings; one active deal per item; transactions complete **only** when both handover OTPs verify (rentals additionally require both return OTPs); OTPs are hashed, expire, and are attempt-limited; only participants can access a transaction; only owners can edit listings; admin routes require the admin role; admin overrides need a reason and are audit-logged; critical state changes run inside DB transactions.
