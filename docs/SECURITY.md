# Security Audit

Performed against the actual running system (live Postgres, live server,
51 passing tests), not a theoretical review of the code alone. Findings are
reported honestly, including remaining gaps — an audit that finds nothing
is not credible for a system this size. This is the second pass; the first
pass's findings are resolved below with how and verified with what test,
except where noted as still open.

| Severity | Finding | Impact | Location | Fix | Status |
|---|---|---|---|---|---|
| ~~Medium~~ | ~~Export cleanup function existed but was never scheduled~~ | ~~Expired exports would linger on disk~~ | `server.ts` | A `setInterval` now runs `deleteExpiredExportFiles` every 15 minutes, plus once at boot | **Fixed** |
| ~~Medium~~ | ~~Rate limiting used only an in-memory store~~ | ~~Wrong effective limit once horizontally scaled~~ | `middleware/rateLimit.ts` | Set `REDIS_URL` and every limiter automatically switches to a shared `RedisStore`; falls back to in-memory when unset | **Fixed** (verified: typechecks and runs with `REDIS_URL` unset; a real Redis instance wasn't available in this build environment to verify the connected path end-to-end — review before relying on it at scale) |
| ~~Medium~~ | ~~Verification/reset emails were never actually sent~~ | ~~Broken in any real deployment~~ | `lib/mailer.ts` | Real SMTP send via `nodemailer` when `SMTP_*` is configured; logs the email (with working link) to the console in dev when it isn't, instead of silently doing nothing | **Fixed and verified live** — confirmed the dev-mode console email actually appears with a working link, via `npm test` output and a manual run |
| ~~Low~~ | ~~No client-side idempotency key; a double-click or retry could duplicate a log~~ | ~~Duplicate food log entries~~ | `logs.service.ts`, `Dashboard.tsx` | **Rebuilt properly, not just patched**: the first attempt at this fix used a select-then-insert check, which is a TOCTOU race under real concurrency — verified by firing two truly simultaneous identical requests, which produced two separate rows. Replaced with a DB-level unique constraint on `(userId, idempotencyKey)`; the key is supplied by the client or deterministically derived server-side from the log's content + a time bucket when omitted, and a constraint violation on the losing concurrent request is caught and returns the winning row | **Fixed and verified**: the same two-simultaneous-request test now returns the same row ID for both, confirmed over 5 repeated runs and once more via raw concurrent `curl` requests (not just the test harness) |
| ~~Low~~ | ~~No dedicated audit log for admin actions~~ | ~~No tamper-evident admin history~~ | `db/schema.ts: adminAuditLog`, `admin.routes.ts` | Added an `admin_audit_log` table (FK to the admin user is `ON DELETE RESTRICT`, so the trail can't be cascade-deleted by removing the admin account); every admin food-verification action writes a before/after entry | **Fixed**, verified via test |
| Medium | No real LLM behind the AI provider interface (before this pass) | AI quick-add always returned nothing | `modules/ai/ai.provider.ts` | Implemented `AnthropicAiProvider` calling the real Anthropic API with a strict system prompt, 15s timeout, and defensive JSON parsing. **The untrusted-output handling is unchanged**: whatever the model returns is still re-validated by the same Zod schema before it's ever shown to the user, same as when it was a stub | **Implemented, not independently verified against a live model** — no Anthropic API key was available in this build environment, so this path is confirmed to compile and to fail closed safely (falls back to `{items:[]}` on any error, timeout, or non-JSON response — verified by running `/ai/parse` with no key configured and confirming it returns cleanly rather than crashing), but a real parse was not observed end-to-end. Test before relying on it. |
| Low | No account-level lockout/backoff, only per-IP rate limiting | A distributed attacker (many IPs) against one account isn't slowed beyond the login rate limit | `middleware/rateLimit.ts`, `auth.service.ts` | Add a per-account failed-attempt counter independent of IP | **Open** (accepted risk for this scope) |
| Low | Login is allowed before email verification | Unverified accounts can fully use the app | `auth.service.ts: loginUser` | Gate login or specific actions on `emailVerified` if that matters for the product | **Open** (deliberate scope choice) |
| Informational | Argon2id cost parameters are now configurable (`ARGON2_MEMORY_COST_KB`, `ARGON2_TIME_COST`) but still default to the lower end of OWASP's range | Slightly less resistant to offline brute-force than the higher end | `.env.example` | Raise `ARGON2_MEMORY_COST_KB` if server hardware allows | **Informational**, functional as-is, now at least tunable without a code change |
| — | CSRF | Unchanged from first pass: bearer-token auth on every state-changing route makes CSRF tokens unnecessary — a cross-site request can't attach the bearer header | app-wide | — | **Mitigated by design** |
| — | IDOR / broken access control | Unchanged, still verified | all `*.service.ts` | — | **Verified via tests** |
| — | SQL/NoSQL injection | Unchanged, still verified | — | — | **Verified via test** |
| — | Historical data integrity | Unchanged, still verified | — | — | **Verified via test** |
| — | Concurrency safety of food logging | **New this pass**: found and fixed a real TOCTOU race in the first attempt at duplicate-submission protection | `logs.service.ts` | — | **Verified via test, including repeated runs and raw concurrent curl requests** |

## What changed since the first audit

The first audit's "Open" findings weren't left as documentation — five of
them are now actually fixed, and one (the idempotency fix) went through a
second iteration after the first fix attempt turned out to have a genuine
concurrency bug, which is exactly the kind of thing that's worth catching
before calling something done. Two findings remain deliberately open
(account lockout, pre-verification login) as scope choices rather than
oversights, and the new AI provider integration is implemented and fails
safe, but hasn't been exercised against a live model in this environment.

## Not done

- No formal third-party penetration test.
- No dependency vulnerability scan beyond `npm audit` — run it yourself
  before deploying.
- No fuzz testing of the AI-output validation boundary.
- The Redis-backed rate limit store compiles and runs with `REDIS_URL`
  unset, but wasn't verified against a real Redis instance in this
  environment — do that before depending on it in a multi-instance deploy.
