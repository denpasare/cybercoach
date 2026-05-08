# AGENTS.md

## Cursor Cloud specific instructions

### Project Overview

Airbnb Lead Scraper — a monorepo with an Express.js backend (port 3001) and React/Vite frontend (port 3000). The scraper uses Playwright/Chromium to navigate Google Maps and extract property manager leads into SQLite.

**Important:** The `main` branch is a stub. All application code lives on feature branches (e.g. `cursor/airbnb-lead-scraper-efa2`). Check out the appropriate feature branch before doing any work.

### Running Services

| Service | Command | Port |
|---------|---------|------|
| Backend (Express + SQLite) | `npm run dev:backend` | 3001 |
| Frontend (Vite React) | `npm run dev:frontend` | 3000 |

Both commands are run from the workspace root. The frontend proxies `/api` requests to the backend automatically via Vite config.

### Key Endpoints

- `GET /api/health` — health check
- `GET /api/leads` — list leads (supports `?page=`, `?limit=`, `?sort=`, `?tag=`)
- `POST /api/scrape/start` — start a scrape job (body: `{query, maxResults, enrich}`)
- `GET /api/scrape/progress/:jobId` — SSE stream for real-time scrape progress
- `GET /api/scrape/jobs` — list recent scrape jobs

### Gotchas

- **SQLite DB auto-creates** at `backend/data/leads.db` on first backend start. No migrations needed.
- **Playwright Chromium** must be installed (`npx --prefix backend playwright install --with-deps chromium`). The update script handles this.
- **`.env` file** must exist at `backend/.env` before the backend starts. Copy from `backend/.env.example` if missing. The update script handles this.
- **No lint or test scripts** are currently defined in the package.json files. There is no ESLint config or test framework set up.
- **Scraping requires internet access** — the Playwright browser navigates to Google Maps live.
- **Nodemon** watches all files for the backend dev server — installing new packages will trigger a restart automatically.
