# Airbnb Lead Scraper

An MVP web application for extracting and structuring leads of Airbnb property managers and short-term rental agencies in Miami using Google Maps data.

## Features

- **Google Maps Scraper** — extracts business name, address, phone, website, rating, reviews count from search results
- **Lead Enrichment** — scrapes contact pages for emails, normalizes phone numbers, tags leads as "hot"
- **Lead Scoring** — automatic score (+2 website, +2 phone, +1 rating>4.0, +1 reviews>10)
- **Dashboard** — sortable table with filters (website, rating, hot leads), pagination, CSV export
- **Scrape Page** — start jobs with custom queries, real-time progress via SSE logs
- **Duplicate prevention** — upsert by name + address

## Project Structure

```
airbnb-lead-scraper/
├── backend/                    # Express API + scraper
│   ├── src/
│   │   ├── db/
│   │   │   └── database.js     # SQLite via better-sqlite3
│   │   ├── scraper/
│   │   │   ├── googleMapsScraper.js   # Playwright scraper
│   │   │   └── websiteEnricher.js     # Email extraction + phone normalization
│   │   ├── services/
│   │   │   └── leadService.js  # CRUD, scoring, tagging
│   │   ├── routes/
│   │   │   ├── leads.js        # GET /api/leads, export CSV
│   │   │   └── scrape.js       # POST /api/scrape/start, SSE progress
│   │   └── index.js            # Express entry point
│   ├── data/                   # SQLite DB file (auto-created)
│   └── package.json
├── frontend/                   # React + Vite + Tailwind
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx   # /dashboard
│   │   │   └── Scrape.jsx      # /scrape
│   │   ├── components/
│   │   │   ├── LeadsTable.jsx
│   │   │   ├── Filters.jsx
│   │   │   ├── ProgressLog.jsx
│   │   │   ├── ScoreBar.jsx
│   │   │   └── StarRating.jsx
│   │   └── hooks/
│   │       └── useLeads.js
│   └── package.json
└── README.md
```

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+

### 1. Install dependencies

```bash
npm run install:all
npm run install:playwright
```

### 2. Configure backend

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
PORT=3001
FRONTEND_URL=http://localhost:3000
HEADLESS=true          # set to false to watch the browser
DELAY_MIN=1500         # ms between actions (avoid blocks)
DELAY_MAX=3000
```

### 3. Start the backend

```bash
npm run start:backend
# API runs on http://localhost:3001
```

### 4. Start the frontend (dev)

```bash
npm run dev:frontend
# UI runs on http://localhost:3000
```

### 5. Open the app

- Dashboard: http://localhost:3000/dashboard
- Scrape: http://localhost:3000/scrape

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/leads` | List leads (filterable) |
| GET | `/api/leads/:id` | Get single lead |
| GET | `/api/leads/export/csv` | Download CSV |
| POST | `/api/scrape/start` | Start scrape job |
| GET | `/api/scrape/progress/:jobId` | SSE log stream |
| GET | `/api/scrape/jobs` | Recent scrape jobs |

### Query params for `/api/leads`

| Param | Type | Description |
|-------|------|-------------|
| `hasWebsite` | `true\|false` | Filter by website presence |
| `minRating` | number | Minimum rating |
| `hotOnly` | `true` | Only hot leads |
| `search` | string | Name or address search |
| `page` | number | Page (default 1) |
| `limit` | number | Per page (default 50) |

### POST `/api/scrape/start` body

```json
{
  "query": "Airbnb property management Miami",
  "maxResults": 40,
  "enrich": true
}
```

## Lead Object

```json
{
  "id": 1,
  "name": "Miami Stays LLC",
  "address": "123 Ocean Dr, Miami Beach, FL",
  "phone": "(305) 555-0100",
  "website": "https://miamistays.com",
  "google_maps_url": "https://www.google.com/maps/place/...",
  "rating": 4.8,
  "reviews_count": 127,
  "email": "info@miamistays.com",
  "tags": ["hot"],
  "score": 6,
  "created_at": "2026-05-08T17:00:00.000Z"
}
```

## Lead Scoring

| Condition | Points |
|-----------|--------|
| Has website | +2 |
| Has phone | +2 |
| Rating > 4.0 | +1 |
| Reviews > 10 | +1 |
| **Max score** | **6** |

A lead is tagged **"hot"** if it has a website, phone, AND rating > 4.3.

## Extending to Other Cities

Change the search query on the Scrape page, e.g.:
- `"Airbnb property management Los Angeles"`
- `"vacation rental agency New York"`

Future: add a `city` field to the lead schema and filter by it in the dashboard.

## Notes on Scraping

- Headless mode is on by default — set `HEADLESS=false` to watch the browser
- Random delays (`DELAY_MIN`/`DELAY_MAX`) are used between actions to avoid detection
- Google Maps DOM selectors may change over time — update `googleMapsScraper.js` if needed
- For large batches, consider using a residential proxy
