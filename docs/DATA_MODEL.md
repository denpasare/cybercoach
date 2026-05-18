# Data model

Source of truth: [`prisma/schema.prisma`](../prisma/schema.prisma). This
doc is the human-readable companion.

## ER diagram

```
                ┌──────────┐                ┌──────────────┐
                │   User   │ 1 ─────────► 1 │  SyncState   │
                │          │                │              │
                │ id       │                │ userId (pk)  │
                │ email    │                │ deltaToken   │
                │ name     │                │ lastSyncedAt │
                │ image    │                └──────────────┘
                └──────────┘
                 │   │   │
                 │   │   │ 1
                 │   │   ▼
                 │   │   ┌──────────────────────────┐
                 │   │   │         Email            │
                 │   │   │                          │
                 │   │   │ id, userId, messageId    │
                 │   │   │ subject, fromEmail, …    │
                 │   │   │ receivedAt, snippet, …   │
                 │   │   └──────────────────────────┘
                 │   │
                 │   │ 1
                 │   ▼
                 │   ┌────────────┐
                 │   │  Session   │
                 │   │            │
                 │   │ id         │
                 │   │ token (uq) │
                 │   │ expires    │
                 │   └────────────┘
                 │ 1
                 ▼
                 ┌──────────────────────────────────────┐
                 │              Account                 │
                 │                                      │
                 │ id, provider, providerAccountId      │
                 │ access_token   (AES-256-GCM cipher)  │
                 │ refresh_token  (AES-256-GCM cipher)  │
                 │ id_token       (AES-256-GCM cipher)  │
                 │ expires_at, scope, token_type        │
                 └──────────────────────────────────────┘
```

All FKs cascade-delete from `User` — deleting a user takes the entire
account, session, sync state, and email rows with them.

## Models

### `User`

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  image         String?
  emailVerified DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts   Account[]
  sessions   Session[]
  emails     Email[]
  syncState  SyncState?
}
```

| Column | Source |
| --- | --- |
| `email` | Microsoft profile email (or `dev@emailyzer.local` in dev mode) |
| `name`, `image` | Microsoft profile |
| `emailVerified` | Unused by this app; required by the NextAuth adapter contract |

### `Account`

One row per linked external identity. The OAuth tokens are stored
**encrypted** as `base64(iv ‖ tag ‖ ciphertext)` using AES-256-GCM.

```prisma
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String           // "oidc"
  provider          String           // "microsoft-entra-id"
  providerAccountId String           // Microsoft "oid" / sub

  access_token  String? @db.Text     // ENCRYPTED at rest
  refresh_token String? @db.Text     // ENCRYPTED at rest
  expires_at    Int?                 // unix seconds
  token_type    String?              // "Bearer"
  scope         String?              // space-separated scope list
  id_token      String? @db.Text     // ENCRYPTED at rest
  session_state String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
}
```

| Column | Notes |
| --- | --- |
| `provider` | Hard-coded to `"microsoft-entra-id"` in this app |
| `providerAccountId` | Stable Microsoft user identifier; combined with `provider` as a unique key |
| `access_token` | Decrypted at request time by `src/lib/tokens.ts` |
| `refresh_token` | Decrypted only when an access token is being refreshed; re-encrypted on write |
| `id_token` | Stored but not currently used by the app |
| `expires_at` | Used by `getValidAccessToken` to decide whether to refresh (with a 60-second skew) |

### `Session`

DB-backed session — the auth cookie is just the lookup key.

```prisma
model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

The `sessionToken` value goes into the HTTP-only
`authjs.session-token` cookie. Server-side revocation = `DELETE FROM
"Session" WHERE id = ...`.

### `VerificationToken`

Required by the NextAuth Prisma adapter contract for email-link flows.
Currently unused (no email provider configured).

```prisma
model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

### `Email`

Cached projection of Microsoft Graph messages. We deliberately do
**not** mirror the full RFC822 body — only the fields the UI shows.

```prisma
model Email {
  id           String   @id @default(cuid())
  userId       String
  messageId    String           // Graph message id
  subject      String?
  fromEmail    String?
  fromName     String?
  receivedAt   DateTime?
  snippet      String?  @db.Text
  bodyPreview  String?  @db.Text
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, messageId])
  @@index([userId, receivedAt])
}
```

| Column | Source |
| --- | --- |
| `messageId` | Graph `id` field — globally unique per mailbox version |
| `subject` | `message.subject` |
| `fromEmail`, `fromName` | `message.from.emailAddress.address` / `.name` |
| `receivedAt` | `message.receivedDateTime` parsed to `DateTime` |
| `snippet`, `bodyPreview` | Both set from `message.bodyPreview` — kept as separate columns so a future change can populate them differently without a migration |

The `(userId, messageId)` unique constraint is what makes
`prisma.email.upsert` work for delta sync — incremental updates land
on the same row.

The `(userId, receivedAt)` index supports the dashboard query, which
orders by `receivedAt DESC` and filters by `userId`.

### `SyncState`

One row per user. Tracks the Graph delta cursor so each subsequent
sync only fetches what's new.

```prisma
model SyncState {
  userId       String   @id
  deltaToken   String?  @db.Text    // a full Graph URL (delta or next)
  lastSyncedAt DateTime?
  updatedAt    DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

- `deltaToken` is stored as the entire URL Microsoft hands back (either
  `@odata.deltaLink` once we've caught up, or the last
  `@odata.nextLink` if we hit the per-run page cap). Storing the full
  URL avoids re-assembling query parameters on the next run.
- `lastSyncedAt` powers the "Last sync: 2m ago" indicator.

## Migrations

This MVP uses `prisma db push` for the local dev loop. For production
adopt versioned migrations:

```bash
npx prisma migrate dev --name <description>    # development
npx prisma migrate deploy                       # production
```

The first call to `migrate dev` will produce `prisma/migrations/<timestamp>_init/`
matching the current schema. Commit it.

## Querying examples

```ts
// Get the latest 200 emails for the dashboard.
prisma.email.findMany({
  where: { userId },
  orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
  take: 200,
});

// Force a fresh full sync by clearing the delta token.
await prisma.syncState.update({
  where: { userId },
  data: { deltaToken: null },
});

// Revoke all sessions for a user (forces re-signin everywhere).
await prisma.session.deleteMany({ where: { userId } });

// Disconnect a user from Microsoft (next sync will 400 unless dev mode).
await prisma.account.deleteMany({
  where: { userId, provider: "microsoft-entra-id" },
});
```
