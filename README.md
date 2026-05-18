# Microsoft Email Sync SaaS MVP

Minimal production-ready SaaS that connects Microsoft accounts, syncs emails from Microsoft Graph on the server, and renders a protected inbox dashboard.

## Stack

- Next.js (App Router)
- Auth.js (NextAuth)
- Prisma ORM
- PostgreSQL
- Microsoft Entra ID OAuth + OpenID Connect
- Microsoft Graph API

## Features

- Microsoft-only OAuth login (`openid email profile offline_access Mail.Read`)
- Secure HTTP-only cookie sessions
- Access/refresh token encryption at rest (AES-256-GCM)
- Protected `/dashboard` route via proxy middleware
- Server-only Graph API sync (`/api/sync`)
- Incremental sync using delta tokens
- Basic sync rate limiting
- Dashboard inbox list + preview pane + manual `Sync now`

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy and fill environment variables:

   ```bash
   cp .env.example .env
   ```

3. Generate Prisma client and run migrations:

   ```bash
   npm run prisma:generate
   npm run prisma:migrate -- --name init
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

5. Open http://localhost:3000

## Cursor Cloud environment

- Repo-level cloud setup lives in `.cursor/environment.json`.
- Cloud agents run `npm install && npm run prisma:generate` during environment install.
- Configure `DATABASE_URL` in cloud secrets for migrations/runtime DB access.

## Required Environment Variables

See `.env.example` for all values.

- `DATABASE_URL`
- `AUTH_SECRET`
- `AUTH_MICROSOFT_ENTRA_ID_ID`
- `AUTH_MICROSOFT_ENTRA_ID_SECRET`
- `AUTH_MICROSOFT_ENTRA_ID_TENANT_ID` (`common` for multi-tenant)
- `TOKEN_ENCRYPTION_KEY` (base64-encoded 32-byte key)

## Security Notes

- Graph access/refresh tokens are encrypted before DB persistence.
- Tokens are never sent to the frontend.
- Sync only runs in server code (`src/lib/email-sync.ts` + `src/app/api/sync/route.ts`).
- Dashboard route is protected in proxy middleware (`src/proxy.ts`).
