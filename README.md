# NutriTrack

A calorie and nutrition tracker: daily diary, food database, recipes, weight and progress tracking, calorie targets calculated from your profile, optional AI quick-add, data export.

**Stack:** React 19 + Vite + Tailwind + TanStack Query (frontend) · Express + TypeScript + Drizzle ORM + PostgreSQL (backend) · Vitest + Supertest (tests).

## Run it

```bash
# 1. Backend
cd backend
cp .env.example .env            # set JWT_ACCESS_SECRET: openssl rand -hex 32
docker compose up -d            # Postgres (or point DATABASE_URL at your own)
npm install
npm run db:migrate
npm run db:seed                 # ~65 starter foods everyone can search; safe to re-run
npm run dev                     # http://localhost:4000

# 2. Frontend (separate terminal)
cd frontend
npm install
npm run dev                     # http://localhost:5173, proxies /api to :4000
```

With no SMTP configured, verification and reset emails are printed in the backend console with a working link. In development the API also returns `devOnlyVerifyToken` from register and change-email so you can click through without email. Real email, the AI parser (`ANTHROPIC_API_KEY`) and a Redis-backed rate-limit store are all switched on in `backend/.env`; see `.env.example`.

**Making an admin:** there is deliberately no endpoint for it. Run
`UPDATE users SET role = 'ADMIN' WHERE email = '...';`

## Tests

```bash
cd backend  && npm test        # 92 tests against a real Postgres (database nutritrack_test)
cd frontend && npm test        # 36 tests
cd frontend && npm run lint && npx tsc -b
```

## How it's built

- **Ownership checks live in the service layer**, not only in controllers or the UI.
- **History is never rewritten.** Food and recipe logs snapshot their nutrition when written, and calorie goals are appended to `goals_history`. Editing a food or a recipe changes future logs only.
- **Duplicate submissions are stopped by the database** (unique `(user, idempotency key)`), not by a check-then-insert.
- **Sessions:** short-lived access token held in memory; a rotating, hashed, HttpOnly refresh cookie. Rotation is transactional with a 10-second grace window for the harmless case of two tabs refreshing at once; replaying a token after that revokes the whole session.
- **No account enumeration:** register, login, lockout, resend-verification and password-reset answer the same way for known and unknown emails.
- **Input handling:** every route validates with Zod, which strips unknown fields. Body-parser and Postgres range errors become 4xx, not 500.
- **Why Drizzle, not Prisma:** pure npm, no engine binary download, so migrations and tests run anywhere.

## Changelog

**Hardening release** (this version)
- Fixed: malformed or oversized JSON returned 500; `PUT /logs/:id` accepted far-future dates; huge portions overflowed to 500; duplicate AI accepts created duplicate logs; concurrent refresh requests could race; admin self-delete returned 500; CSV export ran formulas.
- Changed: changing your email now sends a link to the new address and switches only once it's opened (typos can't lock you out; old links can't verify the new address). Register no longer reveals whether an email is taken. Emails are sent in the background so timing doesn't leak. Calorie targets start at 1,200 kcal, and weight-loss targets are only calculated for adults.
- Added: starter food database (`npm run db:seed`); edit recipes; the CSV export now includes recipe entries; export token travels in an `X-Export-Token` header; request ids in logs match the `x-request-id` response header; audit log is newest-first and paged; per-user rate limiting for signed-in users.
- Cleanup: removed committed `.env`, `node_modules` and stray folders; added `.gitignore`; the redesign is now applied (see `docs/FRONTEND-REDESIGN.md`); removed the unused `AI_PROVIDER_API_KEY` setting.

## What a real launch still needs

Not built or not verified: the Anthropic integration has not been run against a live model, and the Redis rate-limit store hasn't been run against a real Redis. There is no CI, containerised deployment, monitoring or backup setup, no two-factor sign-in, and no third-party penetration test. Starter-food nutrition values are typical reference figures; review them before shipping. Details and open items are in `docs/SECURITY.md`.
