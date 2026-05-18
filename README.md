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

## Quick start

### 1. Prerequisites

- Node.js 20+
- A running PostgreSQL database
- A Microsoft Entra ID app registration (see below)

### 2. Register a Microsoft Entra ID app

1. Open the [Azure portal](https://portal.azure.com) → **Entra ID** → **App registrations** → **New registration**.
2. Account types: pick *"Accounts in any organizational directory and personal Microsoft accounts"* for the broadest fit (or restrict to your tenant).
3. Redirect URI (Web): `http://localhost:3000/api/auth/callback/microsoft-entra-id`
   - Add an additional production URI when you deploy.
4. After creation:
   - Copy the **Application (client) ID** → `AUTH_MICROSOFT_ENTRA_ID_ID`
   - Copy the **Directory (tenant) ID** → `AUTH_MICROSOFT_ENTRA_ID_TENANT_ID` (or use `common` for multi-tenant + personal)
   - Under **Certificates & secrets**, create a client secret. Copy the **Value** (not the ID) → `AUTH_MICROSOFT_ENTRA_ID_SECRET`
5. Under **API permissions**, add **Microsoft Graph → Delegated → `Mail.Read`** (alongside the default `openid`, `email`, `profile`, `offline_access`).

### 3. Configure environment

```bash
cp .env.example .env
```

Generate the secrets:

```bash
# AUTH_SECRET
openssl rand -base64 32

# TOKEN_ENCRYPTION_KEY (32 bytes, base64)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Fill in `DATABASE_URL` and the Microsoft Entra ID values.

### 4. Install & set up the database

```bash
npm install
npx prisma db push     # or: npx prisma migrate dev
```

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), click **Get started**,
sign in with Microsoft, then hit **Sync now** on the dashboard.

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

| Command             | What it does                                          |
| ------------------- | ----------------------------------------------------- |
| `npm run dev`       | Run the Next.js dev server                            |
| `npm run build`     | Generate Prisma client + build for production         |
| `npm run start`     | Start the production server                           |
| `npm run typecheck` | Type-check the project without emitting               |
| `npm run lint`      | Run `next lint`                                       |
| `npm run db:push`   | `prisma db push` — sync schema to DB without migrations |
| `npm run db:migrate`| `prisma migrate dev`                                  |
