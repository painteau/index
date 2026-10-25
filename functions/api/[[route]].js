// Cloudflare Pages Function : API de l'index.
// Même origine que la page : pas de CORS, aucune route n'est faite pour un autre site.

import { hashPassword, verifyPassword, sha256Hex, toHex } from '../../lib/password.js'

const MAX_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15
const SESSION_DAYS = 30
const MAX_BODY = 16 * 1024
const MIN_PASSWORD = 10
const MAX_PASSWORD = 256

const ENGINES = ['google', 'duckduckgo', 'brave', 'bing', 'qwant', 'custom']
// Réglages lisibles et modifiables par l'API. admin_password n'y figure jamais.
const SETTINGS_READ = ['search_engine', 'search_engine_custom_url', 'search_newtab',
  'weather_provider', 'weather_lat', 'weather_lon', 'weather_city']

const HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'X-Frame-Options': 'DENY',
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: HEADERS })

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status }
}
const bad = message => new HttpError(400, message)

// ── Validation des entrées ────────────────────────────────────

async function readJson(request) {
  const type = request.headers.get('Content-Type') || ''
  // Exiger application/json impose un preflight CORS à toute page tierce, qui
  // échoue faute de CORS : un autre site ne peut donc pas poster ici depuis le
  // navigateur du propriétaire (ni verrouiller son IP par de faux essais).
  if (!type.toLowerCase().startsWith('application/json')) throw new HttpError(415, 'JSON attendu')
  const text = await request.text()
  if (text.length > MAX_BODY) throw new HttpError(413, 'Requête trop volumineuse')
  let body
  try { body = JSON.parse(text) } catch { throw bad('JSON invalide') }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw bad('Objet JSON attendu')
  return body
}

const ZWJ = String.fromCodePoint(0x200d)
const INVISIBLE = /[\p{Cc}\p{Cf}]/u

// Retire les caractères de contrôle et de formatage (inversion bidi, largeur
// nulle...) qui feraient afficher une tuile sous un autre nom. Le ZWJ reste,
// il compose les émojis.
function cleanText(value) {
  return [...value].filter(ch => ch === ZWJ || !INVISIBLE.test(ch)).join('').trim()
}

function text(value, field, max, required = true) {
  if (value === undefined || value === null || value === '') {
    if (required) throw bad(`${field} requis`)
    return ''
  }
  if (typeof value !== 'string') throw bad(`${field} doit être une chaîne`)
  const s = cleanText(value)
  if (required && !s) throw bad(`${field} requis`)
  if (s.length > max) throw bad(`${field} trop long (${max} caractères max)`)
  return s
}

function httpUrl(value, field, required = true) {
  const s = text(value, field, 2048, required)
  if (!s) return ''
  let u
  try { u = new URL(s) } catch { throw bad(`${field} invalide`) }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw bad(`${field} : http ou https uniquement`)
  return s
}

function integer(value, field, nullable = false) {
  if (value === undefined || value === null || value === '') return nullable ? null : 0
  if (!Number.isInteger(value)) throw bad(`${field} doit être un entier`)
  return value
}

async function categoryId(value, DB) {
  const id = integer(value, 'category_id', true)
  if (id === null) return null
  const row = await DB.prepare('SELECT id FROM categories WHERE id=?').bind(id).first()
  if (!row) throw bad('Catégorie inconnue')
  return id
}

// ── Sessions ──────────────────────────────────────────────────

function randomToken() {
  return toHex(crypto.getRandomValues(new Uint8Array(32)))
}

// Seule l'empreinte du jeton est en base : une lecture de D1 ne donne pas de session.
async function createSession(DB) {
  const token = randomToken()
  await DB.prepare(`INSERT INTO sessions (token, expires_at) VALUES (?, datetime('now', '+${SESSION_DAYS} days'))`)
    .bind(await sha256Hex(token)).run()
  return token
}

async function requireAuth(request, DB) {
  const token = request.headers.get('X-Session-Token')
  if (!token || token.length > 128) return false
  const row = await DB.prepare(
    `SELECT token FROM sessions WHERE token=? AND expires_at > datetime('now')`
  ).bind(await sha256Hex(token)).first()
  return !!row
}

// Une adresse IPv6 compte par préfixe /64 : sinon un seul abonné change
// d'adresse à volonté et la limite ne borne rien.
function clientKey(request) {
  const ip = request.headers.get('CF-Connecting-IP') || 'inconnue'
  if (!ip.includes(':')) return ip
  const [head, tail = ''] = ip.split('::')
  const h = head ? head.split(':') : []
  const t = tail ? tail.split(':') : []
  const groups = ip.includes('::') ? [...h, ...Array(8 - h.length - t.length).fill('0'), ...t] : h
  return groups.slice(0, 4).map(g => g.toLowerCase().replace(/^0+(?=.)/, '')).join(':') + '::/64'
}

