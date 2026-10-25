-- Schéma complet, rejouable sans effet sur une base existante.
-- admin_password n'est jamais posé ici : voir scripts/hash-password.mjs.

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  order_index INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS apps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  icon TEXT DEFAULT '',
  category_id INTEGER REFERENCES categories(id),
  order_index INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  public INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  icon TEXT DEFAULT '',
  category_id INTEGER REFERENCES categories(id),
  order_index INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- token = empreinte SHA-256 du jeton remis au navigateur, jamais le jeton lui-même.
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  expires_at DATETIME NOT NULL
);

-- ip = adresse IPv4, ou préfixe /64 en IPv6.
CREATE TABLE IF NOT EXISTS login_attempts (
  ip TEXT PRIMARY KEY,
  attempts INTEGER DEFAULT 0,
  locked_until DATETIME
);

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('search_engine', 'google'),
  ('weather_provider', 'openmeteo'),
  ('weather_lat', '48.8566'),
  ('weather_lon', '2.3522'),
  ('weather_city', 'Paris'),
  ('search_newtab', 'false');
