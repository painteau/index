// Contrôles côté navigateur, sans DOM : testables par node --test.

// Rend l'URL si elle est en http(s), sinon null. Une tuile enregistrée avant
// la validation serveur peut encore porter javascript: ou une adresse invalide.
export function safeHttpUrl(value) {
  if (typeof value !== 'string' || !value) return null
  try {
    const u = new URL(value)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null
  } catch {
    return null
  }
}

// Deux décimales, soit environ 1 km : assez pour la météo, sans donner
// l'adresse exacte à Open-Meteo et Nominatim à chaque nouvel onglet.
export function roundCoord(value) {
  return Math.round(Number(value) * 100) / 100
}

export function initials(name) {
  return [...String(name ?? '?')].slice(0, 2).join('').toUpperCase() || '?'
}
