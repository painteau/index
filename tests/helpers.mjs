// D1 simulé par node:sqlite, avec le schéma réel de migrations/0001_initial.sql.
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

export function fakeD1() {
  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(readFileSync(root + 'migrations/0001_initial.sql', 'utf8'))
  const statement = (sql, params = []) => ({
    bind: (...p) => statement(sql, p),
    first: async () => db.prepare(sql).get(...params) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...params) }),
    run: async () => { db.prepare(sql).run(...params); return { success: true } },
  })
  return {
    prepare: sql => statement(sql),
    batch: async stmts => { for (const s of stmts) await s.run() },
    raw: db,
  }
}

// INDEX_API permet de rejouer les tests sur une autre version de l'API
// (pour prouver qu'ils échouent sur le code d'avant correctif).
export async function loadApi() {
  const path = process.env.INDEX_API || root + 'functions/api/[[route]].js'
  return import(pathToFileURL(path).href)
}

export function makeCall(api, DB) {
  return async (method, path, { body, token, raw, type = 'application/json', ip = '203.0.113.7' } = {}) => {
    const headers = { 'CF-Connecting-IP': ip }
    if (token) headers['X-Session-Token'] = token
    if (body !== undefined || raw !== undefined) headers['Content-Type'] = type
    const request = new Request('https://index.test/api' + path, {
      method,
      headers,
      body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined,
    })
    const res = await api.onRequest({ request, env: { DB } })
    const text = await res.text()
    let data
    try { data = JSON.parse(text) } catch { data = text }
    return { status: res.status, headers: res.headers, data }
  }
}
