# Emailyzer

Minimal, production-ready SaaS MVP that lets a user sign in with their
Microsoft account and browse their Outlook inbox in a clean dashboard.
Emails are pulled server-side via the Microsoft Graph delta API and
cached in Postgres. OAuth tokens are encrypted at rest.

## Stack

- **Next.js 14** (App Router, React Server Components)
- **Auth.js / NextAuth v5** with database sessions
- **Microsoft Entra ID** as the only identity provider
- **Microsoft Graph API** (`/me/mailFolders/Inbox/messages/delta`) for sync
- **Prisma ORM** + **PostgreSQL**
- **TailwindCSS** for the UI

## Features

- Sign in with Microsoft (OAuth 2.0 + OIDC, `Mail.Read` consent)
- HTTP-only, secure session cookies (database session strategy)
- AES-256-GCM encryption for access & refresh tokens at rest
- Server-only Graph calls — tokens never reach the browser
- Delta-based inbox sync with persisted delta token
- Inbox dashboard (list + preview) with "Sync now" button
- Per-user rate limiting on the sync endpoint
- Middleware protection for `/dashboard`

## What's intentionally NOT in the MVP

- AI / classification features
- Multi-provider auth
- Admin panel
- Background workers / queues
- Mailbox mutation (delete, send, mark-read)

## Local development — one command

```bash
npm install
npm run dev
```

That's it. `npm run dev` runs `scripts/dev-bootstrap.mjs`, which:

1. Creates `.env` with safe defaults if it doesn't exist, and **generates fresh
   `AUTH_SECRET` + `TOKEN_ENCRYPTION_KEY`** (existing values are preserved on
   re-run).