async function storedPassword(DB) {
  const row = await DB.prepare(`SELECT value FROM settings WHERE key='admin_password'`).first()
  return row?.value || ''
}

// ── Routes ────────────────────────────────────────────────────

async function login(request, DB) {
  const body = await readJson(request)
  if (typeof body.password !== 'string' || !body.password || body.password.length > MAX_PASSWORD) {
    throw bad('Mot de passe attendu')
  }
  const stored = await storedPassword(DB)
  // Aucun « premier accès » par l'API : le mot de passe se pose avec
  // scripts/hash-password.mjs, sinon une base vidée appartiendrait au premier venu.
  if (!stored) return json({ error: 'Index non initialisé' }, 503)

  const ip = clientKey(request)
  const lock = await DB.prepare(
    `SELECT locked_until IS NOT NULL AS has_lock, locked_until > datetime('now') AS locked FROM login_attempts WHERE ip=?`
  ).bind(ip).first()
  if (lock?.locked) return json({ error: `Trop de tentatives. Réessayez dans ${LOCKOUT_MINUTES} min au plus.` }, 429)
  // Verrou expiré : on repart de zéro, sinon il se reposerait au premier essai.
  if (lock?.has_lock) await DB.prepare('DELETE FROM login_attempts WHERE ip=?').bind(ip).run()

  // Le compteur monte AVANT la vérification : des requêtes parallèles ne
  // peuvent pas toutes lire « 0 essai » et tester chacune un mot de passe.
  const { attempts } = await DB.prepare(
    `INSERT INTO login_attempts (ip, attempts) VALUES (?, 1)
     ON CONFLICT(ip) DO UPDATE SET attempts = attempts + 1 RETURNING attempts`
  ).bind(ip).first()
  if (attempts > MAX_ATTEMPTS) {
    await DB.prepare(`UPDATE login_attempts SET locked_until=datetime('now', '+${LOCKOUT_MINUTES} minutes') WHERE ip=?`).bind(ip).run()
    return json({ error: `Trop de tentatives. Réessayez dans ${LOCKOUT_MINUTES} min.` }, 429)
  }

  if (!await verifyPassword(body.password, stored)) {
    if (attempts >= MAX_ATTEMPTS) {
      await DB.prepare(`UPDATE login_attempts SET locked_until=datetime('now', '+${LOCKOUT_MINUTES} minutes') WHERE ip=?`).bind(ip).run()
    }
    const left = MAX_ATTEMPTS - attempts
    return json({ error: `Mot de passe incorrect. ${left > 0 ? `${left} tentative(s) restante(s).` : 'Accès bloqué.'}` }, 401)
  }

  await DB.prepare('DELETE FROM login_attempts WHERE ip=?').bind(ip).run()
  await DB.prepare(`DELETE FROM sessions WHERE expires_at <= datetime('now')`).run()
  return json({ token: await createSession(DB) })
}

