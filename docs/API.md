# HTTP API reference

Every public-facing route in the app, with auth requirements, request
shape, response shape, and status codes.

Conventions:

- All routes run on Node.js runtime unless noted.
- JSON responses use `Content-Type: application/json`.
- `auth` column means: "is a valid session cookie required?"

## Pages (App Router)

| Method | Path | Auth | Renders | Notes |
| --- | --- | --- | --- | --- |
| GET | `/` | no | Landing page | Redirects to `/dashboard` if already signed in |
| GET | `/login` | no | Sign-in screen | Shows the dev-mode button only when `ENABLE_DEV_AUTH=true` |
| GET | `/dashboard` | **yes** | Two-pane inbox UI | Redirects to `/login?callbackUrl=/dashboard` if no session |

The protection is layered:
1. `src/middleware.ts` (Edge) redirects to `/login` when the
   `authjs.session-token` cookie is missing — cheap pre-check.
2. `src/app/dashboard/page.tsx` re-checks via `await auth()` and
   redirects if the session is missing or invalid — authoritative.

## NextAuth handlers

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET, POST | `/api/auth/[...nextauth]` | n/a | Owned by NextAuth. Hosts the OAuth flow (`/api/auth/signin/microsoft-entra-id`, `/api/auth/callback/microsoft-entra-id`, `/api/auth/signout`, `/api/auth/csrf`, `/api/auth/session`, etc.) |

The notable subpaths NextAuth exposes here:

- `GET /api/auth/signin/microsoft-entra-id` — kicks off OAuth
- `GET /api/auth/callback/microsoft-entra-id` — OAuth redirect target
  (this is the URI you register in the Azure portal)
- `POST /api/auth/signout` — clears the session cookie + DB session row
- `GET /api/auth/csrf` — returns the CSRF token used by NextAuth's own
  signin/signout forms

## `POST /api/sync`

Trigger a Microsoft Graph delta sync for the signed-in user.

- **Auth**: required (DB session)
- **Rate limit**: 5 requests / minute / user
- **Runtime**: Node.js (`runtime = "nodejs"`)
- **Cache**: `dynamic = "force-dynamic"`

### Request

```http
POST /api/sync
Cookie: authjs.session-token=<sessionToken>
```

No body, no query params.

### Responses

**200 OK** — sync ran successfully

```json
{
  "ok": true,
  "upserted": 12,
  "removed": 0,
  "pages": 2,
  "deltaTokenAdvanced": true
}
```

| Field | Type | Meaning |
| --- | --- | --- |
| `ok` | boolean | Always `true` on 200 |
| `upserted` | number | Messages created or updated during this run |
| `removed` | number | Messages deleted because Graph returned `@removed` |
| `pages` | number | How many Graph pages were fetched (cap = 10) |
| `deltaTokenAdvanced` | boolean | `true` if Graph returned an `@odata.deltaLink` (sync caught up) |

**401 Unauthorized** — no valid session

```json
{ "error": "Unauthorized" }
```

**400 Bad Request** — no linked Microsoft account (only possible when
`ENABLE_DEV_AUTH=false`; in dev mode this case routes to the mock)

```json
{ "error": "No Microsoft account linked. Please sign in again." }
```

**401 Unauthorized** — refresh token expired or revoked

```json
{ "error": "Microsoft token refresh failed. Please sign in again." }
```

**429 Too Many Requests** — per-user rate limit hit

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 37
Content-Type: application/json

{ "error": "Too many sync requests. Try again shortly." }
```

**500 Internal Server Error** — any other failure (logged server-side)

```json
{ "error": "Sync failed. Please try again." }
```

## `GET|POST /api/dev/signin` (dev only)

Open a session as a synthetic dev user without going through Microsoft.
Returns `404` unless `ENABLE_DEV_AUTH="true"`.

- **Auth**: not required (it grants auth)
- **Rate limit**: none
- **Runtime**: Node.js

### Request

```http
GET /api/dev/signin
```

Either `GET` or `POST` works. The `GET` form makes the link from
`/login` work without JavaScript.

### Responses

**307 Temporary Redirect** — when dev mode is on

```http
HTTP/1.1 307 Temporary Redirect
Location: http://localhost:3000/dashboard
Set-Cookie: authjs.session-token=<hex>; Path=/; Expires=...; HttpOnly; SameSite=Lax
```

The cookie is `Secure` if `NEXTAUTH_URL` starts with `https://`.

**404 Not Found** — when dev mode is off

```json
{ "error": "Not found" }
```

The dev user is upserted on `email = dev@emailyzer.local`. Re-hitting
this endpoint opens a new session row each time (the existing user
record is reused).

## Status code summary

| Code | Where you'll see it |
| --- | --- |
| 200 | Successful page render, successful `/api/sync` |
| 307 | Middleware redirect to `/login`, dev signin redirect to `/dashboard` |
| 400 | `/api/sync` for a user with no Microsoft account in prod mode |
| 401 | `/api/sync` for an unauthenticated request or when refresh fails |
| 404 | `/api/dev/signin` when dev mode is off |
| 429 | `/api/sync` rate limit |
| 500 | Any unhandled failure in sync (with details in server logs) |

## Headers and cookies

| Cookie | Purpose | Attributes |
| --- | --- | --- |
| `authjs.session-token` | Session token (HTTP) | `HttpOnly; SameSite=Lax; Path=/`. Mirrored as `__Secure-authjs.session-token` over HTTPS. |
| `authjs.csrf-token` | NextAuth's double-submit CSRF token | Issued automatically for the NextAuth handlers |
| `authjs.callback-url` | Where to redirect post-signin | Issued automatically |

Sync responses include `Retry-After` (seconds) on `429`.

## Examples

### Trigger a sync from the command line

```bash
# Sign in (dev mode) and capture the cookie.
curl -s -c jar.txt -L http://localhost:3000/api/dev/signin -o /dev/null

# Run a sync.
curl -s -b jar.txt -X POST http://localhost:3000/api/sync | jq

# Trigger the rate limit.
for i in $(seq 1 8); do
  curl -s -b jar.txt -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/sync
done
```

### Run the full smoke test

```bash
npm run test:e2e
# or
BASE_URL=https://staging.example.com npm run test:e2e
```
