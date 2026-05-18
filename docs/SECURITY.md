# Security

This document covers what the MVP does well, what it does adequately,
and what is **deliberately deferred** to keep the MVP small. Each
deferred item has a concrete patch path in [GAPS.md](./GAPS.md).

## Threat model (in scope for the MVP)

| Threat | Mitigation |
| --- | --- |
| Token theft from the database | OAuth tokens are AES-256-GCM encrypted with `TOKEN_ENCRYPTION_KEY`, which lives in env only — DB dumps alone are insufficient to call Microsoft Graph |
| Token theft from the browser | Browser never holds an access or refresh token. Only the opaque session cookie. |
| Session hijacking via XSS | Session cookie is `HttpOnly` — not readable from JS |
| Session hijacking via network sniff | Cookie is `Secure` over HTTPS (when `NEXTAUTH_URL` is `https://`). NextAuth automatically chooses the `__Secure-` cookie name in that case. |
| CSRF on sign-in | NextAuth's own signin/signout flows use a double-submit CSRF token (`authjs.csrf-token`) |
| CSRF on `/api/sync` | `SameSite=Lax` on the session cookie blocks cross-site `POST` flows; combined with origin checks this is sufficient for the MVP scope. See [GAPS.md](./GAPS.md) for hardening. |
| Sync abuse / DoS | Per-user 5/min in-memory rate limit on `/api/sync`; Graph backoff on 429/503 |
| Bypass of dashboard auth | Edge middleware pre-check **plus** authoritative `auth()` check inside the server component |
| Privilege escalation via dev shortcut | `/api/dev/signin` returns `404` whenever `ENABLE_DEV_AUTH` is not `true` |
| Token leakage via session callback | The session callback only exposes `id`, `name`, `email`, `image` — never tokens |

## Threat model (out of scope for the MVP)

Tracked in [GAPS.md](./GAPS.md); summarized here so you know they're known:

- Compromise of the running app instance (key rotation, KMS-backed
  envelope encryption, HSM-backed signing) — not addressed
- Multi-instance abuse via the in-memory rate limiter — see GAPS
- Account takeover via Microsoft tenant compromise — out of our hands
- Phishing / device theft — outside MVP scope
- Email content exfiltration via the dashboard — the dashboard *is*
  the intended surface for the email content

## Cookies

| Cookie | HttpOnly | Secure | SameSite | Path | Purpose |
| --- | --- | --- | --- | --- | --- |
| `authjs.session-token` | yes | yes (HTTPS) | Lax | `/` | Looks up the `Session` row |
| `__Secure-authjs.session-token` | yes | yes | Lax | `/` | Same, prefixed for HTTPS hosts |
| `authjs.csrf-token` | yes | yes (HTTPS) | Lax | `/` | NextAuth CSRF double-submit token |
| `authjs.callback-url` | no | yes (HTTPS) | Lax | `/` | Post-signin redirect target |

`Secure` is automatically chosen by NextAuth based on the request
origin / `NEXTAUTH_URL`. The dev signin route uses the same logic.

## Token encryption (`src/lib/crypto.ts`)

```
Algorithm: AES-256-GCM
Key:       32 bytes from TOKEN_ENCRYPTION_KEY (base64 or hex accepted)
IV:        12 random bytes per encryption (NIST-recommended for GCM)
Tag:       16 bytes (default)
Wire fmt:  base64( IV(12) || TAG(16) || CIPHERTEXT )
```

Properties:

- **Authenticated**: tampering with any byte of the ciphertext or
  metadata causes `decipher.final()` to throw, so silent corruption is
  detected.
- **Random IV per encryption**: re-encrypting the same plaintext
  produces different ciphertext, so an attacker can't tell whether
  two users have the same token.
- **Self-contained**: each ciphertext carries its own IV and tag —
  no separate columns to maintain.

### What encrypts what?

| Column | Encrypted when written by | Decrypted when needed by |
| --- | --- | --- |
| `Account.access_token` | `createEncryptedPrismaAdapter.linkAccount` | `tokens.ts → getValidAccessToken` |
| `Account.refresh_token` | same | same (only for refresh) |
| `Account.id_token` | same | not currently consumed |

Tokens are re-encrypted on every refresh by `tokens.ts`, so a
compromised-then-rotated `TOKEN_ENCRYPTION_KEY` will only re-protect
the next refresh — see the rotation note below.

## Sessions

- **Strategy**: database (`Session` model). The cookie carries an
  opaque token; the source of truth is the row.
- **Lifetime**: NextAuth defaults (30 days rolling). Configure
  `session.maxAge` in `src/lib/auth.ts` to change.
