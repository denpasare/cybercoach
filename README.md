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
- Secure database sessions stored in HTTP-only cookies
- Access/refresh token encryption at rest (AES-256-GCM)
- Protected `/dashboard` route via middleware
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

## Required Environment Variables

See `.env.example` for all values.

- `DATABASE_URL`
- `AUTH_SECRET`
- `AUTH_MICROSOFT_ENTRA_ID_ID`
- `AUTH_MICROSOFT_ENTRA_ID_SECRET`
- `AUTH_MICROSOFT_ENTRA_ID_ISSUER`
- `TOKEN_ENCRYPTION_KEY` (base64-encoded 32-byte key)

## Security Notes

- Graph access/refresh tokens are encrypted before DB persistence.
- Tokens are never sent to the frontend.
- Sync only runs in server code (`src/lib/email-sync.ts` + `src/app/api/sync/route.ts`).
- Dashboard route is protected in middleware (`src/middleware.ts`).
