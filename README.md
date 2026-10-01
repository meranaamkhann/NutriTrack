# NutriTrack

A full-stack calorie & nutrition tracker: Node/TypeScript/Express/Drizzle/PostgreSQL backend,
React/TypeScript/Vite/Tailwind frontend.

## Run it

```bash
# 1. Database
cd backend
docker compose up -d          # or use a local Postgres — see .env.example
cp .env.example .env          # generate a real JWT_ACCESS_SECRET: openssl rand -hex 32
npm install
npm run db:generate
npm run db:migrate
npm run dev                   # http://localhost:4000

# 2. Frontend (separate terminal)
cd frontend
npm install
npm run dev                   # http://localhost:5173, proxies /api/* to :4000
```

Open http://localhost:5173, register, and use the app. With no SMTP
configured, the verification/reset email is printed to the backend's
console (with a working link) instead of actually being sent — see
`backend/.env.example` for how to turn on real email, a real AI provider,
and a shared Redis-backed rate limit store for multi-instance deployments.

## Verified, not just written

Every piece below was actually run against a live PostgreSQL instance and a
live running server in the environment this was built in:

- `npm test` in `backend/`: **51 passing tests** — 22 unit tests for the
  BMR/TDEE/macro engine, 8 auth integration tests over real HTTP, 21
  security tests (IDOR, snapshot-immutability of historical logs, append-only
  goal history, account-deletion re-auth, admin audit logging, concurrent
  duplicate-submission protection, malformed/SQL-injection-shaped input,
  rate limiting).
- A real concurrency test: two genuinely simultaneous identical log
  requests, fired via raw concurrent `curl` (not just the test harness),
  return the same row — confirmed over repeated runs.
- `npm run build` in both `backend/` and `frontend/` completes clean.
- The frontend dev server was run against the live backend through its
  actual proxy config.

## This has been hardened once already

A first pass left several things explicitly documented as open gaps rather
than silently incomplete (see `docs/SECURITY.md`). A second pass closed
most of them for real:

- **Scheduled export cleanup** — was a function nobody called; now runs on
  an interval.
- **Real email sending** — was token-in-API-response; now sends via SMTP
  when configured, with a visible, working dev-mode fallback otherwise.
- **A real AI provider** — was an always-empty stub; now calls the
  Anthropic API when `ANTHROPIC_API_KEY` is set, with the same
  validate-before-trusting handling of its output as before. Fails closed
  (returns no items) on any error, timeout, or malformed response — but
  wasn't exercised against a live model in this build environment, since no
  key was available here.
- **Admin actions are now audited** — a dedicated, append-only
  `admin_audit_log` table, not just implicit HTTP request logs.
- **The duplicate-submission fix caught its own bug**: the first attempt
  used a select-then-insert check, which is a textbook TOCTOU race under
  real concurrency — confirmed by actually racing it and getting two rows.
  It's now enforced with a database unique constraint instead, which closes
  the race rather than narrowing the window.
- **Rate limiting can now share state across instances** via Redis — set
  `REDIS_URL`; falls back to in-memory otherwise.

Two findings from the first audit are left open on purpose, not by
oversight (no per-account login lockout beyond IP rate limiting; login is
allowed before email verification) — see `docs/SECURITY.md` for why.

## Frontend UX pass

Also addressed in this round, since "it technically works" and "it feels
right to use" are different bars:

- Toast notifications for action feedback instead of ad hoc inline banners.
- Loading skeletons instead of plain "Loading…" text.
- Optimistic UI updates on delete (food logs, weight entries) with
  rollback-and-toast on failure, so the UI doesn't feel laggy waiting on
  a round trip for an action that almost always succeeds.
- A top-level error boundary, so a render error shows a recoverable screen
  instead of a blank page.
- A client-generated idempotency key on the food-log submission, paired
  with the server-side fix above (belt and suspenders: the server is
  correct even if the client never sends one, and the client sending one
  means even the deterministic-hash edge cases are avoided).

## Architecture notes

- **Why Drizzle instead of Prisma:** Prisma's CLI needs to fetch engine
  binaries from `binaries.prisma.sh` for every command, including `prisma -v`.
  That was unreachable from the environment this was built in. Drizzle is
  pure npm with no binary fetch, so the full migration + test suite could
  actually be run and verified.
- **Ownership checks live in the service layer**, not just controllers or
  frontend routing.
- **Historical data never gets silently rewritten**: food/recipe logs
  snapshot their nutrition values at write time; goal calculations are
  appended to `goals_history`, never mutated in place.
- **Duplicate-submission protection is enforced at the database level**
  (a unique constraint), not just checked in application code before an
  insert — the difference matters under real concurrency, and this project
  found that out the hard way once already (see `docs/SECURITY.md`).

## What's here vs. what a real production launch still needs

Built: auth, profile + append-only goal history, food database, food
logging with snapshotting and race-safe deduplication, recipes, an AI
natural-language quick-add wired to a real provider with mandatory human
review before anything is saved, weight tracking, progress rollups, data
export, account deletion, admin RBAC with audit logging, real email
sending, Redis-ready rate limiting, and a full React frontend with toast
feedback, skeleton loading states, and optimistic updates.

Not built, and worth knowing before calling this production-ready: the
Anthropic integration hasn't been tested against a live model (no key was
available in this build environment — the code path is verified to compile
and fail safe, not verified to produce good parses), the Redis rate-limit
store hasn't been tested against a real Redis instance, no CI pipeline, no
containerized deployment config, no monitoring/alerting, no automated
database backups, no formal penetration test, no per-account login lockout,
and login is intentionally allowed before email verification. See
`docs/SECURITY.md` for the full, honest audit.
