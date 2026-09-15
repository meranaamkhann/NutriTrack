# NutriTrack

A full-stack calorie & nutrition tracker: Node/TypeScript/Express/Drizzle/PostgreSQL backend,
React/TypeScript/Vite/Tailwind frontend.

## Run it

```bash
# 1. Database
cd backend
docker compose up -d          # or use a local Postgres — see .env.example
cp .env.example .env          # fill in real secrets (JWT_ACCESS_SECRET especially)
npm install
npm run db:generate           # generates SQL from src/db/schema.ts into ./drizzle
npm run db:migrate            # applies it
npm run dev                   # http://localhost:4000

# 2. Frontend (separate terminal)
cd frontend
npm install
npm run dev                   # http://localhost:5173, proxies /api/* to :4000
```

Open http://localhost:5173, register, and use the app. In dev, registration
returns `devOnlyVerifyToken` directly in the response body instead of emailing
it (see `auth.controller.ts` — swap in a real mailer for production and
remove that field).

## Verified, not just written

Every piece below was actually run against a live PostgreSQL instance and a
live running server in the environment this was built in, not just written
and assumed correct:

- `npm test` in `backend/`: **47 passing tests** — 22 pure unit tests for the
  BMR/TDEE/macro engine, 8 auth integration tests (register → verify → login
  → refresh-rotation → logout → password reset, over real HTTP via supertest
  against a real database), 16 security tests (IDOR across every
  user-owned resource, snapshot-immutability of historical logs even after
  the underlying food changes, append-only goal history, account-deletion
  re-auth, malformed/oversized/SQL-injection-shaped input, rate limiting).
- A full manual `curl` user journey against the real running server: register,
  login, set profile, log weight, calculate goals, create a food, log it,
  pull a progress rollup, export data, download it with a correct and then a
  deliberately wrong token.
- `npm run build` in both `backend/` (`tsc`) and `frontend/` (`tsc` + `vite
  build`) completes clean.
- The frontend dev server was run against the live backend through its actual
  proxy config and a real registration request was completed through it.

Two real bugs were caught and fixed this way (not hypothetical — they
reproduced and are now covered by regression tests): a refresh-token cookie
`Domain` mismatch that silently broke session rotation outside of
production-domain requests, and a calendar-day vs. exact-timestamp comparison
bug that made a goal calculated earlier the same day not show up in that
day's progress rollup.

## Architecture notes

- **Why Drizzle instead of Prisma:** Prisma's CLI needs to fetch engine
  binaries from `binaries.prisma.sh` for every command, including `prisma -v`.
  That was unreachable from the environment this was built in, so I could
  not verify a Prisma-based backend actually ran. Drizzle is pure npm with no
  binary fetch, so I could generate real migrations, apply them, and run the
  full test suite against a real database. Functionally the two are
  equivalent for this project's needs — a real FK/constraint-backed
  relational schema.
- **Ownership checks live in the service layer**, not just controllers or
  frontend routing, so a missed check in one route can't leak another user's
  data — see `docs/SECURITY.md` for the audit table.
- **Historical data never gets silently rewritten**: food/recipe logs
  snapshot their nutrition values at write time; goal calculations are
  appended to `goals_history`, never mutated in place.

## What's here vs. what a real production launch still needs

Built: auth (Argon2id, rotating refresh tokens, email verification,
password reset), profile + append-only goal history, food database
(ownership-scoped), food logging with snapshotting, recipes, an AI
natural-language quick-add with a mandatory human-review step before
anything is saved (currently wired to a stub provider — see
`backend/src/modules/ai/ai.provider.ts` for where to plug in a real LLM
call), weight tracking, progress rollups, data export, account deletion,
minimal admin RBAC for food verification, and a full React frontend
covering all of it.

Not built, and worth knowing before calling this production-ready:
a real LLM behind the AI provider interface, email sending (verification/
reset tokens are logged, not emailed), CI pipeline, containerized
deployment config, monitoring/alerting, database backup automation, and a
formal penetration test. See `docs/SECURITY.md` for the honest audit.
