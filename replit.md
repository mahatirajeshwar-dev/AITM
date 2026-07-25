# SoMart — Your Campus. Your Marketplace.

A closed-campus peer-to-peer marketplace for students: sell, rent, chat, agree on a price, and seal every deal in person with dual-OTP handover verification.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Backend | Node.js 22 + Express |
| Database | PostgreSQL (Replit built-in) via Prisma |
| Auth | JWT in httpOnly cookies, bcrypt, email-domain restriction |

## How to run

The app is configured to start automatically via the **"Start application"** workflow.

```bash
# Manual start (production mode, port 5000):
PORT=5000 npm run start

# Development mode (Express :3000 + Vite dev server :5173 with HMR):
npm run dev
```

### First-time / reset setup
```bash
npm install           # install deps + generates Prisma client
npx prisma db push    # push schema to the connected PostgreSQL database
node prisma/seed.js   # seed demo data (12 students, 26 listings, transactions)
npm run build         # build React frontend into client/dist
```

## Demo credentials (after seeding)

- **Student:** `aarav.sharma@bitsom.edu.in` / `Student@123` (all 12 seeded users share this password)
- **Admin:** go to `/admin/login` → `admin` / `Admin@1234` (from `ADMIN_USERNAME` / `ADMIN_PASSWORD` env vars)

## Environment variables

Set in Replit Secrets. Key vars:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (auto-set by Replit DB) |
| `SESSION_SECRET` | JWT signing secret |
| `ALLOWED_EMAIL_DOMAIN` | Campus domain for signup (default: `bitsom.edu.in`) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Admin login credentials |
| `EMAIL_SERVICE_API_KEY` | Email provider key (empty = dev mode, OTPs logged to console) |
| `OTP_EXPIRY_MINUTES` | OTP lifetime (default: 30) |
| `PORT` | Server port (workflow sets 5000) |

## Project structure

```
somart/
├─ server/            Express API
│  ├─ routes/         /api/auth /api/listings /api/transactions /api/messages /api/admin
│  ├─ middleware/     JWT session, verified-user & admin guards, audit logging
│  └─ lib/            prisma client (pg adapter), OTP generation, notifications
├─ client/            React + TS + Vite + Tailwind SPA
├─ prisma/            schema.prisma, seed.js, setup-db.js (SQLite only)
├─ uploads/           user-uploaded listing images
```

## User preferences

- Keep existing project structure and stack.
