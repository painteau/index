// Cloudflare Pages Function — API handler

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,X-Session-Token',
}

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

async function requireAuth(request, DB) {
  const token = request.headers.get('X-Session-Token')
  if (!token) return false
  const row = await DB.prepare(
    `SELECT token FROM sessions WHERE token=? AND expires_at > datetime('now')`
  ).bind(token).first()
  return !!row
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
      const { password } = await request.json()
      const row = await DB.prepare(`SELECT value FROM settings WHERE key='admin_password'`).first()
      const stored = row?.value ?? ''

      if (stored === '') {
        // First time: set the password
        if (!password || password.length < 4) return json({ error: 'Mot de passe trop court (4 min)' }, 400)
        await DB.prepare(`INSERT OR REPLACE INTO settings (key,value) VALUES ('admin_password',?)`).bind(password).run()
      } else if (password !== stored) {
        return json({ error: 'Mot de passe incorrect' }, 401)
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
