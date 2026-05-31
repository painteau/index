// Cloudflare Pages Function — API handler
// Handles: /api/apps, /api/categories, /api/bookmarks, /api/settings

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

export async function onRequest({ request, env }) {
  const url    = new URL(request.url)
  const path   = url.pathname.replace(/^\/api/, '') || '/'
  const method = request.method

  if (method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const DB = env.DB

    // ── /apps ────────────────────────────────────────────────
    if (path === '/apps') {
      if (method === 'GET') {
        const { results } = await DB.prepare(
          'SELECT * FROM apps ORDER BY order_index, id'
        ).all()
        return json(results)
      }
      if (method === 'POST') {
        const b = await request.json()
        const { results } = await DB.prepare(
          'INSERT INTO apps (name, url, icon, category_id, order_index) VALUES (?,?,?,?,?) RETURNING *'
        ).bind(b.name, b.url, b.icon ?? '', b.category_id ?? null, b.order_index ?? 0).all()
        return json(results[0], 201)
      }
    }

    const appsMatch = path.match(/^\/apps\/(\d+)$/)
    if (appsMatch) {
      const id = appsMatch[1]
      if (method === 'PUT') {
        const b = await request.json()
        await DB.prepare(
          'UPDATE apps SET name=?,url=?,icon=?,category_id=?,order_index=? WHERE id=?'
        ).bind(b.name, b.url, b.icon, b.category_id, b.order_index, id).run()
        return json({ ok: true })
      }
      if (method === 'DELETE') {
        await DB.prepare('DELETE FROM apps WHERE id=?').bind(id).run()
        return json({ ok: true })
      }
    }

    // ── /categories ──────────────────────────────────────────
    if (path === '/categories') {
      if (method === 'GET') {
        const { results } = await DB.prepare(
          'SELECT * FROM categories ORDER BY order_index, id'
        ).all()
        return json(results)
      }
      if (method === 'POST') {
        const b = await request.json()
        const { results } = await DB.prepare(
          'INSERT INTO categories (name, order_index) VALUES (?,?) RETURNING *'
        ).bind(b.name, b.order_index ?? 0).all()
        return json(results[0], 201)
      }
    }

    const catsMatch = path.match(/^\/categories\/(\d+)$/)
    if (catsMatch) {
      const id = catsMatch[1]
      if (method === 'PUT') {
        const b = await request.json()
        await DB.prepare('UPDATE categories SET name=?,order_index=? WHERE id=?')
          .bind(b.name, b.order_index, id).run()
        return json({ ok: true })
      }
      if (method === 'DELETE') {
        await DB.prepare('DELETE FROM categories WHERE id=?').bind(id).run()
        return json({ ok: true })
      }
    }

    // ── /bookmarks ───────────────────────────────────────────
    if (path === '/bookmarks') {
      if (method === 'GET') {
        const { results } = await DB.prepare(`
          SELECT b.*, c.name AS category_name
          FROM bookmarks b
          LEFT JOIN categories c ON b.category_id = c.id
          ORDER BY b.category_id, b.order_index, b.id
        `).all()
        return json(results)
      }
      if (method === 'POST') {
        const b = await request.json()
        const { results } = await DB.prepare(
          'INSERT INTO bookmarks (name, url, icon, category_id, order_index) VALUES (?,?,?,?,?) RETURNING *'
        ).bind(b.name, b.url, b.icon ?? '', b.category_id ?? null, b.order_index ?? 0).all()
        return json(results[0], 201)
      }
    }

    const bkMatch = path.match(/^\/bookmarks\/(\d+)$/)
    if (bkMatch) {
      const id = bkMatch[1]
      if (method === 'PUT') {
        const b = await request.json()
        await DB.prepare(
          'UPDATE bookmarks SET name=?,url=?,icon=?,category_id=?,order_index=? WHERE id=?'
        ).bind(b.name, b.url, b.icon, b.category_id, b.order_index, id).run()
        return json({ ok: true })
      }
      if (method === 'DELETE') {
        await DB.prepare('DELETE FROM bookmarks WHERE id=?').bind(id).run()
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
        const b = await request.json()
        const stmts = Object.entries(b).map(([k, v]) =>
          DB.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)').bind(k, String(v))
        )
        await DB.batch(stmts)
        return json({ ok: true })
      }
    }

    return json({ error: 'Not found' }, 404)

  } catch (err) {
    console.error(err)
    return json({ error: err.message }, 500)
  }
}
