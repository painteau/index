// Hachage du mot de passe admin : PBKDF2-SHA256 salé.
// Partagé par l'API (functions/), le script de pose (scripts/) et les tests.

// Plafond du runtime Cloudflare Workers pour PBKDF2.
export const PBKDF2_ITERATIONS = 100000

const enc = new TextEncoder()

export function toHex(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex) {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

export async function sha256Hex(text) {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(text)))
}

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256)
  return toHex(bits)
}

export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// Format stocké : pbkdf2$<itérations>$<sel hex>$<empreinte hex>
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toHex(salt)}$${await pbkdf2(password, salt, PBKDF2_ITERATIONS)}`
}

// Tout autre format (dont l'ancien SHA-256 sans sel, qui a été lisible
// publiquement) est refusé : il ne doit plus ouvrir de session.
export async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const iterations = Number(parts[1])
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > PBKDF2_ITERATIONS) return false
  if (!/^[0-9a-f]{32}$/.test(parts[2]) || !/^[0-9a-f]{64}$/.test(parts[3])) return false
  return timingSafeEqual(await pbkdf2(password, fromHex(parts[2]), iterations), parts[3])
}
