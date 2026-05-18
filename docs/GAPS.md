# Gaps — what's intentionally missing or incomplete

This is the honest inventory of what the MVP does **not** do, why,
and the smallest patch path to address each gap if you decide to.

Things grouped roughly by risk to a real user / real production.

## Out of scope per the original spec

These are spec'd as "do NOT build" — listed here so they don't keep
coming up:

- No AI / classification / summarization features
- No email deletion or any mailbox mutation
- No multi-provider auth (no Google, no GitHub, no email/password)
- No admin panel
- No background workers — sync is manual / on-demand

If you want any of these later, none of them break the existing
contracts — they're additive.

## Production blockers (fix before real users)

### 1. In-memory rate limiter doesn't survive multi-instance / serverless

- **Where**: `src/lib/rate-limit.ts`
- **Risk**: On Vercel/Lambda/any horizontally-scaled deployment, the
  per-process `Map` means the 5/min limit becomes "5/min per warm
  instance". A motivated user (or a bug) can hammer Microsoft Graph
  far past the documented limit.
- **Patch**: drop in [`@upstash/ratelimit`](https://github.com/upstash/ratelimit)
  + an Upstash Redis URL, or any Redis. Keep the same call signature
  (`rateLimit(key, limit, windowMs) → { allowed, remaining, resetAt }`)
  and only swap the storage backend.

### 2. No automated DB migrations

- **Where**: `prisma/` only contains `schema.prisma`, no `migrations/`.
- **Risk**: production deploys rely on `prisma db push`, which works
  but doesn't track history and is dangerous for destructive changes.
- **Patch**:
  ```bash
  npx prisma migrate dev --name init
  git add prisma/migrations
  ```
  Then `npx prisma migrate deploy` in your release pipeline.

### 3. No health check endpoint

- **Where**: nothing under `src/app/api/health/`.
- **Risk**: load balancers / orchestrators have no way to assert
  readiness beyond "the process answers HTTP".
- **Patch**: add `src/app/api/health/route.ts` that runs `await prisma.$queryRaw\`SELECT 1\`` and returns `{ ok: true }`.

### 4. No production logging / metrics / tracing

- **Where**: only `console.error` in `/api/sync` and Prisma's default logger.
- **Risk**: you'll find out about token-refresh storms or Graph throttling from user reports.
- **Patch**: pick one of {Pino + log shipper, Sentry, OpenTelemetry}.
  Minimum useful instrumentation:
  - sync success rate, sync duration
  - refresh-token failure rate (likely sign of Microsoft consent expiry)
  - Graph 429/503 rate

### 5. No CSRF token on `/api/sync`

- **Where**: `src/app/api/sync/route.ts`
- **Risk**: SameSite=Lax + Origin check would be belt-and-braces. Today we rely on `SameSite=Lax` alone.
- **Patch**: add an `Origin`/`Referer` allowlist check; reject requests where the origin doesn't match `NEXTAUTH_URL`.

### 6. No production Dockerfile

- **Where**: only `docker-compose.yml` (for the dev Postgres) exists.
- **Patch**: a multi-stage Node 20 alpine image; build with `prisma generate && next build`, run with `next start`. Skeleton in [OPERATIONS.md](./OPERATIONS.md).

### 7. No HTTPS guidance / no `trustHost` review

- **Where**: `src/lib/auth.ts` sets `trustHost: true`.
- **Risk**: behind a reverse proxy / load balancer this is correct; on a multi-tenant origin it's potentially dangerous.
- **Patch**: keep `trustHost: true` only when running behind a known proxy. For higher-risk deployments set `trustHost: false` and configure `AUTH_TRUST_HOST=true` per host explicitly.

## Operational gaps

### 8. No CI pipeline

- Add GitHub Actions: typecheck + lint + build + `prisma validate`.

### 9. No automated tests beyond a smoke script

- `scripts/smoke-e2e.mjs` exercises the happy path.
- Missing: unit tests for `crypto.ts`, `tokens.ts` token-refresh logic, `graph.ts` delta-pagination handling (with `fetch` mocked), `rate-limit.ts`.
- Suggested: `vitest` + `nock`/`msw` for HTTP mocking.

### 10. No backup/restore drill

- Documented in [OPERATIONS.md](./OPERATIONS.md), not exercised.

### 11. No `/api/me` or `/api/session` introspection beyond NextAuth defaults

- NextAuth provides `GET /api/auth/session` which returns the public
  session shape. No additional endpoints for the dashboard to query
  user state if needed in the future.

## Security gaps (lower urgency than the production blockers above)

### 12. No envelope encryption / KMS for `TOKEN_ENCRYPTION_KEY`

- Today the AES-256-GCM key sits in env. If the env leaks, every
  stored token is decryptable.
- **Patch**: split into a per-row data key wrapped by a KMS master
  key (AWS KMS, GCP KMS, Vault Transit). The data key lives in the
  DB next to the ciphertext; the KMS master never leaves the HSM.
- Until then: treat `TOKEN_ENCRYPTION_KEY` with the same care as a
  client secret. See [SECURITY.md](./SECURITY.md) for the rotation
  playbook.

### 13. No multi-key support for zero-downtime rotation

- `src/lib/crypto.ts` reads exactly one key. To rotate without
  forcing all users to re-sign-in, accept multiple keys keyed by
  version and store the version alongside each ciphertext.

### 14. No revocation UI

- Server-side revocation works (`DELETE FROM "Session"`), but users
  have no in-app way to see active sessions or sign out of all
  devices. The Microsoft side can revoke consent from
  <https://myaccount.microsoft.com/>.

### 15. No GDPR / "delete my account" flow

- The schema cascades correctly on `User` delete, but there's no UI
  or endpoint that triggers it. Add `DELETE /api/me` (auth-gated,
  CSRF-checked) that deletes the user and signs them out.

### 16. No abuse heuristics

- The MVP rate-limits per user. There's no IP-level limit on the
  sign-in endpoints, no detection of refresh-token churn, no lockout
  on repeated `Mail.Read` consent failures.

## Functional gaps

### 17. Only `bodyPreview` is stored, not the message body

- **Why**: minimal storage, no decryption-of-MIME concerns, much smaller DB footprint.
- **Patch**: when a user opens a message, hit Graph on-demand
  (`/me/messages/{id}?$select=body`) server-side and stream the body
  to the client. Don't persist it unless you have a reason to.

### 18. No attachments

- Same reasoning. Add `/me/messages/{id}/attachments` if needed.

### 19. No folder / label model

- Sync is hard-coded to the `Inbox` folder. To support other folders,
  parameterize `syncEmails` and add a `folderId` to `SyncState` (one
  delta token per (user, folder)).

### 20. No real-time updates

- Sync is on-demand only. For push, register a Graph subscription
  (`POST /subscriptions` with `notificationUrl`) and add a webhook
  receiver. Requires a publicly reachable HTTPS endpoint + validation
  handshake.

### 21. No pagination in the dashboard UI

- The dashboard renders the latest 200 emails. Beyond that requires
  paged loading + infinite scroll.

### 22. No search

- All emails are in Postgres; add a `tsvector` column on
  `subject + bodyPreview + fromName` and a GIN index for a basic
  Postgres FTS search.

### 23. No empty/error states for "Microsoft revoked Mail.Read"

- If the user removes consent in Microsoft, the next refresh fails
  with 401. The API surfaces a generic "Please sign in again" — no
  in-app guidance.

### 24. No image proxying for `image` field

- The dashboard renders `user.image` directly via `<img src>`. For a
  hardened deployment, proxy through `/api/avatar` or use Next.js
  `<Image>` with a configured remote pattern.

## Developer-experience gaps

### 25. No production Dockerfile (also a prod blocker — see #6)

### 26. No `prisma migrate` artifacts (also a prod blocker — see #2)

### 27. No `package-lock` enforcement in CI

- Add `npm ci` to a CI job (see #8).

### 28. No `tsconfig` path aliases beyond `@/`

- Cosmetic; tighter aliases (`@/lib`, `@/components`) would help in a bigger codebase.

### 29. ESLint config is minimal

- `.eslintrc.json` extends `next/core-web-vitals` and disables one rule. Stricter rules (`@typescript-eslint/no-floating-promises`, `import/order`) would catch real bugs.

### 30. Some Prisma calls in `graph.ts` aren't batched

- Each message is upserted in its own round-trip. For very large
  initial syncs this is N round-trips. Group into transactions or
  use `prisma.email.createMany({ skipDuplicates: true })` for the
  initial page, then upserts for deltas.

## What to fix first if you wanted to ship

The smallest set of changes that turns this from "MVP" into "could
hold a small production user base":

1. #1 — Redis-backed rate limiter
2. #2 — versioned migrations
3. #3 — health endpoint
4. #4 — at minimum, Sentry on `/api/sync` and inside `graph.ts`
5. #6 — production Dockerfile
6. #8 — CI running typecheck + lint + `prisma validate`

Everything else can wait until real users are asking for it.
