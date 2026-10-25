import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { fakeD1, loadApi, makeCall } from './helpers.mjs'
import { hashPassword, sha256Hex } from '../lib/password.js'

const PASSWORD = 'cheval-correct-batterie'
const api = await loadApi()
let DB, call

async function login(password = PASSWORD, ip) {
  return call('POST', '/auth/login', { body: { password }, ip })
}

async function token() {
  const r = await login()
  assert.equal(r.status, 200, JSON.stringify(r.data))
  return r.data.token
}

function setting(key) {
  return DB.raw.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value
}

beforeEach(async () => {
  DB = fakeD1()
  call = makeCall(api, DB)
  DB.raw.prepare(`INSERT INTO settings (key, value) VALUES ('admin_password', ?)`).run(await hashPassword(PASSWORD))
})

// ── Fuite de l'empreinte du mot de passe ──────────────────────

test('GET /settings refuse un anonyme', async () => {
  const r = await call('GET', '/settings')
  assert.equal(r.status, 401)
  assert.ok(!JSON.stringify(r.data).includes('pbkdf2'))
})

test('GET /settings connecté ne rend jamais admin_password', async () => {
  const r = await call('GET', '/settings', { token: await token() })
  assert.equal(r.status, 200)
  assert.equal(r.data.admin_password, undefined)
  assert.equal(r.data.search_engine, 'google')
})

test('PUT /settings refuse admin_password et les clés inconnues', async () => {
  const t = await token()
  for (const key of ['admin_password', 'admin_password ', 'Admin_Password', 'nimporte']) {
    const r = await call('PUT', '/settings', { token: t, body: { [key]: 'x' } })
    assert.equal(r.status, 400, key)
  }
  assert.ok(setting('admin_password').startsWith('pbkdf2$'))
})

test('le moteur personnalisé n accepte que http(s)', async () => {
  const t = await token()
  const bad = await call('PUT', '/settings', { token: t, body: { search_engine_custom_url: 'javascript:alert(1)//' } })
  assert.equal(bad.status, 400)
  const ok = await call('PUT', '/settings', { token: t, body: { search_engine_custom_url: 'https://moteur.example/?q=' } })
  assert.equal(ok.status, 200)
})

// ── Mot de passe ──────────────────────────────────────────────

test('l ancienne empreinte SHA-256 sans sel n ouvre plus de session', async () => {
  DB.raw.prepare(`UPDATE settings SET value=? WHERE key='admin_password'`).run(await sha256Hex(PASSWORD))
  const r = await login()
  assert.equal(r.status, 401)
})

test('sans mot de passe en base, aucun premier accès par l API', async () => {
  DB.raw.prepare(`DELETE FROM settings WHERE key='admin_password'`).run()
  const r = await login('premier-venu-123')
  assert.equal(r.status, 503)
  assert.equal(setting('admin_password'), undefined)
  const check = await call('GET', '/auth/check')
  assert.equal(check.data.setup, undefined)
})

test('le jeton de session n est stocké que sous forme d empreinte', async () => {
  const t = await token()
  const rows = DB.raw.prepare('SELECT token FROM sessions').all().map(r => r.token)
  assert.ok(!rows.includes(t))
  assert.ok(rows.includes(await sha256Hex(t)))
})

test('changer le mot de passe révoque toutes les sessions', async () => {
  const autre = await token()
  const t = await token()
  const r = await call('POST', '/auth/password', { token: t, body: { current: PASSWORD, next: 'un-nouveau-mot-de-passe' } })
  assert.equal(r.status, 200)
  assert.equal((await call('GET', '/settings', { token: autre })).status, 401)
  assert.equal((await call('GET', '/settings', { token: t })).status, 401)
  assert.equal((await call('GET', '/settings', { token: r.data.token })).status, 200)
  assert.equal((await login()).status, 401)
  assert.equal((await login('un-nouveau-mot-de-passe')).status, 200)
})

test('changer le mot de passe exige l actuel et 10 caractères', async () => {
  const t = await token()
  assert.equal((await call('POST', '/auth/password', { token: t, body: { current: 'faux', next: 'un-nouveau-mot-de-passe' } })).status, 403)
  assert.equal((await call('POST', '/auth/password', { token: t, body: { current: PASSWORD, next: 'court' } })).status, 400)
  assert.equal((await call('POST', '/auth/password', { body: { current: PASSWORD, next: 'un-nouveau-mot-de-passe' } })).status, 401)
})

// ── Anti-force-brute ──────────────────────────────────────────

function attempts(ip = '203.0.113.7') {
  return DB.raw.prepare('SELECT attempts FROM login_attempts WHERE ip=?').get(ip)?.attempts ?? 0
}

