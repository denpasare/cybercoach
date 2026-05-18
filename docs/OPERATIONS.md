# Operations

Running Emailyzer somewhere other than your laptop.

## Runtime requirements

- Node.js 20+ (Next.js 14 supports 18.17+, but Node 20 LTS is recommended)
- PostgreSQL 14+ reachable from the app
- Outbound HTTPS to `login.microsoftonline.com` and `graph.microsoft.com`
- TLS termination in front of the app (so `Secure` cookies actually flow)
- A way to inject env vars (platform secret manager, `.env` mounted as a secret, etc.)

## Build & start

```bash
npm ci
npm run build       # runs `prisma generate && next build`
npm run start       # `next start` on $PORT (default 3000)
```

If your platform doesn't allow `postinstall` scripts, run
`npx prisma generate` explicitly before `next build`.

Apply schema before booting:

```bash
npx prisma migrate deploy
```

## Required env vars

See [SETUP.md](./SETUP.md) for full details. Production needs all of:

```
DATABASE_URL
AUTH_SECRET
NEXTAUTH_URL
TOKEN_ENCRYPTION_KEY
AUTH_MICROSOFT_ENTRA_ID_ID
AUTH_MICROSOFT_ENTRA_ID_SECRET
AUTH_MICROSOFT_ENTRA_ID_TENANT_ID
ENABLE_DEV_AUTH=false      # explicitly off
```

`src/lib/env.ts` validates these lazily — a missing value throws a
listed-out error on the first request, not at build time.

## Platform notes

### Vercel

- `npm run build` works as-is. Vercel runs `next build` automatically.
- Add all env vars in **Project Settings → Environment Variables**.
- Add the production redirect URI to your Microsoft app registration:
  `https://<your-project>.vercel.app/api/auth/callback/microsoft-entra-id`
  (and any custom domain you map).
- Use a managed Postgres (Neon, Supabase, Railway, RDS).
- The default Vercel Node runtime is `nodejs`. `/api/sync` and
  `/api/dev/signin` already declare `runtime = "nodejs"` explicitly.
- **Rate limiting caveat**: the in-memory limiter is per-instance.
  Vercel serverless functions cold-start per region; in practice
  serverless concurrency makes the 5/min limit a soft ceiling, not a
  hard one. See [GAPS.md](./GAPS.md) for the Redis upgrade.

### Fly.io / Railway / Render / a single VM

- The in-memory rate limiter behaves as documented.
- Make sure HTTPS terminates *before* the app so `Secure` cookies work.
- Run `npx prisma migrate deploy` as a release/deploy step.

### Docker (production image)

There is no production Dockerfile in the repo yet — only the dev
Postgres compose file. A minimal production image:

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npx prisma generate && npm run build
EXPOSE 3000
CMD ["npm","run","start"]
```

For multi-stage builds, generate Prisma client + `next build` in a
builder stage and copy `.next/`, `node_modules/`, `public/`,
`prisma/`, `package.json` to the runtime stage. Pin
`PRISMA_QUERY_ENGINE_LIBRARY` / platform binaries as Prisma docs
suggest for Alpine.

## Postgres

- Production: dedicated database with TLS (`sslmode=require` or
  stricter), regular backups, point-in-time-recovery if your provider
  supports it.
- Connection pooling: Prisma opens one connection per process by
  default; behind a serverless platform use a pooler like
  PgBouncer / Neon Pooler / Supabase Pooler and the
  `?pgbouncer=true&connection_limit=1` style URL parameters.
- Schema deploy: `npx prisma migrate deploy` is idempotent.

## Observability

The MVP has minimal observability:

- `console.error("[/api/sync] failed", err)` for sync failures.
- Prisma logs at level `error` in production
  (`src/lib/prisma.ts`).
- `lastSyncedAt` per user is visible in the dashboard header.

What's missing (see [GAPS.md](./GAPS.md)):

- Request logging / structured logs
- Metrics (sync success rate, refresh-failure rate, p95 sync duration)
- Tracing across `/api/sync → tokens.ts → graph.ts → Microsoft Graph`
- Error reporting (Sentry / Highlight / etc.)

Quick wins if you want any of this now:

- Wrap `fetch` calls in `src/lib/graph.ts` with timing + status logs.
- Pipe `console.*` through `pino` and log structured JSON.
- Capture Sentry events around `/api/sync` and inside `graph.ts`.

## Backups & restore

The only data Emailyzer stores is:

- User profiles and OAuth tokens (`User`, `Account`)
- Active sessions (`Session`)
- Cached email projections (`Email`)
- Sync cursors (`SyncState`)

Cached emails are recoverable by re-syncing (the user can wipe their
local rows by clearing `SyncState.deltaToken` and triggering a fresh
sync from the dashboard). Accounts/sessions are *not* recoverable — a
DB loss forces all users to sign in again. Plan backups accordingly.

Restore flow:

1. Restore the Postgres dump.
2. Confirm `TOKEN_ENCRYPTION_KEY` matches what the dump was encrypted
   with — if it doesn't, existing OAuth tokens will fail to decrypt
   and users will be prompted to re-sign-in (graceful but disruptive).
3. Confirm `AUTH_SECRET` matches if you want existing transient
   NextAuth state cookies to keep working (DB sessions are unaffected
   by `AUTH_SECRET` changes).

## Health checks

There is no dedicated `/health` endpoint yet (a documented gap).
Reasonable interim probes:

- HTTP liveness: `GET /` returns 200 (no DB call required).
- HTTP readiness: hit any page that uses Prisma (e.g. `/login` doesn't
  query the DB; `/dashboard` does, but requires auth). A future
  `/api/health` should run a `SELECT 1` against the DB.

## Deploy checklist

- [ ] `ENABLE_DEV_AUTH` removed or `"false"`
- [ ] Secrets injected via platform secret manager
- [ ] `NEXTAUTH_URL` matches the live HTTPS origin
- [ ] Microsoft app redirect URI registered for the live origin
- [ ] `npx prisma migrate deploy` run as part of release
- [ ] DB has backups + monitored connection count
- [ ] TLS terminates before the app
- [ ] Logs are being captured somewhere persistent
- [ ] You have alerts (or at least a routine check) for sync failure rate
