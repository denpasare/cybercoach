# Development

## TL;DR

```bash
npm install
npm run dev           # one-command bootstrap (env, DB, schema, dev server)
npm run test:e2e      # in another terminal — drives the full happy path
```

## npm scripts

| Command              | What it does |
| -------------------- | ------------ |
| `npm run dev`        | Runs `scripts/dev-bootstrap.mjs`: ensures `.env`, starts Postgres, runs `prisma db push`, runs `next dev`. Idempotent. |
| `npm run dev:next`   | Just `next dev`. Skips bootstrap (assumes env and DB are already correct). |
| `npm run db:up`      | `docker compose up -d postgres` |
| `npm run db:down`    | `docker compose down` |
| `npm run db:reset`   | `docker compose down -v && docker compose up -d postgres` — wipes the Postgres volume |
| `npm run db:logs`    | Tail Postgres container logs |
| `npm run db:push`    | `prisma db push` — sync the schema without creating a migration file |
| `npm run db:migrate` | `prisma migrate dev` — create + apply a versioned migration |
| `npm run build`      | `prisma generate && next build` |
| `npm run start`      | `next start` |
| `npm run lint`       | `next lint` |
| `npm run typecheck`  | `tsc --noEmit` |
| `npm run test:e2e`   | `node scripts/smoke-e2e.mjs` — end-to-end smoke test against `http://localhost:3000` |

## Dev mode

`ENABLE_DEV_AUTH=true` (default in local dev) flips on a deliberate
local-only shortcut so the app is fully usable without any Microsoft
credentials.

### What dev mode adds

1. **`GET|POST /api/dev/signin`** — `src/app/api/dev/signin/route.ts`
   - Upserts a user with `email=dev@emailyzer.local`.
   - Creates a `Session` row (`sessionToken = randomBytes(32).toString("hex")`, 30-day expiry).
   - Sets the `authjs.session-token` cookie (HTTP-only, SameSite=Lax,
     `Secure` only when `NEXTAUTH_URL` starts with `https://`).
   - Returns `307` → `/dashboard`.
   - Returns **`404` when `ENABLE_DEV_AUTH` is anything other than `true`**.
2. **Login UI button** — `/login` renders a "Sign in as dev user
   (skip Microsoft)" link only when the flag is on.
3. **Mock Graph source** — `src/lib/mock-graph.ts`
   - `syncEmails(userId)` catches `MissingMicrosoftAccountError` (the
     dev user has no `Account` row); when dev mode is on, it routes to
     `syncMockEmails(userId)`.
   - First sync seeds 5 realistic-looking messages.
   - Subsequent syncs append a fresh `"Sync ran at <time>"` message so
     the **Sync now** button has visible effects on every click.
4. **Dashboard badge** — `/dashboard` renders a yellow **DEV MODE**
   pill next to the logo so you never confuse synthetic data with real
   Outlook data.

### Dev mode never affects real users

The fall-through is gated on `MissingMicrosoftAccountError`. A user
who actually signed in with Microsoft has an `Account` row, so
`getValidAccessToken` succeeds and the real Graph code path runs — the
same code, regardless of whether dev mode is on.

### Turn it off for prod

Set `ENABLE_DEV_AUTH="false"` (or remove the var). The dev-mode
helpers all short-circuit:

- `isDevModeEnabled()` returns `false`.
- `/api/dev/signin` returns `404`.
- The login page hides the dev button.
- The dashboard hides the badge.
- `syncEmails()` never falls back to the mock source.

## End-to-end smoke test

`npm run test:e2e` runs `scripts/smoke-e2e.mjs` against
`http://localhost:3000` (override with `BASE_URL=...`). It drives the
real HTTP API with manual cookie tracking — no browser, no Playwright
runtime. It asserts:

```
✓ GET / → 200
✓ GET /dashboard (unauth) → 307 → /login?callbackUrl=%2Fdashboard
✓ GET /api/dev/signin → 307 + session cookie
✓ GET /dashboard (auth) → 200
✓ POST /api/sync → 200 (upserted >= 1)
✓ POST /api/sync (rapid x8) → eventually 429
```