test('une requête mal formée ne fait pas avancer le compteur', async () => {
  assert.equal((await call('POST', '/auth/login', { raw: 'pas du json' })).status, 400)
  assert.equal((await call('POST', '/auth/login', { body: { password: 123 } })).status, 400)
  assert.equal((await call('POST', '/auth/login', { raw: '[]' })).status, 400)
  assert.equal((await call('POST', '/auth/login', { raw: '{"password":"x"}', type: 'text/plain' })).status, 415)
  assert.equal(attempts(), 0)
})

test('5 échecs verrouillent, le bon mot de passe ne passe plus', async () => {
  for (let i = 0; i < 5; i++) assert.equal((await login('mauvais')).status, 401)
  assert.equal((await login()).status, 429)
})

test('le verrou expiré repart de zéro au lieu de se reposer', async () => {
  for (let i = 0; i < 5; i++) await login('mauvais')
  DB.raw.prepare(`UPDATE login_attempts SET locked_until=datetime('now', '-1 minute')`).run()
  assert.equal((await login()).status, 200)
})

test('les adresses d un même /64 IPv6 partagent leur compteur', async () => {
  for (let i = 0; i < 5; i++) await login('mauvais', `2001:db8:1:2::${i + 1}`)
  assert.equal((await login(PASSWORD, '2001:db8:1:2:ffff::9')).status, 429)
  assert.equal((await login(PASSWORD, '2001:db8:1:3::1')).status, 200)
})

// ── Entrées ───────────────────────────────────────────────────

test('une tuile javascript: est refusée', async () => {
  const t = await token()
  for (const url of ['javascript:alert(1)', 'data:text/html,x', 'pas-une-url']) {
    const r = await call('POST', '/apps', { token: t, body: { name: 'X', url } })
    assert.equal(r.status, 400, url)
  }
  const icon = await call('POST', '/apps', { token: t, body: { name: 'X', url: 'https://ok.example', icon: 'javascript:1' } })
  assert.equal(icon.status, 400)
})

test('les types inattendus donnent 400, pas 500', async () => {
  const t = await token()
  const cas = [
    { name: 7, url: 'https://ok.example' },
    { name: 'X', url: ['https://ok.example'] },
    { name: 'X', url: 'https://ok.example', order_index: '<img>' },
    { name: 'X', url: 'https://ok.example', category_id: 999 },
    { name: 'x'.repeat(65), url: 'https://ok.example' },
  ]
  for (const body of cas) {
    const r = await call('POST', '/apps', { token: t, body })
    assert.equal(r.status, 400, JSON.stringify(body))
  }
  assert.equal((await call('POST', '/categories', { token: t, body: { name: null } })).status, 400)
  assert.equal((await call('PUT', '/settings', { token: t, raw: '["a"]' })).status, 400)
})

test('les caractères invisibles et bidi sont retirés des noms', async () => {
  const t = await token()
  const rlo = String.fromCodePoint(0x202e)
  const zwsp = String.fromCodePoint(0x200b)
  const r = await call('POST', '/apps', { token: t, body: { name: `Vault${rlo}den${zwsp}`, url: 'https://ok.example' } })
  assert.equal(r.status, 201)
  assert.equal(r.data.name, 'Vaultden')
})

test('une erreur interne ne renvoie pas son message', async () => {
  const broken = { prepare() { throw new Error('SQLITE_SECRET_DETAIL: table settings') } }
  const r = await makeCall(api, broken)('GET', '/apps')
  assert.equal(r.status, 500)
  assert.ok(!JSON.stringify(r.data).includes('SQLITE_SECRET_DETAIL'))
})

// ── Lecture anonyme et en-têtes ───────────────────────────────

test('un anonyme ne voit que les tuiles publiques et leurs catégories', async () => {
  DB.raw.exec(`INSERT INTO categories (id, name) VALUES (1, 'Publique'), (2, 'Admin');
    INSERT INTO apps (name, url, public, category_id) VALUES ('A', 'https://a.example', 1, 1), ('B', 'https://b.example', 0, 2);`)
  const apps = await call('GET', '/apps')
  assert.deepEqual(apps.data.map(a => a.name), ['A'])
  const cats = await call('GET', '/categories')
  assert.deepEqual(cats.data.map(c => c.name), ['Publique'])
})

test('pas de CORS et des en-têtes de sécurité sur l API', async () => {
  const r = await call('GET', '/apps')
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), null)
  assert.equal(r.headers.get('X-Content-Type-Options'), 'nosniff')
  assert.match(r.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/)
  const options = await call('OPTIONS', '/settings')
  assert.equal(options.headers.get('Access-Control-Allow-Origin'), null)
})
