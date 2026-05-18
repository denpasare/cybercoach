# Setup — every credential, every step

This is the exhaustive setup guide. If you follow it top-to-bottom, you
will have either:

- a fully working local dev environment (no external accounts required), **or**
- a real production-style deployment connected to your own Microsoft tenant.

## Prerequisites

| Tool | Minimum version | Notes |
| --- | --- | --- |
| Node.js | 20.x | 22.x tested |
| npm | 10.x | bundled with Node 20+ |
| PostgreSQL | 14+ | 16 used in `docker-compose.yml` |
| Docker (optional) | 24+ | for the bundled Postgres |
| `openssl` (optional) | any | for generating secrets |

## Credentials checklist

By the end of setup, your `.env` will contain values for all of these:

| Variable | Required? | Type | What it is |
| --- | --- | --- | --- |
| `DATABASE_URL` | Always | Postgres URL | Connection string for your DB |
| `AUTH_SECRET` | Always | base64 string (≥32 chars) | NextAuth signs/encrypts JWTs and tokens with this |
| `NEXTAUTH_URL` | Always in prod | URL | Public origin of the app (no trailing slash) |
| `TOKEN_ENCRYPTION_KEY` | Always | base64-encoded 32 bytes | AES-256-GCM key for encrypting OAuth tokens at rest |
| `AUTH_MICROSOFT_ENTRA_ID_ID` | Real login | string | Microsoft Entra "Application (client) ID" |
| `AUTH_MICROSOFT_ENTRA_ID_SECRET` | Real login | string | Microsoft Entra client secret **value** (not the secret ID) |
| `AUTH_MICROSOFT_ENTRA_ID_TENANT_ID` | Real login | string | Tenant ID, or `common` for multi-tenant + personal accounts |
| `ENABLE_DEV_AUTH` | Optional | `"true"` / `"false"` | If `true`, exposes the dev-mode shortcut; **must be `false` in prod** |

The bootstrap script generates the always-required ones for you on
first run. The Microsoft ones you have to fetch yourself (see below).

## Option A — Local dev (no Microsoft account)

This is the fastest path. The app's dev mode lets you exercise the full
UX (sign in → sync → browse) without registering an Azure app.

```bash
git clone <repo>
cd <repo>
npm install
npm run dev
```

What `npm run dev` does (see `scripts/dev-bootstrap.mjs`):

