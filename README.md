# Index

A personal startpage built with Vite + Vanilla JS, deployed on Cloudflare Pages with D1 (SQLite) as database.

**Features**
- Clock with date (French locale)
- Search bar: Google, DuckDuckGo, Brave, Bing, Qwant or a custom engine; type anywhere to focus
- Weather widget: current conditions, rain today, rain next hour (Open-Meteo, no API key required)
- Apps by category, each one public or private (stored in Cloudflare D1)
- Settings behind a single admin password

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Vite + Vanilla JS |
| Hosting | Cloudflare Pages |
| API | Cloudflare Pages Functions |
| Database | Cloudflare D1 (SQLite) |

## Local development

### Prerequisites

- Node.js 24+ (the tests use `node:sqlite`)
- A [Cloudflare account](https://dash.cloudflare.com) (free tier is enough)

### Setup

```bash
# Install dependencies
npm install

# Create the D1 database
npm run db:create
# Copy the returned database_id into wrangler.toml

# Create the schema locally
npm run db:migrate:local

# Start dev server (frontend only, bound to 127.0.0.1)
npm run dev

# Or with the Workers runtime (API + D1 locally)
npm run pages:dev

# Tests (API against an in-memory SQLite, client helpers)
npm test
```

## Admin password

There is no "first visit sets the password" flow: an empty database would belong to
whoever opened it first. The password is hashed locally (PBKDF2-SHA256, salted) and the
hash is written to D1:

```bash
npm run hash-password      # prompts twice, input hidden, prints pbkdf2$...
npx wrangler d1 execute index-db --remote --command \
  "INSERT OR REPLACE INTO settings (key, value) VALUES ('admin_password', '<hash>'); DELETE FROM sessions;"
```

Once logged in, the password can also be changed from the settings panel, which signs
out every other session.

## Deploy to Cloudflare Pages

The project is not connected to GitHub: it is deployed by hand from a tag.

```bash
git checkout vX.Y.Z
npm ci
npm test
npm run db:migrate:remote   # idempotent
npm run build
npx wrangler pages deploy dist --project-name index --branch master
```

`public/_headers` sets the security headers of the static pages (CSP without inline
scripts, no framing); the API sets its own on every response.

## API

All endpoints are under `/api/` and same-origin only (no CORS). Writes require the
`X-Session-Token` header and a JSON body (`Content-Type: application/json`).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | no | `{ password }`, returns a 30-day session token |
| POST | `/api/auth/logout` | yes | Revokes the current session |
| GET | `/api/auth/check` | no | `{ ok }` for the given token |
| POST | `/api/auth/password` | yes | `{ current, next }`, revokes every session |
| GET | `/api/apps` | no | Public apps, or all apps with a session |
| POST | `/api/apps` | yes | Create an app (`http(s)` URLs only) |
| PUT | `/api/apps/:id` | yes | Update an app |
| DELETE | `/api/apps/:id` | yes | Delete an app |
| GET | `/api/categories` | no | Categories holding a public app, or all with a session |
| POST | `/api/categories` | yes | Create a category |
| PUT | `/api/categories/:id` | yes | Update a category |
| DELETE | `/api/categories/:id` | yes | Delete a category |
| GET | `/api/settings` | yes | Search and weather settings (never the password hash) |
| PUT | `/api/settings` | yes | `search_engine`, `search_engine_custom_url` |

## Project structure

```
index/
├── index.html              # Entry point
├── src/
│   ├── main.js             # App logic (clock, search, weather, apps, settings)
│   ├── safe.js             # URL and coordinate checks
│   └── style.css           # Styles
├── functions/api/
│   └── [[route]].js        # Cloudflare Pages Function (REST API)
├── lib/password.js         # PBKDF2 hashing, shared by the API and the script
├── scripts/hash-password.mjs
├── migrations/
│   └── 0001_initial.sql    # D1 schema (idempotent)
├── public/_headers         # Security headers
├── tests/                  # node --test
├── wrangler.toml           # Cloudflare config
└── vite.config.js
```

## License

BZ-1.1, see [LICENSE.md](LICENSE.md).