2. Brings up a local Postgres on `127.0.0.1:5432` via `docker compose up -d
   postgres` (falls back to a native Postgres if Docker isn't available).
3. Waits for Postgres to accept connections.
4. Runs `prisma db push` to apply the schema.
5. Starts `next dev` so logs stream to your terminal.

Then open [http://localhost:3000](http://localhost:3000).

### Dev mode (no Microsoft account needed)

The bootstrap defaults `ENABLE_DEV_AUTH=true`, which enables a local-only
shortcut so you can test the full UX without an Azure registration:

- A **"Sign in as dev user (skip Microsoft)"** button appears on `/login`.
- That button hits `GET /api/dev/signin`, which creates a user, opens a
  DB-backed session, and sets the same HTTP-only `authjs.session-token`
  cookie the real OAuth flow uses.
- Because the dev user has no linked Microsoft account, `syncEmails`
  falls through to `src/lib/mock-graph.ts`, which seeds a realistic
  starter inbox on the first sync and appends a fresh "Sync ran at …"
  message on every subsequent sync — so the **Sync now** button has
  visible effects on every click.
- The dashboard header shows a **DEV MODE** badge so the shortcut is
  never ambiguous.

> **Production**: set `ENABLE_DEV_AUTH="false"` (or leave it unset). The
> `/api/dev/signin` route returns `404` whenever the flag is off.

### End-to-end smoke test

With the dev server running:

```bash
npm run test:e2e
```

This walks the full happy path against `http://localhost:3000`:

```
✓ GET / → 200
✓ GET /dashboard (unauth) → 307 → /login?callbackUrl=%2Fdashboard
✓ GET /api/dev/signin → 307 + session cookie
✓ GET /dashboard (auth) → 200
✓ POST /api/sync → 200 (upserted=5, removed=0)
✓ POST /api/sync (rapid x8) → eventually 429
```

### Database helpers

```bash
npm run db:up      # docker compose up -d postgres
npm run db:down    # docker compose down
npm run db:reset   # wipe the Docker volume and recreate the DB
npm run db:logs    # tail Postgres logs
npm run db:push    # re-apply Prisma schema after editing it
```

### Switching to real Microsoft auth

1. Register a Microsoft Entra ID app (Azure Portal → **Entra ID → App
   registrations → New registration**).
2. Account types: *"Accounts in any organizational directory and personal
   Microsoft accounts"*.
3. Redirect URI (Web): `http://localhost:3000/api/auth/callback/microsoft-entra-id`.
4. Copy values into `.env`:
   - **Application (client) ID** → `AUTH_MICROSOFT_ENTRA_ID_ID`
   - **Directory (tenant) ID** → `AUTH_MICROSOFT_ENTRA_ID_TENANT_ID`
     (or `common` for multi-tenant + personal accounts)
   - **Client secret value** → `AUTH_MICROSOFT_ENTRA_ID_SECRET`
5. Under **API permissions**, add **Microsoft Graph → Delegated → `Mail.Read`**.
6. Set `ENABLE_DEV_AUTH="false"` in `.env`.
7. Re-run `npm run dev`. The **"Continue with Microsoft"** button on
   `/login` now performs a real OAuth flow against Entra ID and the
   sync endpoint hits the real Graph API.

## Architecture notes

### Auth & tokens

- `src/lib/auth.ts` configures NextAuth v5 with the
  `MicrosoftEntraID` provider. Scopes:
  `openid email profile offline_access Mail.Read`.
- `src/lib/auth-adapter.ts` wraps `@auth/prisma-adapter` and encrypts
  `access_token`, `refresh_token`, and `id_token` with AES-256-GCM
  before persisting via `linkAccount`.
- `src/lib/tokens.ts` exposes `getValidAccessToken(userId)` which
  decrypts the stored refresh token, exchanges it at the
  `login.microsoftonline.com/.../oauth2/v2.0/token` endpoint when
  needed, and re-encrypts the resulting tokens.
- Sessions use the **database** strategy: the session token sits in an
  HTTP-only, Secure, SameSite=Lax cookie (`authjs.session-token`).
  No access token ever reaches the browser.

### Sync

- `src/lib/graph.ts` `syncEmails(userId)`:
  1. Loads a valid access token (refreshing if needed).
  2. Calls `/me/mailFolders/Inbox/messages/delta` — first call with the
     default URL, subsequent calls with the persisted delta token.
  3. Upserts each message into `Email`, deletes any that arrive with
     `@removed`.
  4. Honors `Retry-After` on 429/503 responses (with capped retries).
  5. Stores the next `@odata.deltaLink` (or `@odata.nextLink` if
     pagination didn't complete) in `SyncState`.

### API

- `POST /api/sync` — gated by `auth()`, then by a per-user in-memory
  rate limiter (5 syncs / minute), then invokes `syncEmails`.
- `GET|POST /api/auth/[...nextauth]` — NextAuth handlers.

### Middleware

- `src/middleware.ts` redirects unauthenticated requests for
  `/dashboard/*` to `/login` based on the session cookie.

### Rate limiting

`src/lib/rate-limit.ts` is a tiny in-memory limiter — fine for a single
instance MVP. For multi-instance deployments, swap it for a
Redis/Upstash-backed limiter.

## Security checklist

- HTTP-only, Secure session cookies (NextAuth default)
- All OAuth token columns are AES-256-GCM encrypted at rest
- Graph API is called server-side only; access tokens are never
  serialized to the client (`session` callback does not expose them)
- `/dashboard/*` is gated both by middleware and by an `auth()` check
  in the server component
- `/api/sync` validates the session and rate-limits per user
- `TOKEN_ENCRYPTION_KEY` and `AUTH_SECRET` are required via runtime
  env validation (`src/lib/env.ts`)

## Useful scripts

| Command              | What it does                                                       |
| -------------------- | ------------------------------------------------------------------ |
| `npm run dev`        | One-command bootstrap: env + Postgres + schema + Next dev          |
| `npm run dev:next`   | Just `next dev` (skips the bootstrap; assumes env + DB are ready)  |
| `npm run db:up`      | `docker compose up -d postgres`                                    |
| `npm run db:down`    | `docker compose down`                                              |
| `npm run db:reset`   | Drop the Docker Postgres volume and start fresh                    |
| `npm run db:logs`    | Tail the Postgres container logs                                   |
| `npm run db:push`    | `prisma db push` — sync schema without migrations                  |
| `npm run db:migrate` | `prisma migrate dev`                                               |
| `npm run build`      | Generate Prisma client + build for production                      |
| `npm run start`      | Start the production server                                        |
| `npm run typecheck`  | Type-check the project without emitting                            |
| `npm run lint`       | Run `next lint`                                                    |
| `npm run test:e2e`   | Run the end-to-end smoke test against `http://localhost:3000`      |