1. Creates `.env` with safe defaults if it doesn't exist.
2. Generates `AUTH_SECRET` (`crypto.randomBytes(32)` → base64) — only if missing.
3. Generates `TOKEN_ENCRYPTION_KEY` (`crypto.randomBytes(32)` → base64) — only if missing.
4. Fills `DATABASE_URL` with `postgresql://emailyzer:emailyzer@127.0.0.1:5432/emailyzer?schema=public` if missing.
5. Sets `ENABLE_DEV_AUTH="true"` if missing.
6. Brings up Postgres via `docker compose up -d postgres` (falls back to
   native Postgres on `:5432` if Docker isn't installed).
7. Waits for the port to accept connections (up to 60s).
8. Runs `npx prisma db push` to apply the schema.
9. Execs `next dev`.

Then open <http://localhost:3000> and click **"Sign in as dev user
(skip Microsoft)"**. The dashboard appears with a synthetic inbox after
you hit **Sync now**. See [DEVELOPMENT.md](./DEVELOPMENT.md) for the
dev-mode internals.

## Option B — Real Microsoft Entra ID

Use this when you want a real OAuth round-trip with Microsoft and real
Outlook emails.

### B.1 — Register the Microsoft Entra ID app

1. Sign in to the [Azure portal](https://portal.azure.com).
2. Open **Microsoft Entra ID** → **App registrations** → **New registration**.
3. Fill out the form:
   - **Name**: `Emailyzer (local)` (or whatever you want)
   - **Supported account types**: choose what fits:
     - *Single tenant* — only users in your tenant
     - *Multitenant* — any work/school org
     - *Multitenant + personal Microsoft accounts* — also covers `outlook.com`, `live.com`, `hotmail.com`
   - **Redirect URI**:
     - Platform: **Web**
     - URI: `http://localhost:3000/api/auth/callback/microsoft-entra-id`
   - Click **Register**.
4. On the **Overview** page, copy:
   - **Application (client) ID** → goes into `AUTH_MICROSOFT_ENTRA_ID_ID`
   - **Directory (tenant) ID** → goes into `AUTH_MICROSOFT_ENTRA_ID_TENANT_ID`
     - Or use `common` if your app should accept any work/school + personal account.
     - Or use `organizations` for any work/school account.
     - Or use `consumers` for personal Microsoft accounts only.
5. Open **Certificates & secrets** → **Client secrets** → **New client secret**.
   - Description: `Emailyzer local`
   - Expires: pick any duration
   - Click **Add**, then copy the **Value** column (it's only shown once)
     → goes into `AUTH_MICROSOFT_ENTRA_ID_SECRET`.
   - **Important**: copy the *Value*, **not** the *Secret ID*. The Secret
     ID is just a metadata identifier; the Value is the actual secret.
6. Open **API permissions** → **Add a permission** → **Microsoft Graph**
   → **Delegated permissions**, then check:
   - `openid`
   - `email`
   - `profile`
   - `offline_access`
   - `Mail.Read`
   Click **Add permissions**.
7. For tenants where admin consent is required, click **Grant admin
   consent for <tenant>**. Personal Microsoft accounts and multi-tenant
   setups don't need this — end-users will see a consent screen on
   first sign-in.

### B.2 — Add a production redirect URI when you deploy

Each environment (preview, prod) needs its own redirect URI registered
on the same app:

- Open the app → **Authentication** → **Web** → **Add URI**.
- Add `https://your.domain.com/api/auth/callback/microsoft-entra-id`.
- Save.

The callback path is always
`/api/auth/callback/microsoft-entra-id` (provider id is fixed by
NextAuth — do not change it).

### B.3 — Wire it up locally

```bash
cp .env.example .env
# fill in the Microsoft values
# then explicitly turn off dev mode:
#   ENABLE_DEV_AUTH="false"
npm install
npm run dev
```

Open <http://localhost:3000>, click **Continue with Microsoft**,
consent to `Mail.Read`, then hit **Sync now**. Your last ~50 Inbox
messages (one page) load into the dashboard. Subsequent syncs use the
delta token and only fetch changes.

## Generating secrets manually

The bootstrap does this automatically, but here are the commands if
you want to do it yourself:

```bash
# AUTH_SECRET — 32 bytes, base64
openssl rand -base64 32

# TOKEN_ENCRYPTION_KEY — 32 bytes, base64
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Both keys must be kept secret. Losing `TOKEN_ENCRYPTION_KEY` makes
existing OAuth tokens in the DB un-decryptable (users will have to
re-authenticate); changing `AUTH_SECRET` invalidates all existing
sessions (users get signed out).

## `.env.example` reference

```
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/emailyzer?schema=public"
AUTH_SECRET=""
NEXTAUTH_URL="http://localhost:3000"
AUTH_MICROSOFT_ENTRA_ID_ID=""
AUTH_MICROSOFT_ENTRA_ID_SECRET=""
AUTH_MICROSOFT_ENTRA_ID_TENANT_ID="common"
TOKEN_ENCRYPTION_KEY=""
ENABLE_DEV_AUTH="false"
```

## Common mistakes

| Symptom | Cause | Fix |
| --- | --- | --- |
| `AADSTS7000215: Invalid client secret provided` | You copied the Secret ID, not the Value | Re-open the secret in Azure and copy the **Value** column |
| `AADSTS50011: The reply URL does not match` | Redirect URI mismatch | Add the exact callback URL to the app's **Authentication → Web → Redirect URIs** |
| `AADSTS65001: The user or administrator has not consented` | App permissions not granted | Either click **Grant admin consent**, or let an end-user accept the consent screen on first sign-in |
| Login succeeds but `Sync now` fails with 401 | Refresh token missing (`offline_access` not granted) | Confirm `offline_access` is in the requested scopes (it is by default in `src/lib/auth.ts`); re-consent to the app |
| Login button does nothing in prod | `NEXTAUTH_URL` is wrong | Set it to the exact public origin, no trailing slash |
| `Invalid server environment` on boot | Missing env vars | The error message lists which ones — fill them in `.env` |
| Tokens stop decrypting | `TOKEN_ENCRYPTION_KEY` changed | See [SECURITY.md](./SECURITY.md) on key rotation; in practice users just need to sign in again |
