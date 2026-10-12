# NutriTrack

A full-stack calorie & nutrition tracker: Node/TypeScript/Express/Drizzle/PostgreSQL backend,
React/TypeScript/Vite/Tailwind frontend.

## Fourth pass: the "something feels off and incomplete" round

The feedback was a feeling, not a bug report, so this pass started by reading
the code for what a real nutrition tracker does that this one didn't, and
**reproducing each suspicion with a test before fixing it**:

- **Logged recipes never appeared on Today.** Logging a recipe wrote to
  `recipe_logs`; Today read only `food_logs`. The page said "Logged to today"
  and then showed nothing, while Progress *did* count it (the probe showed
  Today = 0 entries, Progress = 130 kcal for the same meal). **Fixed** with a
  unified `/diary` endpoint that returns foods and recipes together, with
  edit and delete for both.
- **A 24-hour time bomb.** "A log can't be in the future" was computed once at
  server start, so after about a day of uptime *every* new log would have been
  rejected. Reproduced by simulating a 3-day-old server. **Fixed**: bounds are
  evaluated per request.
- **No way to set a target.** The ring showed an empty circle and nothing
  pointed anywhere. **Fixed**: a 3-step setup wizard (about you, goal, review)
  that shows the calculation and lets you accept it or type your own number;
  manual targets in Settings; target history. Registration now lands in it.
- **The diary only ever showed today.** Added day navigation (previous / next
  / pick a date), and logging to the day you're viewing. Added per-meal
  sections with subtotals, per-entry macros, units on every amount (it said
  "100", not "100 g"), recent foods for one-tap re-logging, and adding recipes
  from the same panel.
- **Inputs with their own `className` lost their border and padding** (search
  bar, quantity boxes, inline edit). Fixed.
- **A real race in the new wizard, found by its test**: pre-fill from saved
  data could land after you'd started typing and blank your input.
- **Look and feel**: logo, nav icons, a deep-green summary card with
  macro-coloured bars, a brand panel on the sign-in screens, account chip,
  mobile tab bar with icons.
- **Account & security**: eye toggles on every password field, a strength
  meter, change password (signs out other devices), change email (notifies the
  old address), active devices with sign-out, email-verification banner with
  resend, and login lockout (5 wrong passwords, 15 minutes, same response as a
  wrong password so it can't be used to find accounts).

Testing: `cd backend && npm test` (74 tests, needs Postgres) and
`cd frontend && npm test` (34 tests; mounts the real pages against a mocked
API and drives them: add to a past day, remove with rollback, the wizard, the
password flows). **Not covered:** I could not run a real browser in the build
environment, so visual layout/spacing, the native date picker, and
mobile-viewport behaviour are unverified. Please eyeball those.

### Upgrading an existing local copy

Copy over `backend/src`, `backend/tests`, `backend/drizzle` (a new migration
adds columns and relaxes two constraints; it is additive and keeps your data),
`frontend/src`, `frontend/tests`, `frontend/package.json` and
`frontend/vite.config.ts`. **Do not overwrite your `backend/.env`** (add
`RATE_LIMIT_ACCOUNT_MAX=10` if you like; it has a default). Then:

```
cd backend  && npm install && npm run db:migrate && npm run dev
cd frontend && npm install && npm run dev
```

## Third pass: closing the "doesn't feel like a standard app" gap

A user reported the app felt laggy and didn't match conventions they expect
from apps like this. Investigated and fixed for real, not just reworded:

- **The password-reset email linked to pages that didn't exist.** The
  mailer generated a real link to `/reset-password?token=...`, but the
  frontend had no route for it — clicking it silently redirected to the
  dashboard and lost the token. There was also no "Forgot password?" link
  on the login page at all. **Fixed**: added `ForgotPassword`,
  `ResetPassword`, and `VerifyEmail` pages, wired the routes, added the
  login-page link, added a resend-verification endpoint. Verified live:
  extracted a real reset token from the dev-mode email log, confirmed the
  old password stopped working and the new one logged in.
- **`unitPref` (metric/imperial) was in the database, the API, and the
  TypeScript types — and used nowhere in the UI.** Weight and height were
  always shown and entered in kg/cm regardless of what was stored. **Fixed**:
  added a real unit toggle in Settings, and Weight/Settings now convert
  for display and input while the API still stores canonical kg/cm.
  `targetWeightKg` had the same problem (modeled, never surfaced) and got
  the same fix.
- **The actual cause of the reported "lag" was architectural, not a slow
  backend**: every page did its own fetch on every mount with zero caching,
  so switching tabs re-showed a full loading skeleton every time, even for
  a page visited seconds earlier. **Fixed**: introduced TanStack Query as a
  proper caching layer across every page, with optimistic updates on
  delete/edit actions backed by real rollback-on-error, not just immediate
  UI assumptions.
- **The AI quick-add feature had no way to reach it** — the route existed,
  nothing linked to it. **Fixed**: added it to the sidebar nav and as a
  button next to "Add food" on Today.
- **Logged food entries could only be deleted and re-added, never edited.**
  **Fixed**: inline quantity editing on each log row.
- **"Add food" always defaulted to Breakfast regardless of time of day.**
  **Fixed**: defaults based on the current hour, like standard apps do.

One thing worth knowing: wiring in a real caching layer meant re-checking
every mutation's cache invalidation by hand — e.g. the AI quick-add flow
previously navigated to Today after saving without invalidating the logs
cache, which would have shown stale data under the new caching model even
though it worked fine before caching existed. Caught and fixed as part of
this pass, not left for someone to find later.

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
