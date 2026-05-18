# Architecture

## High level

```
┌─────────────────┐         ┌─────────────────────────────────┐
│                 │         │  Next.js (App Router) — Node.js │
│  Browser        │ ──────► │  ┌─────────────────────────────┐│
│  (HTTP only,    │  HTTPS  │  │ middleware.ts (Edge)        ││
│   session       │         │  │  gates /dashboard/*         ││
│   cookie only)  │         │  └─────────────────────────────┘│
│                 │         │  ┌─────────────────────────────┐│
└─────────────────┘         │  │ App Router pages + API      ││
                            │  │  - /, /login, /dashboard    ││
                            │  │  - /api/auth/[...nextauth]  ││
                            │  │  - /api/sync                ││
                            │  │  - /api/dev/signin (dev)    ││
                            │  └─────────────────────────────┘│
                            │            │            │       │
                            │            ▼            ▼       │
                            │  ┌──────────────┐ ┌────────────┐│
                            │  │ Prisma       │ │ fetch()    ││
                            │  │ Client       │ │ to Graph   ││
                            │  └──────┬───────┘ └─────┬──────┘│
                            └─────────┼───────────────┼───────┘
                                      │               │
                                      ▼               ▼
                              ┌─────────────┐   ┌─────────────┐
                              │ PostgreSQL  │   │ Microsoft   │
                              │             │   │ Graph API   │
                              │ - User      │   │ + Identity  │
                              │ - Account   │   │   Platform  │
                              │ - Session   │   └─────────────┘
                              │ - Email     │
                              │ - SyncState │
                              └─────────────┘
```

**Browser never holds an access token.** The only credential that lives
in the browser is the NextAuth session cookie (an opaque
DB-session-token, not a JWT containing OAuth material).

## Layers

| Layer | Lives in | Responsibility |
| --- | --- | --- |
| Auth | `src/lib/auth*.ts` | NextAuth v5 config, encrypted Prisma adapter |
| Tokens | `src/lib/tokens.ts` | Decrypt → check expiry → refresh → re-encrypt |
| Sync | `src/lib/graph.ts`, `src/lib/mock-graph.ts` | Talk to Microsoft Graph (or the mock), upsert into DB |
| Persistence | `prisma/schema.prisma`, `src/lib/prisma.ts` | Schema + singleton client |
| Crypto | `src/lib/crypto.ts` | AES-256-GCM encrypt/decrypt of token columns |
| HTTP | `src/app/**/route.ts`, `src/middleware.ts` | API routes, page routes, route protection |
| UI | `src/app/**/*.tsx` | Server components for data, client components for interactivity |
| Env | `src/lib/env.ts` | zod-validated lazy env loader |
| Dev mode | `src/lib/dev-mode.ts`, `src/app/api/dev/signin/route.ts` | Microsoft-free shortcut for local dev |

## Flow: sign in with Microsoft

```
User → "Continue with Microsoft" button (server action)
     → signIn("microsoft-entra-id", { redirectTo: "/dashboard" })
     → NextAuth redirects to
         https://login.microsoftonline.com/<tenant>/oauth2/v2.0/authorize
         ?scope=openid email profile offline_access Mail.Read
         &prompt=consent
         &redirect_uri=https://<app>/api/auth/callback/microsoft-entra-id

Microsoft → user consents → redirects back to /api/auth/callback/...

NextAuth handler →
  exchanges code for { access_token, refresh_token, id_token, expires_in }
  → adapter.createUser / linkAccount      (custom, see below)
  → adapter.createSession                  (new sessionToken)
  → sets cookie  authjs.session-token=<sessionToken>; HttpOnly; SameSite=Lax; Secure
  → redirects to /dashboard

linkAccount (createEncryptedPrismaAdapter, src/lib/auth-adapter.ts):
  access_token  = encrypt(access_token)    # AES-256-GCM
  refresh_token = encrypt(refresh_token)
  id_token      = encrypt(id_token)
  ... → base PrismaAdapter writes the encrypted ciphertext to Account
```

Result: a row in `User`, a row in `Account` with **encrypted** OAuth
tokens, a row in `Session` with the cookie's sessionToken.

