# NutriTrack Backend

## Run locally

```bash
cp .env.example .env        # fill in real secrets
docker compose up -d        # starts Postgres
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev                 # http://localhost:4000
```

## Test

```bash
npm test
```

`tests/calc.service.test.ts` is pure-function unit tests for the BMR/TDEE/macro
engine (22 cases: boundaries, decimals, NaN/Infinity, unit-conversion round
trips) — these need no database and are the ones I could actually execute
in this sandbox (see note below).

## Known limitation from the build environment

This project was scaffolded in a network-restricted sandbox that cannot reach
`binaries.prisma.sh`, so `npx prisma generate` could not complete here, and
`@prisma/client`'s generated types weren't available for the full-project
`tsc --noEmit` check. Every remaining type error in the last check I ran is
exactly the un-generated-client shape (`Module "@prisma/client" has no
exported member 'MealType'`, etc.) — nothing else. Everything not touching
Prisma types (the calc engine, all zod schemas, express wiring, pino-http
interop) compiles and the calc engine's 22 tests pass. Run `npx prisma
generate` first thing on a normal machine and this goes away.

## What's implemented

Auth (register/verify/login/refresh-rotation/logout/password-reset),
profile + append-only goal history, weights, foods (ownership-scoped),
food logging (snapshotted, idempotency-key dedup), recipes
(ingredient-based, so circular references are structurally impossible),
AI natural-language parsing (stub provider behind a swappable interface,
strict bounds validation, mandatory review-before-commit), data export
(JSON/CSV, short-lived signed download), account deletion (explicit
ordered deletion, password re-auth required), minimal admin RBAC for
food verification, daily progress rollups.

## Not yet built

- Real LLM call behind `AiProvider` (currently `StubAiProvider` returns
  `{ items: [] }` — swap in an Anthropic/OpenAI call that returns the same
  shape; `parseAndValidate` re-validates whatever comes back regardless)
- Integration/security test suite (IDOR, rate-limit, injection) — Phase 8
- Frontend
- OpenAPI docs, deployment config, monitoring/backup setup — Phases 9/10
