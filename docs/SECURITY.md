# Security Audit

Performed against the actual running system (live Postgres, live server,
47 passing tests), not a theoretical review of the code alone. Findings are
reported honestly, including gaps — an audit that finds nothing is not
credible for a system this size.

| Severity | Finding | Impact | Location | Fix | Status |
|---|---|---|---|---|---|
| Medium | Export cleanup function exists but is never scheduled | Expired export files linger on disk indefinitely instead of being deleted at TTL | `export.service.ts: deleteExpiredExportFiles` | Wire to a cron/interval (e.g. `node-cron` or an external scheduler) calling it hourly | **Open** |
| Medium | Rate limiting uses in-memory storage (`express-rate-limit` default store) | In a horizontally-scaled (multi-instance) deployment, each instance has its own counter, so the effective limit multiplies by instance count | `middleware/rateLimit.ts` | Use `rate-limit-redis` or similar shared store before scaling past one instance | **Open** (not exploitable in a single-instance deployment) |
| Medium | Verification/reset emails are not actually sent | Users can't verify email or reset password in a real deployment; tokens currently only appear in server logs / dev-only API response | `auth.service.ts`, `auth.controller.ts` (`devOnlyVerifyToken`, gated by `isProd`) | Wire a transactional email provider (SES/Postmark/etc.) before launch | **Open** |
| Low | No account-level lockout/backoff, only per-IP rate limiting | A distributed attacker (many IPs) against one specific account isn't slowed beyond the login rate limit | `middleware/rateLimit.ts`, `auth.service.ts` | Add a per-account failed-attempt counter with backoff, independent of IP | **Open** (accepted risk for this scope) |
| Low | Login is allowed before email verification | Unverified accounts can fully use the app | `auth.service.ts: loginUser` | Gate login (or gate specific actions) on `emailVerified` if that matters for the product | **Open** (deliberate scope choice, not an oversight — flagging it so it's a choice, not a surprise) |
| Low | Frontend doesn't auto-generate an idempotency key on food-log submission | A network retry (not a disabled-button double-click, which is already prevented) could create a duplicate log entry | `Dashboard.tsx: AddFoodForm`, `logs.service.ts` (idempotency key support exists server-side but is unused by the client) | Generate `crypto.randomUUID()` client-side per submission attempt and send it as `idempotencyKey` | **Open** |
| Low | No dedicated, immutable audit log for admin actions | Admin food-verification actions are only visible via general HTTP request logs (which do include user ID and route), not a purpose-built audit trail | `admin.routes.ts` | Add an `admin_audit_log` table if compliance requires tamper-evident admin history | **Open** (partial mitigation already in place via request logging) |
| Informational | Argon2id cost parameters (`memoryCost: 19456`, `timeCost: 2`) are at the lower end of OWASP's recommended range | Slightly less resistant to offline brute-force than the higher end of the range | `auth.service.ts: ARGON2_OPTS` | Raise `memoryCost` if server hardware allows (tune to ~250ms hash time on target hardware) | **Informational**, functional as-is |
| — | CSRF | Cookies are `httpOnly`/`SameSite=Lax`, and every state-changing route requires an `Authorization: Bearer` header that a cross-site form/script cannot forge (the browser won't attach it, and the token lives in JS memory, never in a cookie or localStorage a forged request could read) | app-wide | — | **Mitigated by design**, verified: no CSRF token needed because bearer-token auth is the actual protection |
| — | IDOR / broken access control | Verified directly: user B cannot read, edit, or delete user A's foods, logs, weights, or recipes | all `*.service.ts` ownership checks | — | **Verified via 16 passing security tests** |
| — | SQL/NoSQL injection | Drizzle's parameterized query builder is used everywhere; no raw string interpolation into queries. Verified with a literal `'; DROP TABLE users; --` string stored and retrieved as inert data | `foods.service.ts` et al. | — | **Verified via test** |
| — | Historical data integrity | Food/recipe logs snapshot nutrition at write time; goal history is append-only. Verified: editing a food after logging it does not change the historical log; a goal calculated earlier the same day still applies to that day | `logs.service.ts`, `recipes.service.ts`, `progress.service.ts` | — | **Verified via test** (this audit also caught and fixed a real same-day comparison bug here) |
| — | Secrets management | No secrets committed; `.env` gitignored; `.env.example` has placeholders only; JWT secret validated to be ≥32 chars at boot via Zod | `config/env.ts`, `.gitignore` | — | **Verified** |
| — | Security headers | Helmet CSP (`default-src 'self'`, no inline scripts/styles, `frame-ancestors 'none'`), HSTS, `X-Content-Type-Options`, `Referrer-Policy: no-referrer` all applied | `middleware/security.ts` | — | **Verified present**, not independently penetration-tested |

## What "verified" means here, precisely

Rows marked **Verified via test** or **Verified via 16 passing security
tests** have an actual automated test in `backend/tests/security.test.ts`
that failed before the relevant code existed and passes now, run against a
real PostgreSQL database in this build environment. Rows marked **Open** are
real, known gaps — not filled in with placeholder code, because doing so
without a real email provider, a real Redis instance, etc. would just move
the same gap somewhere less visible.

## Not done

- No formal third-party penetration test.
- No dependency vulnerability scan beyond `npm audit` (which reported
  vulnerabilities in transitive dev dependencies at time of writing — run
  `npm audit` yourself before deploying and address anything in a
  production-reachable path).
- No fuzz testing of the AI-output validation path (it's schema-bounded via
  Zod, but adversarial fuzzing of the boundary conditions wasn't performed).
