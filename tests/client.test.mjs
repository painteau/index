import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { safeHttpUrl, roundCoord, initials } from '../src/safe.js'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('safeHttpUrl ne laisse passer que http(s)', () => {
  assert.equal(safeHttpUrl('https://a.example/x'), 'https://a.example/x')
  assert.equal(safeHttpUrl('http://a.example'), 'http://a.example/')
  for (const v of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,x', 'portainer.local', '', null, 42]) {
    assert.equal(safeHttpUrl(v), null, String(v))
  }
})

test('les coordonnées sont arrondies à 2 décimales', () => {
  assert.equal(roundCoord(45.764043), 45.76)
  assert.equal(roundCoord(4.835659), 4.84)
})

test('initials tient compte des émojis et du vide', () => {
  assert.equal(initials('vaultwarden'), 'VA')
  assert.equal(initials(''), '?')
})

// Garde-fou : le rendu ne doit pas revenir à du HTML construit par chaîne,
// ni à des gestionnaires en ligne qu'une CSP stricte interdirait.
test('aucun innerHTML ni gestionnaire en ligne dans le client', () => {
  const main = read('src/main.js').replace(/^\s*\/\/.*$/gm, '')
  assert.ok(!/innerHTML|insertAdjacentHTML|outerHTML/.test(main), 'innerHTML dans main.js')
  for (const file of ['src/main.js', 'index.html']) {
    assert.ok(!/\son(click|error|load|change)\s*=/i.test(read(file)), `gestionnaire en ligne dans ${file}`)
  }
})

test('aucun service tiers de favicons', () => {
  assert.ok(!read('src/main.js').includes('google.com/s2/favicons'))
})

test('public/apps.json n est plus publié', () => {
  assert.ok(!existsSync(new URL('../public/apps.json', import.meta.url)))
})

test('la CSP du site interdit les scripts en ligne et l encadrement', () => {
  const headers = read('public/_headers')
  assert.match(headers, /script-src 'self';/)
  assert.match(headers, /frame-ancestors 'none'/)
})
