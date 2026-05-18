# AGENTS.md

## Cursor Cloud specific instructions

### Overview

This repository is organized as multiple independent products on separate branches (not a traditional monorepo). The `main` branch is essentially empty. Key product branches:

- `cursor/airbnb-lead-scraper-efa2` — Express + React/Vite lead scraper
- `cursor/microsoft-email-sync-mvp-32c7` — Next.js email sync SaaS (requires PostgreSQL + Microsoft OAuth)
- `cursor/email-abuse-detection-system-4326` — Laravel email abuse detection

### Airbnb Lead Scraper (primary self-contained product)

**Stack:** Node.js 22+, Express backend (port 3001), React/Vite frontend (port 3000), SQLite via better-sqlite3, Playwright for scraping.

**Running the app:**

```bash
# From workspace root:
cp backend/.env.example backend/.env   # only needed once
npm run dev:backend    # Express API on :3001
npm run dev:frontend   # Vite dev server on :3000 (proxies /api to :3001)
```

**Key notes:**
- The Vite dev server proxies all `/api` requests to the backend at localhost:3001.
- SQLite database is auto-created at `backend/data/leads.db` on first backend start.
- No lint or test scripts are configured in this project.
- Playwright chromium must be installed separately: `npx --prefix backend playwright install chromium --with-deps`
- Scraping functionality requires network access to Google Maps. In environments without full internet, the scrape jobs will start but may not find results.
- The `.env` file only needs `PORT`, `FRONTEND_URL`, `HEADLESS`, `DELAY_MIN`, `DELAY_MAX` — no secrets required for the basic app to run.
