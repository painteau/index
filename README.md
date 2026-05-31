# Index

A personal startpage built with Vite + Vanilla JS, deployed on Cloudflare Pages with D1 (SQLite) as database.

**Features**
- Clock with date (French locale)
- Search bar — Google, DuckDuckGo, Brave, Bing, Qwant — type anywhere to focus
- Weather widget — current conditions, rain today, rain next hour, 12h chart (Open-Meteo, no API key required)
- Apps and bookmarks by category (stored in Cloudflare D1)
- REST API via Cloudflare Pages Functions

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Vite + Vanilla JS |
| Hosting | Cloudflare Pages |
| API | Cloudflare Pages Functions |
| Database | Cloudflare D1 (SQLite) |

## Local development

### Prerequisites

- Node.js 18+
- A [Cloudflare account](https://dash.cloudflare.com) (free tier is enough)

### Setup

```bash
# Install dependencies
npm install

# Create the D1 database
npm run db:create
# Copy the returned database_id into wrangler.toml

# Run migrations locally
npm run db:migrate:local

# Start dev server (frontend only)
npm run dev

# Or with the Workers runtime (API + D1 locally)
npm run pages:dev
```

### Environment variables

No secrets required in dev. For production you only need the D1 binding configured in `wrangler.toml`.

If you want to use a paid weather API (OpenWeatherMap, WeatherAPI…), add a key in the app settings — it is stored in D1, never in the source code.

## Deploy to Cloudflare Pages

```bash
# 1. Create the D1 database (if not done yet)
npm run db:create

# 2. Update wrangler.toml with the returned database_id

# 3. Run migrations on the remote database
npm run db:migrate:remote

# 4. Build and deploy
npm run build
npm run pages:deploy
```

Or connect the GitHub repo to Cloudflare Pages for automatic deployments on push:
- Build command: `npm run build`
- Build output: `dist`
- Root: `/`

## API

All endpoints are under `/api/`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/apps` | List all apps |
| POST | `/api/apps` | Create an app |
| PUT | `/api/apps/:id` | Update an app |
| DELETE | `/api/apps/:id` | Delete an app |
| GET | `/api/categories` | List all categories |
| POST | `/api/categories` | Create a category |
| PUT | `/api/categories/:id` | Update a category |
| DELETE | `/api/categories/:id` | Delete a category |
| GET | `/api/bookmarks` | List all bookmarks |
| POST | `/api/bookmarks` | Create a bookmark |
| PUT | `/api/bookmarks/:id` | Update a bookmark |
| DELETE | `/api/bookmarks/:id` | Delete a bookmark |
| GET | `/api/settings` | Get all settings |
| PUT | `/api/settings` | Update settings |

## Project structure

```
index/
├── index.html              # Entry point
├── src/
│   ├── main.js             # App logic (clock, search, weather)
│   └── style.css           # Styles
├── functions/
│   └── api/
│       └── [[route]].js    # Cloudflare Pages Function (REST API)
├── migrations/
│   └── 0001_initial.sql    # D1 schema
├── wrangler.toml           # Cloudflare config
└── vite.config.js
```

## License

MIT
