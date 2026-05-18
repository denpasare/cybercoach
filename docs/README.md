# Emailyzer documentation

This folder is the canonical reference for the Emailyzer MVP — every
credential the app uses, every endpoint it exposes, every column in
the database, and every gap that's intentionally not built yet.

> If something here disagrees with the code, the code wins. Open an
> issue (or just fix the doc) when you spot a drift.

## Map

| Doc | What's inside |
| --- | --- |
| [SETUP.md](./SETUP.md)             | Every credential the app needs, exactly where to get it, and how to put it in `.env`. Includes the full Microsoft Entra ID app-registration walkthrough and one-command local setup. |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Day-to-day dev workflow. Dev mode (mock auth + mock Graph), npm scripts, end-to-end smoke test, troubleshooting. |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | High-level overview, request flows for sign-in, sync, and dashboard render. Where each concern lives in `src/`. |
| [DATA_MODEL.md](./DATA_MODEL.md)   | Prisma schema, every model and field, indexes, encryption notes. |
| [API.md](./API.md)                 | Every HTTP route, request shape, response shape, auth requirements, rate limits. |
| [SECURITY.md](./SECURITY.md)       | Token encryption (AES-256-GCM) details, session cookies, CSRF posture, rate limiting, threat model, key-rotation plan. |
| [OPERATIONS.md](./OPERATIONS.md)   | Production deployment shape, env vars, observability gaps, backup/restore. |
| [GAPS.md](./GAPS.md)               | Everything that's deliberately not in the MVP, plus the smallest patches you'd make if you wanted to ship to real users tomorrow. |

## At-a-glance: which credentials does this app need?

A complete deployment needs four kinds of secrets. Full instructions and
how-to-obtain steps are in [SETUP.md](./SETUP.md); this is just the index.

| Credential | Env var(s) | Where it comes from | Required for |
| --- | --- | --- | --- |
| Postgres connection string | `DATABASE_URL` | Your DB host (RDS / Supabase / Neon / `docker compose`) | Always |
| NextAuth signing secret | `AUTH_SECRET` | `openssl rand -base64 32` | Always |
| Token-at-rest encryption key | `TOKEN_ENCRYPTION_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` | Always |
| Microsoft Entra ID app | `AUTH_MICROSOFT_ENTRA_ID_ID` <br/> `AUTH_MICROSOFT_ENTRA_ID_SECRET` <br/> `AUTH_MICROSOFT_ENTRA_ID_TENANT_ID` | [Azure portal → App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade) | Only when `ENABLE_DEV_AUTH=false` (i.e. real sign-in) |
| Public base URL | `NEXTAUTH_URL` | Your deployment URL | Always |
| Dev-mode flag | `ENABLE_DEV_AUTH` | You — `true` for local dev, `false` for prod | Optional |

Dev mode (`ENABLE_DEV_AUTH=true`) lets you run and test the entire app
**without any Microsoft credentials** — the bootstrap script defaults
to this. See [DEVELOPMENT.md](./DEVELOPMENT.md).