- **Revocation**: just `DELETE FROM "Session" WHERE id = ...`. The
  next request sees no session and is redirected to `/login`.

## Rate limiting (`src/lib/rate-limit.ts`)

- Per-user, per-route key (e.g. `sync:<userId>`).
- 5 requests / 60s window for `/api/sync`.
- In-memory map; resets when the process restarts; **not** shared
  across multiple Next.js instances. See [GAPS.md](./GAPS.md) for the
  Redis/Upstash upgrade path.

## Microsoft Graph

- All Graph calls go from the server to `graph.microsoft.com` over
  HTTPS using `fetch()`.
- Access token in `Authorization: Bearer ...`; never logged.
- Throttling: 429/503 honored with `Retry-After` (capped at 30s),
  max 3 attempts per request.

## CSRF posture in detail

For `/api/sync`:

- The session cookie is `SameSite=Lax`. The browser only sends it
  on:
  - Same-site requests, **and**
  - Top-level navigations from cross-site origins (but `POST` is not a
    valid top-level navigation method for cookie auth in any modern
    browser without a form submission).
- The endpoint is `POST` only. `GET` is not defined.
- Combined with the absence of CORS headers, this is a sufficient
  CSRF posture for an MVP that calls the endpoint from same-origin
  client JS only.

To harden further (recommended before exposing this app behind a
shared cookie origin or in a higher-risk deployment):

- Add `Origin` / `Referer` allowlist enforcement to `/api/sync`.
- Issue a CSRF token alongside the session cookie and require it as
  a header on mutating routes.
- Strict `SameSite=Strict` if the UX allows.

## Secret handling

| Secret | Where it lives | What happens if it leaks |
| --- | --- | --- |
| `DATABASE_URL` | `.env`, hosting platform | Direct DB access. With Postgres SSL and IP allowlisting, blast radius is limited; tokens are still encrypted at the column level. |
| `AUTH_SECRET` | `.env`, hosting platform | Attacker can forge NextAuth CSRF tokens and decrypt NextAuth-issued state cookies. Cannot directly forge a DB-backed session row. |
| `TOKEN_ENCRYPTION_KEY` | `.env`, hosting platform | Combined with a DB dump, allows full decryption of all stored OAuth tokens. Treat with the same care as a Microsoft client secret. |
| `AUTH_MICROSOFT_ENTRA_ID_SECRET` | `.env`, hosting platform | Attacker can impersonate the application identity to Microsoft. Rotate immediately in the Azure portal and update the env var. |

Rotation playbook:

- **`AUTH_SECRET`**: rotate by deploying the new value; all existing
  NextAuth state cookies are invalidated (signin/signup flows in
  progress will need to restart). DB sessions are unaffected.
- **`TOKEN_ENCRYPTION_KEY`**: simple form — rotate by deploying the
  new value; old tokens will fail to decrypt on next use, which
  surfaces as "Microsoft token refresh failed. Please sign in again."
  Users re-authenticate, the new tokens get encrypted with the new
  key. For zero-downtime rotation, see [GAPS.md](./GAPS.md) (envelope
  encryption / multi-key support is a documented gap).
- **`AUTH_MICROSOFT_ENTRA_ID_SECRET`**: rotate in the Azure portal
  (Certificates & secrets → New client secret), deploy the new value,
  delete the old secret in Azure.

## Logging

The current code:

- Logs failed sync attempts to `console.error` from `/api/sync`.
- Logs Prisma queries in development (config in `src/lib/prisma.ts`).
- Never logs tokens or cookies.

`/api/sync` returns generic error messages to the client; the detailed
error stays in server logs.

## Security checklist for production

- [ ] `ENABLE_DEV_AUTH` is unset or `"false"`
- [ ] `NEXTAUTH_URL` is the canonical HTTPS origin
- [ ] `AUTH_SECRET` and `TOKEN_ENCRYPTION_KEY` are unique per environment
- [ ] `DATABASE_URL` uses `sslmode=require` or stronger
- [ ] Microsoft app registration has only the production redirect URI in addition to dev
- [ ] Postgres is not publicly addressable
- [ ] Secrets are stored in your platform's secret manager, not in version control
- [ ] Process restarts (deploys) are infrequent enough that the in-memory rate limiter is meaningful, **or** Redis-backed rate limiting is in place
- [ ] Backups of the Postgres DB are taken and tested
- [ ] You have a documented incident response for: leaked `AUTH_SECRET`, leaked `TOKEN_ENCRYPTION_KEY`, leaked Microsoft client secret, leaked DB