## Flow: dashboard render

```
GET /dashboard
  → middleware.ts: cookie `authjs.session-token` present? If no, 307 → /login
  → DashboardPage (server component)
       const session = await auth()          # joins Session + User
       if (!session) redirect("/login")
       const emails = prisma.email.findMany({ where: { userId } })
       const syncState = prisma.syncState.findUnique(...)
       return <DashboardClient ... />
  → DashboardClient (client component) hydrates with that data
```

The dashboard never reads tokens. It only reads `Email` and `SyncState`.

## Flow: Sync now

```
[Browser] "Sync now" → fetch("/api/sync", { method: "POST" })

[/api/sync/route.ts]
  session = await auth()                         # 401 if missing
  rateLimit(`sync:${session.user.id}`, 5, 60s)   # 429 if limit hit
  syncEmails(session.user.id)

[graph.ts → syncEmails]
  try { accessToken = await getValidAccessToken(userId) }
  catch (MissingMicrosoftAccountError) if devMode → syncMockEmails(); return

[tokens.ts → getValidAccessToken]
  account = prisma.account.findFirst({ provider:"microsoft-entra-id", userId })
  accessToken = decrypt(account.access_token)
  if (account.expires_at + skew <= now) {
    refreshToken = decrypt(account.refresh_token)
    POST https://login.microsoftonline.com/<tenant>/oauth2/v2.0/token
         grant_type=refresh_token, refresh_token=..., scope=...
    → { access_token, refresh_token?, expires_in }
    prisma.account.update({
      access_token: encrypt(new),
      refresh_token: encrypt(new ?? keep old),
      expires_at: now + expires_in,
    })
  }
  return accessToken

[graph.ts → syncEmails continued]
  url = syncState.deltaToken  ?? `${GRAPH}/me/mailFolders/Inbox/messages/delta`
  loop (up to 10 pages):
    res = GET url, Bearer accessToken, Prefer: odata.maxpagesize=50
       (retry on 429/503 honoring Retry-After, max 3 attempts)
    for msg in res.value:
      if msg["@removed"]: prisma.email.delete(...)
      else:               prisma.email.upsert({ userId+messageId })
    if @odata.deltaLink: store, break
    if @odata.nextLink:  url = nextLink, continue
    else: break

  prisma.syncState.upsert({
    deltaToken: deltaLink ?? lastNextLink ?? oldToken,
    lastSyncedAt: now,
  })
  return { upserted, removed, pages, deltaTokenAdvanced }

[/api/sync/route.ts] respond { ok: true, ...result }
```

## Flow: sign out

```
[Dashboard] Sign out button → server action: signOut({ redirectTo: "/" })
  → NextAuth handler clears the session cookie
  → adapter.deleteSession deletes the matching Session row
  → 307 → "/"
```

## Why these choices

| Decision | Why |
| --- | --- |
| Database session strategy (not JWT) | Sessions can be revoked server-side just by deleting the row; tokens never travel through the cookie |
| `MicrosoftEntraID` provider only | Spec says Microsoft-only; the same provider serves work, school, and personal accounts |
| Custom Prisma adapter wrapper | We need to encrypt OAuth tokens *before* the base adapter writes them, without forking the adapter |
| AES-256-GCM for tokens | Authenticated encryption (detects tampering); 12-byte IV, 16-byte tag; format = base64(iv ‖ tag ‖ ciphertext) |
| Delta sync (`/messages/delta`) | Cheap incremental syncs; Microsoft tracks the cursor for us via the delta token |
| Lazy env validation | Build-time tooling (page collection, etc.) doesn't crash when env is incomplete — errors surface at request time with a clear list of missing vars |
| Edge middleware as a *cheap pre-check* only | Authoritative auth still happens server-side via `auth()`; middleware avoids serving page shells to obviously-unauthenticated users |
| In-memory rate limiter | MVP-grade; documented gap, see [GAPS.md](./GAPS.md) |
| `prompt=consent` on sign-in | Forces the consent screen so users always actually see what they're granting (avoids silent permission expansion) |
| Bounded pagination per sync run | A single Sync now click can't get stuck pulling thousands of pages — UX stays predictable, rate limit stays effective |