async function changePassword(request, DB) {
  if (!await requireAuth(request, DB)) return json({ error: 'Non autorisé' }, 401)
  const body = await readJson(request)
  if (typeof body.current !== 'string' || typeof body.next !== 'string') throw bad('Mots de passe attendus')
  if (body.next.length < MIN_PASSWORD || body.next.length > MAX_PASSWORD) {
    throw bad(`Nouveau mot de passe : ${MIN_PASSWORD} à ${MAX_PASSWORD} caractères`)
  }
  if (!await verifyPassword(body.current, await storedPassword(DB))) {
    return json({ error: 'Mot de passe actuel incorrect' }, 403)
  }
  await DB.batch([
    DB.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('admin_password', ?)`).bind(await hashPassword(body.next)),
    // Toutes les sessions tombent, y compris celle d'un éventuel intrus.
    DB.prepare('DELETE FROM sessions'),
  ])
  return json({ token: await createSession(DB) })
}

async function appFields(body, DB) {
  return [
    text(body.name, 'name', 64),
    httpUrl(body.url, 'url'),
    httpUrl(body.icon, 'icon', false),
    integer(body.order_index, 'order_index'),
    body.public === true ? 1 : 0,
    await categoryId(body.category_id, DB),
  ]
}

function settingValue(key, value) {
  if (key === 'search_engine') {
    if (!ENGINES.includes(value)) throw bad('search_engine inconnu')
    return value
  }
  if (key === 'search_engine_custom_url') return httpUrl(value, key)
  throw bad(`Réglage non modifiable : ${key}`)
}

export async function onRequest({ request, env }) {
  const url    = new URL(request.url)
  const path   = url.pathname.replace(/^\/api/, '') || '/'
  const method = request.method
  const DB     = env.DB

  try {
    if (path === '/auth/login' && method === 'POST') return await login(request, DB)
    if (path === '/auth/password' && method === 'POST') return await changePassword(request, DB)

    if (path === '/auth/logout' && method === 'POST') {
      const token = request.headers.get('X-Session-Token')
      if (token && token.length <= 128) {
        await DB.prepare('DELETE FROM sessions WHERE token=?').bind(await sha256Hex(token)).run()
      }
      return json({ ok: true })
    }

    if (path === '/auth/check' && method === 'GET') {
      return json({ ok: await requireAuth(request, DB) })
    }

    // ── /categories ──────────────────────────────────────────
    if (path === '/categories') {
      if (method === 'GET') {
        const authed = await requireAuth(request, DB)
        // Sans session, seules les catégories qui contiennent une tuile publique.
        const { results } = authed
          ? await DB.prepare('SELECT * FROM categories ORDER BY order_index, id').all()
          : await DB.prepare(
              'SELECT * FROM categories WHERE id IN (SELECT category_id FROM apps WHERE public=1) ORDER BY order_index, id'
            ).all()
        return json(results)
      }
      if (method === 'POST') {
        if (!await requireAuth(request, DB)) return json({ error: 'Non autorisé' }, 401)
        const b = await readJson(request)
        const { results } = await DB.prepare(
          'INSERT INTO categories (name, order_index) VALUES (?,?) RETURNING *'
        ).bind(text(b.name, 'name', 40), integer(b.order_index, 'order_index')).all()
        return json(results[0], 201)
      }
    }

    const catMatch = path.match(/^\/categories\/(\d+)$/)
    if (catMatch) {
      const id = Number(catMatch[1])
      if (method === 'PUT') {
        if (!await requireAuth(request, DB)) return json({ error: 'Non autorisé' }, 401)
        const b = await readJson(request)
        await DB.prepare(
          'UPDATE categories SET name=?,order_index=? WHERE id=?'
        ).bind(text(b.name, 'name', 40), integer(b.order_index, 'order_index'), id).run()
        return json({ ok: true })
      }
      if (method === 'DELETE') {
        if (!await requireAuth(request, DB)) return json({ error: 'Non autorisé' }, 401)
        await DB.prepare('UPDATE apps SET category_id=NULL WHERE category_id=?').bind(id).run()
        await DB.prepare('DELETE FROM categories WHERE id=?').bind(id).run()
        return json({ ok: true })
      }
    }

    // ── /apps ────────────────────────────────────────────────
    if (path === '/apps') {
      if (method === 'GET') {
        const authed = await requireAuth(request, DB)
        const { results } = authed
          ? await DB.prepare('SELECT * FROM apps ORDER BY order_index, id').all()
          : await DB.prepare('SELECT * FROM apps WHERE public=1 ORDER BY order_index, id').all()
        return json(results)
      }
      if (method === 'POST') {
        if (!await requireAuth(request, DB)) return json({ error: 'Non autorisé' }, 401)
        const fields = await appFields(await readJson(request), DB)
        const { results } = await DB.prepare(
          'INSERT INTO apps (name, url, icon, order_index, public, category_id) VALUES (?,?,?,?,?,?) RETURNING *'
        ).bind(...fields).all()
        return json(results[0], 201)
      }
    }

    const appsMatch = path.match(/^\/apps\/(\d+)$/)
    if (appsMatch) {
      const id = Number(appsMatch[1])
      if (method === 'PUT') {
        if (!await requireAuth(request, DB)) return json({ error: 'Non autorisé' }, 401)
        const fields = await appFields(await readJson(request), DB)
        await DB.prepare(
          'UPDATE apps SET name=?,url=?,icon=?,order_index=?,public=?,category_id=? WHERE id=?'
        ).bind(...fields, id).run()
        return json({ ok: true })
      }
      if (method === 'DELETE') {
        if (!await requireAuth(request, DB)) return json({ error: 'Non autorisé' }, 401)
        await DB.prepare('DELETE FROM apps WHERE id=?').bind(id).run()
        return json({ ok: true })
      }
    }

    // ── /settings ────────────────────────────────────────────
    if (path === '/settings') {
      if (!await requireAuth(request, DB)) return json({ error: 'Non autorisé' }, 401)
      if (method === 'GET') {
        const { results } = await DB.prepare(
          `SELECT key, value FROM settings WHERE key IN (${SETTINGS_READ.map(() => '?').join(',')})`
        ).bind(...SETTINGS_READ).all()
        const out = {}
        results.forEach(r => { out[r.key] = r.value })
        return json(out)
      }
      if (method === 'PUT') {
        const b = await readJson(request)
        const stmts = Object.entries(b).map(([k, v]) =>
          DB.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)').bind(k, settingValue(k, v)))
        if (stmts.length) await DB.batch(stmts)
        return json({ ok: true })
      }
    }

    return json({ error: 'Not found' }, 404)

  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status)
    console.error(err)
    return json({ error: 'Erreur interne' }, 500)
  }
}