The script exits non-zero on any failed step.

## File layout

```
src/
├── app/                            # Next.js App Router
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts    # NextAuth handlers
│   │   ├── dev/signin/route.ts            # Dev-only sign-in
│   │   └── sync/route.ts                  # POST /api/sync
│   ├── dashboard/
│   │   ├── actions.ts                     # Server actions (signOut)
│   │   ├── dashboard-client.tsx           # Client UI
│   │   ├── loading.tsx                    # Loading skeleton
│   │   └── page.tsx                       # Server component
│   ├── login/page.tsx
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── auth.ts                     # NextAuth config (MicrosoftEntraID)
│   ├── auth-adapter.ts             # Encrypted Prisma adapter wrapper
│   ├── auth-handler.ts             # GET/POST re-export
│   ├── crypto.ts                   # AES-256-GCM helpers
│   ├── dev-mode.ts                 # ENABLE_DEV_AUTH gate
│   ├── env.ts                      # zod-validated env loader
│   ├── graph.ts                    # syncEmails() — Graph delta sync
│   ├── mock-graph.ts               # Dev-mode synthetic email source
│   ├── prisma.ts                   # PrismaClient singleton
│   ├── rate-limit.ts               # In-memory token-bucket-ish limiter
│   └── tokens.ts                   # getValidAccessToken() + refresh
├── middleware.ts                   # Edge middleware (gate /dashboard/*)
└── types/next-auth.d.ts            # Session type augmentation

prisma/schema.prisma                # DB schema (User, Account, Session, …)
scripts/
├── dev-bootstrap.mjs               # One-command local dev orchestrator
└── smoke-e2e.mjs                   # End-to-end HTTP test
docker-compose.yml                  # Local Postgres
```

## Troubleshooting

| Symptom | Likely cause | Try |
| --- | --- | --- |
| `npm run dev` says "Postgres never came up" | No Docker installed and no native Postgres on `:5432` | Install Docker Desktop, or start your own Postgres (`pg_ctlcluster 16 main start` on Ubuntu, `brew services start postgresql` on macOS), then re-run |
| `prisma db push` fails with `P1000` auth error | DB credentials in `DATABASE_URL` don't match the running Postgres | Either edit `DATABASE_URL` or recreate the DB with `npm run db:reset` |
| `npm run dev` regenerates secrets every time | You're deleting `.env` between runs | Don't delete `.env`; the bootstrap preserves existing values |
| 5 emails appear on first sync but never new ones | Rate limiter (5/min/user) tripped — check the API response | Wait one minute, or restart the dev server to flush the in-memory bucket |
| `/api/dev/signin` returns 404 | `ENABLE_DEV_AUTH` is not set to `true` | Edit `.env`, set `ENABLE_DEV_AUTH="true"`, restart |
| Real Microsoft login redirects back to `/login?error=...` | Misconfigured app registration | See [SETUP.md → Common mistakes](./SETUP.md#common-mistakes) |
| Dashboard shows `Last sync: never` after a real signup but no emails | `Mail.Read` not granted | Reset consent: in the Azure portal app → **API permissions** → **Grant admin consent**, or sign out and sign back in to re-trigger the consent dialog |
| Build complains about a missing env var | Build-time eager validation | `src/lib/env.ts` lazily validates; if you've extended it eagerly, gate validation behind a runtime check |
| TypeScript can't find `@/...` paths | tsconfig not picked up by your editor | Restart the TS server; `tsconfig.json` has `paths: { "@/*": ["./src/*"] }` |

## Suggested workflow loop

```
edit code →
  npx tsc --noEmit            # cheap, no DB needed
  npx next lint
edit a route or sync logic →
  npm run dev:next            # if Postgres already running
  npm run test:e2e            # against the running server
edit the schema →
  npx prisma db push          # apply
  npx prisma studio           # browse the data (optional)
```
