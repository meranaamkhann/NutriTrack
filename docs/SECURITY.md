# Security notes

Findings come from running the system (real Postgres, real server) and reproducing each issue before fixing it. Current status: 92 backend and 36 frontend tests pass, `tsc` is clean on both sides.

## Fixed in the hardening release

| Severity | Finding | Fix |
|---|---|---|
| Medium | An old verification link could mark a *changed* email address as verified | Email changes are now pending until the new address's link is opened; outstanding links are invalidated on change; links are claimed atomically so each works once |
| Medium | Registering revealed whether an email was taken (409); reset/resend timing revealed it too | Register answers identically for new and existing emails (existing owners get a notice email); emails are sent in the background. A small residual difference (one extra DB insert) remains |
| Medium | Refresh rotation was select-then-update, so concurrent requests could all succeed, and a strict fix would have logged out multi-tab users | Rotation runs in one transaction with a row lock plus a 10 s grace window that only applies while the session still has a live token (so logout cannot be undone) |
| Medium | Duplicate AI accepts created duplicate logs | The request is claimed atomically inside the transaction; later accepts get 409 |
| Medium | Malformed JSON / oversized bodies / numeric overflow returned 500 | Mapped to 400 / 413 / 400; overflow is also checked before writing |
| Low | `PUT /logs/:id` accepted far-future (and pre-2000) times | Same bounds as create |
| Low | CSV export: cells starting `= + - @` ran as spreadsheet formulas | Neutralised with a leading `'` |
| Low | Export token in the URL ended up in logs | Sent as `X-Export-Token` header; `token` is redacted from logged URLs and query |
| Low | Admin self-delete crashed (audit-log FK) | Returns a clear 400; audit trail is preserved |
| Low | Database failure during auth was reported as 401, which makes clients drop good sessions | Only token problems are 401; DB errors are 500 |
| Low | App-wide rate limiter was effectively per-IP | Keys on the signed-in user when the token verifies |
| Low | Password reset left lockout and sibling reset links active | Reset clears lockout and invalidates other reset links |
| Low | `%` and `_` in food search acted as wildcards | Escaped |
| Info | Log request id did not match the `x-request-id` header | Same id; graceful-shutdown timeout and unhandled-rejection logging added |

## Controls that were already in place

Argon2id hashing; hashed opaque tokens; HttpOnly SameSite refresh cookie; per-account lockout (5 failures, 15 min) with the same response as a wrong password; ownership checks in the service layer; Zod validation that strips unknown fields; DB-level idempotency; append-only goal history and nutrition snapshots; admin audit log; helmet, CORS allow-list, rate limits (Redis-ready).

## Accepted trade-offs and open items

- **Revoked sessions keep working for up to 15 minutes** (the access-token lifetime); the UI says so.
- **Lockout can be used to lock one known user out** for 15 minutes. Limited by the per-IP login limiter.
- **No two-factor authentication.**
- **Sessions list stores IP addresses** (visible only to the owner).
- **Login works before email verification** (deliberate scope choice).
- **Weight-loss guidance:** targets are floored at 1,200 kcal and weight-loss targets are adults-only, but there is no BMI or underweight check.
- `trust proxy` is set to 1; if you deploy without exactly one reverse proxy in front, change it or `X-Forwarded-For` can be spoofed to dodge IP rate limits.
- The Anthropic integration and the Redis rate-limit store have not been exercised against the real services.
- No third-party penetration test; run `npm audit` before deploying.
