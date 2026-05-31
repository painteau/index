// Cloudflare Pages Function — API handler

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,X-Session-Token',
}

const MAX_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

function randomToken() {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function requireAuth(request, DB) {
  const token = request.headers.get('X-Session-Token')
  if (!token) return false
  const row = await DB.prepare(
    `SELECT token FROM sessions WHERE token=? AND expires_at > datetime('now')`
  ).bind(token).first()
  return !!row
}

function getClientIP(request) {
  return request.headers.get('CF-Connecting-IP')
    || request.headers.get('X-Forwarded-For')?.split(',')[0].trim()
    || 'unknown'
}

export async function onRequest({ request, env }) {
  const url    = new URL(request.url)
  const path   = url.pathname.replace(/^\/api/, '') || '/'
  const method = request.method

  if (method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const DB = env.DB

    // ── /auth ────────────────────────────────────────────────
    if (path === '/auth/login' && method === 'POST') {
      const ip = getClientIP(request)

      // Check rate limit
      const attempt = await DB.prepare(
        `SELECT attempts, locked_until FROM login_attempts WHERE ip=?`
      ).bind(ip).first()

      if (attempt) {
        if (attempt.locked_until) {
          const lockedUntil = new Date(attempt.locked_until + 'Z')
          if (lockedUntil > new Date()) {
            const mins = Math.ceil((lockedUntil - new Date()) / 60000)
            return json({ error: `Trop de tentatives. Réessayez dans ${mins} min.` }, 429)
          }
        }
        if (attempt.attempts >= MAX_ATTEMPTS) {
          const until = new Date(Date.now() + LOCKOUT_MINUTES * 60000).toISOString().replace('T', ' ').slice(0, 19)
          await DB.prepare(`UPDATE login_attempts SET locked_until=? WHERE ip=?`).bind(until, ip).run()
          return json({ error: `Trop de tentatives. Compte bloqué ${LOCKOUT_MINUTES} min.` }, 429)
        }
      }

      const { password } = await request.json()
      const row = await DB.prepare(`SELECT value FROM settings WHERE key='admin_password'`).first()
      const stored = row?.value ?? ''

      if (stored === '') {
        // First time: hash and store password
        if (!password || password.length < 6) return json({ error: 'Mot de passe trop court (6 min)' }, 400)
        const hash = await sha256(password)
        await DB.prepare(`INSERT OR REPLACE INTO settings (key,value) VALUES ('admin_password',?)`).bind(hash).run()
        // Reset attempts on success
        await DB.prepare(`DELETE FROM login_attempts WHERE ip=?`).bind(ip).run()
      } else {
        const hash = await sha256(password)
        if (hash !== stored) {
          // Increment attempts
          if (attempt) {
            await DB.prepare(`UPDATE login_attempts SET attempts=attempts+1 WHERE ip=?`).bind(ip).run()
          } else {
            await DB.prepare(`INSERT INTO login_attempts (ip, attempts) VALUES (?,1)`).bind(ip).run()
          }
          const left = MAX_ATTEMPTS - ((attempt?.attempts ?? 0) + 1)
          return json({ error: `Mot de passe incorrect. ${left > 0 ? `${left} tentative(s) restante(s).` : 'Compte bloqué.'}` }, 401)
        }
        // Success: reset attempts
        await DB.prepare(`DELETE FROM login_attempts WHERE ip=?`).bind(ip).run()
      }

      const token = randomToken()
      const expires = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19)
      await DB.prepare(`INSERT INTO sessions (token, expires_at) VALUES (?,?)`).bind(token, expires).run()
      return json({ token })
    }

    if (path === '/auth/logout' && method === 'POST') {
      const token = request.headers.get('X-Session-Token')
      if (token) await DB.prepare(`DELETE FROM sessions WHERE token=?`).bind(token).run()
      return json({ ok: true })
    }

    if (path === '/auth/check' && method === 'GET') {
      const ok = await requireAuth(request, DB)
      // Also return whether password is set
      const row = await DB.prepare(`SELECT value FROM settings WHERE key='admin_password'`).first()
      return json({ ok, setup: !row?.value })
    }

    // ── /apps ────────────────────────────────────────────────
    if (path === '/apps') {
      if (method === 'GET') {
        const { results } = await DB.prepare(
          'SELECT * FROM apps ORDER BY order_index, id'
        ).all()
        return json(results)
      }
      if (method === 'POST') {
        if (!await requireAuth(request, DB)) return json({ error: 'Non autorisé' }, 401)
        const b = await request.json()
        const { results } = await DB.prepare(
          'INSERT INTO apps (name, url, icon, order_index) VALUES (?,?,?,?) RETURNING *'
        ).bind(b.name, b.url, b.icon ?? '', b.order_index ?? 0).all()
        return json(results[0], 201)
      }
    }

    const appsMatch = path.match(/^\/apps\/(\d+)$/)
    if (appsMatch) {
      const id = appsMatch[1]
      if (method === 'PUT') {
        if (!await requireAuth(request, DB)) return json({ error: 'Non autorisé' }, 401)
        const b = await request.json()
        await DB.prepare(
          'UPDATE apps SET name=?,url=?,icon=?,order_index=? WHERE id=?'
        ).bind(b.name, b.url, b.icon ?? '', b.order_index ?? 0, id).run()
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
      if (method === 'GET') {
        const { results } = await DB.prepare('SELECT key, value FROM settings').all()
        const out = {}
        results.forEach(r => { out[r.key] = r.value })
        return json(out)
      }
      if (method === 'PUT') {
        if (!await requireAuth(request, DB)) return json({ error: 'Non autorisé' }, 401)
        const b = await request.json()
        const stmts = Object.entries(b)
          .filter(([k]) => k !== 'admin_password')
          .map(([k, v]) => DB.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)').bind(k, String(v)))
        if (stmts.length) await DB.batch(stmts)
        return json({ ok: true })
      }
    }

    return json({ error: 'Not found' }, 404)

  } catch (err) {
    console.error(err)
    return json({ error: err.message }, 500)
  }
}
