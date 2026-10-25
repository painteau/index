// ============================================================
//  Index — main.js
// ============================================================

import { safeHttpUrl, roundCoord, initials } from './safe.js'

// ── Theme ────────────────────────────────────────────────────
const savedTheme = localStorage.getItem('theme') || 'dark'
document.documentElement.dataset.theme = savedTheme

const elThemeToggle = document.getElementById('themeToggle')

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme
  localStorage.setItem('theme', theme)
  elThemeToggle.textContent = theme === 'dark' ? '🌙' : '☀️'
}

applyTheme(savedTheme)

elThemeToggle.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark')
})


// ── Clock ───────────────────────────────────────────────────
const DAYS_FR   = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
const MONTHS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre']

const elClock = document.getElementById('clock')
const elSecs  = document.getElementById('clockSeconds')
const elDate  = document.getElementById('date')

function updateClock() {
  const now = new Date()
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  const s = String(now.getSeconds()).padStart(2, '0')
  elClock.textContent = `${h}:${m}`
  elSecs.textContent  = s
  elDate.textContent  = `${DAYS_FR[now.getDay()]} ${now.getDate()} ${MONTHS_FR[now.getMonth()]} ${now.getFullYear()}`
}

updateClock()
setInterval(updateClock, 1000)


// ── Search engines ───────────────────────────────────────────
const ENGINES = {
  google:     { name: 'Google',       icon: 'G',  url: 'https://www.google.com/search?q=' },
  duckduckgo: { name: 'DuckDuckGo',   icon: 'D',  url: 'https://duckduckgo.com/?q=' },
  brave:      { name: 'Brave',        icon: 'B',  url: 'https://search.brave.com/search?q=' },
  bing:       { name: 'Bing',         icon: 'Bi', url: 'https://www.bing.com/search?q=' },
  qwant:      { name: 'Qwant',        icon: 'Q',  url: 'https://www.qwant.com/?q=' },
  custom:     { name: 'Personnalisé', icon: '✦',  url: '' },
}

let currentEngine = localStorage.getItem('searchEngine') || 'google'

const elEngineBtn      = document.getElementById('engineBtn')
const elEngineIcon     = document.getElementById('engineIcon')
const elEngineDropdown = document.getElementById('engineDropdown')
const elSearchInput    = document.getElementById('searchInput')
const elSearchSubmit   = document.getElementById('searchSubmit')
const elOverlay        = document.getElementById('overlay')

function applyEngine(key, saveToServer = false) {
  if (!ENGINES[key]) key = 'google'
  currentEngine = key
  localStorage.setItem('searchEngine', key)
  elEngineIcon.textContent = ENGINES[key]?.icon ?? key
  document.querySelectorAll('.engine-opt').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.engine === key)
  })
  const sel = document.getElementById('settingsEngineSelect')
  if (sel) sel.value = key
  if (saveToServer && sessionToken) saveEngineToServer(key)
}

async function saveEngineToServer(key) {
  const body = { search_engine: key }
  if (key === 'custom') body.search_engine_custom_url = ENGINES.custom.url
  await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body)
  })
}

async function loadServerSettings() {
  if (!sessionToken) return
  try {
    const r = await fetch('/api/settings', { headers: authHeaders() })
    if (!r.ok) return
    const s = await r.json()
    const custom = safeHttpUrl(s.search_engine_custom_url)
    if (custom) ENGINES.custom.url = custom
    if (s.search_engine) applyEngine(s.search_engine)
  } catch {}
}

function openDropdown() {
  elEngineDropdown.removeAttribute('aria-hidden')
  elOverlay.setAttribute('aria-hidden', 'false')
  elOverlay.style.display = 'block'
}

function closeDropdown() {
  elEngineDropdown.setAttribute('aria-hidden', 'true')
  elOverlay.setAttribute('aria-hidden', 'true')
  elOverlay.style.display = 'none'
}

applyEngine(currentEngine)

elEngineBtn.addEventListener('click', (e) => {
  e.stopPropagation()
  const isOpen = elEngineDropdown.getAttribute('aria-hidden') !== 'true'
  isOpen ? closeDropdown() : openDropdown()
})

elOverlay.addEventListener('click', closeDropdown)

document.querySelectorAll('.engine-opt').forEach(btn => {
  btn.addEventListener('click', () => {
    applyEngine(btn.dataset.engine, true)
    closeDropdown()
    elSearchInput.focus()
  })
})


// ── Search action ────────────────────────────────────────────
const URL_RE = /^(https?:\/\/|[\w-]+\.[\w-]{2,})/i

function doSearch() {
  const q = elSearchInput.value.trim()
  if (!q) return
  const target = localStorage.getItem('searchNewTab') === 'true' ? '_blank' : '_self'
  if (URL_RE.test(q)) {
    const href = /^https?:\/\//i.test(q) ? q : `https://${q}`
    window.open(href, target)
  } else {
    const base = safeHttpUrl(ENGINES[currentEngine].url) ? ENGINES[currentEngine].url : ENGINES.google.url
    window.open(base + encodeURIComponent(q), target)
  }
  elSearchInput.value = ''
}

elSearchSubmit.addEventListener('click', doSearch)
elSearchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch() })

document.addEventListener('keydown', e => {
  if (
    e.target !== elSearchInput &&
    e.target.tagName !== 'INPUT' &&
    e.target.tagName !== 'TEXTAREA' &&
    !e.ctrlKey && !e.metaKey && !e.altKey &&
    e.key.length === 1
  ) {
    elSearchInput.focus()
  }
})

requestAnimationFrame(() => elSearchInput.focus())


// ── Weather ──────────────────────────────────────────────────
const WMO_ICON = {
  0:'☀️', 1:'🌤', 2:'⛅', 3:'☁️',
  45:'🌫', 48:'🌫',
  51:'🌦', 53:'🌦', 55:'🌧',
  61:'🌧', 63:'🌧', 65:'🌧',
  71:'❄️', 73:'❄️', 75:'❄️', 77:'❄️',
  80:'🌦', 81:'🌧', 82:'⛈',
  85:'❄️', 86:'❄️',
  95:'⛈', 96:'⛈', 99:'⛈',
}

const elWeatherSkeleton = document.getElementById('weatherSkeleton')
const elWeatherCard     = document.getElementById('weatherCard')
const elWeatherError    = document.getElementById('weatherError')
const elWeatherIcon     = document.getElementById('weatherIcon')

async function getCoords() {
  const saved = localStorage.getItem('weatherCoords')
  if (saved) {
    // Les coordonnées enregistrées avant l'arrondi étaient au mètre près.
    const { lat, lon } = JSON.parse(saved)
    const coords = { lat: roundCoord(lat), lon: roundCoord(lon) }
    localStorage.setItem('weatherCoords', JSON.stringify(coords))
    return coords
  }
  return new Promise(resolve => {
    if (!navigator.geolocation) { resolve({ lat: 48.86, lon: 2.35 }); return }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const coords = { lat: roundCoord(pos.coords.latitude), lon: roundCoord(pos.coords.longitude) }
        localStorage.setItem('weatherCoords', JSON.stringify(coords))
        resolve(coords)
      },
      () => resolve({ lat: 48.86, lon: 2.35 }),
      { timeout: 5000 }
    )
  })
}

async function getCityName(lat, lon) {
  const cached = localStorage.getItem('weatherCity')
  if (cached) return cached
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { headers: { 'Accept-Language': 'fr' } }
    )
    const d = await r.json()
    const city = d.address?.city || d.address?.town || d.address?.village || d.address?.county || 'Localisation'
    localStorage.setItem('weatherCity', city)
    return city
  } catch { return 'Localisation' }
}

async function loadWeather() {
  try {
    const { lat, lon } = await getCoords()
    const [weatherRes, city] = await Promise.all([
      fetch(
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,apparent_temperature,weather_code,precipitation` +
        `&hourly=precipitation` +
        `&daily=precipitation_sum` +
        `&timezone=auto&forecast_days=2`
      ),
      getCityName(lat, lon)
    ])
    const data = await weatherRes.json()
    const cur  = data.current
    const temp      = Math.round(cur.temperature_2m)
    const code      = cur.weather_code
    const rainToday = (data.daily.precipitation_sum[0] || 0).toFixed(1)
    const now         = new Date(cur.time)
    const currentHour = now.getHours()
    const allTimes    = data.hourly.time
    const allPrecip   = data.hourly.precipitation
    const startIdx = allTimes.findIndex(t => {
      const d = new Date(t)
      return d.getHours() === currentHour && d.getDate() === now.getDate()
    })
    const next12 = startIdx >= 0 ? allPrecip.slice(startIdx, startIdx + 12) : allPrecip.slice(0, 12)
    const rainNextHour = (next12[1] ?? next12[0] ?? 0).toFixed(1)

    if (elWeatherIcon) elWeatherIcon.textContent = WMO_ICON[code] ?? '🌡'
    document.getElementById('weatherTemp').textContent = `${temp}°`
    document.getElementById('weatherCity').textContent = city
    document.getElementById('rainToday').textContent   = `${rainToday}mm`
    const elRainHour = document.getElementById('rainHour')
    elRainHour.textContent = `${rainNextHour}mm`
    elRainHour.dataset.raining = parseFloat(rainNextHour) > 0 ? 'true' : 'false'
    elWeatherSkeleton.style.display = 'none'
    elWeatherCard.removeAttribute('hidden')
  } catch (err) {
    console.error('[weather]', err)
    elWeatherSkeleton.style.display = 'none'
    elWeatherError.removeAttribute('hidden')
  }
}

loadWeather()


// ── Apps ─────────────────────────────────────────────────────
// Tout le contenu venu de la base passe par textContent et setAttribute,
// jamais par innerHTML : un nom ou une URL ne peut pas devenir du code.
let sessionToken = localStorage.getItem('sessionToken') || null

function authHeaders() {
  return sessionToken ? { 'X-Session-Token': sessionToken } : {}
}

function jsonHeaders() {
  return { 'Content-Type': 'application/json', ...authHeaders() }
}

function el(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

// Icône de la tuile, ou ses initiales si elle n'en a pas ou ne charge pas.
// Pas de service de favicons tiers : il recevrait le nom d'hôte de chaque tuile.
function iconNode(app, imgClass, fallbackClass) {
  const fallback = el('div', fallbackClass, initials(app.name))
  const src = safeHttpUrl(app.icon)
  if (!src) return fallback
  const img = el('img', imgClass)
  img.src = src
  img.alt = ''
  img.loading = 'lazy'
  img.addEventListener('error', () => img.replaceWith(fallback), { once: true })
  return img
}

function appCard(app) {
  const href = safeHttpUrl(app.url)
  const card = el(href ? 'a' : 'div', 'app-item')
  if (href) {
    card.href = href
    card.target = '_blank'
    card.rel = 'noopener noreferrer'
  }
  card.title = app.name
  card.append(iconNode(app, 'app-icon', 'app-icon-fallback'), el('span', 'app-name', app.name))
  return card
}

function appGrid(list, className) {
  const grid = el('div', className)
  grid.append(...list.map(appCard))
  return grid
}

function renderApps(apps, categories) {
  const grid = document.getElementById('appsGrid')
  grid.replaceChildren()
  if (!apps.length) return

  if (!categories || !categories.length) {
    grid.classList.remove('categorized')
    grid.append(...apps.map(appCard))
    return
  }

  grid.classList.add('categorized')

  const catApps = {}
  categories.forEach(c => { catApps[c.id] = [] })
  const uncategorized = []

  apps.forEach(app => {
    if (app.category_id && catApps[app.category_id]) {
      catApps[app.category_id].push(app)
    } else {
      uncategorized.push(app)
    }
  })

  categories.forEach(cat => {
    const list = catApps[cat.id]
    if (!list.length) return
    const section = el('div', 'cat-section')
    section.append(el('div', 'cat-header', cat.name), appGrid(list, 'apps-grid cat-grid'))
    grid.append(section)
  })

  if (uncategorized.length) {
    const section = el('div', 'cat-section')
    section.append(el('div', 'cat-header', 'Autres'), appGrid(uncategorized, 'apps-grid cat-grid'))
    grid.append(section)
  }
}

async function loadApps() {
  try {
    const [appsRes, catsRes] = await Promise.all([
      fetch('/api/apps', { headers: authHeaders() }),
      fetch('/api/categories', { headers: authHeaders() })
    ])
    if (!appsRes.ok) return
    const apps = await appsRes.json()
    const cats = catsRes.ok ? await catsRes.json() : []
    renderApps(apps, cats)
  } catch (err) {
    console.error('[apps]', err)
  }
}

loadApps()
loadServerSettings()


// ── Settings ──────────────────────────────────────────────────
const elSettingsBtn     = document.getElementById('settingsBtn')
const elSettingsOverlay = document.getElementById('settingsOverlay')
const elLoginPanel      = document.getElementById('loginPanel')
const elSettingsPanel   = document.getElementById('settingsPanel')
const elLoginInput      = document.getElementById('loginInput')
const elLoginError      = document.getElementById('loginError')
const elLoginCancel     = document.getElementById('loginCancel')
const elLoginSubmit     = document.getElementById('loginSubmit')
const elLogoutBtn       = document.getElementById('logoutBtn')
const elSettingsClose   = document.getElementById('settingsClose')
const elSettingsAppList = document.getElementById('settingsAppList')
const elSettingsCatList = document.getElementById('settingsCatList')
const elAddAppBtn       = document.getElementById('addAppBtn')
const elAddAppForm      = document.getElementById('addAppForm')
const elAddAppCancel    = document.getElementById('addAppCancel')
const elAddAppSubmit    = document.getElementById('addAppSubmit')
const elAddCatBtn       = document.getElementById('addCatBtn')
const elAddCatForm      = document.getElementById('addCatForm')
const elAddCatCancel    = document.getElementById('addCatCancel')
const elAddCatSubmit    = document.getElementById('addCatSubmit')
const elSettingsError   = document.getElementById('settingsError')

async function checkAuth() {
  if (!sessionToken) return false
  try {
    const r = await fetch('/api/auth/check', { headers: authHeaders() })
    return (await r.json()).ok === true
  } catch { return false }
}

function showLoginPanel() {
  elLoginPanel.removeAttribute('hidden')
  elSettingsPanel.setAttribute('hidden', '')
  elLoginInput.value = ''
  elLoginError.setAttribute('hidden', '')
  elLoginError.textContent = ''
  setTimeout(() => elLoginInput.focus(), 50)
}

async function openSettings() {
  elLoginPanel.setAttribute('hidden', '')
  elSettingsPanel.setAttribute('hidden', '')
  elSettingsOverlay.removeAttribute('hidden')
  if (await checkAuth()) {
    showSettingsPanel()
  } else {
    showLoginPanel()
  }
}

function closeSettings() {
  elSettingsOverlay.setAttribute('hidden', '')
}

async function showSettingsPanel() {
  elLoginPanel.setAttribute('hidden', '')
  elSettingsPanel.removeAttribute('hidden')
  elAddAppForm.setAttribute('hidden', '')
  elAddCatForm.setAttribute('hidden', '')
  showSettingsError('')
  initSettingsSearch()
  loadApps()
  await refreshSettings()
}

function showSettingsError(message) {
  elSettingsError.textContent = message
  elSettingsError.hidden = !message
}

// Envoie une écriture et affiche le refus du serveur au lieu de l'avaler.
async function send(url, method, body) {
  const r = await fetch(url, { method, headers: jsonHeaders(), body: body === undefined ? undefined : JSON.stringify(body) })
  if (!r.ok) {
    const data = await r.json().catch(() => ({}))
    showSettingsError(data.error || `Erreur ${r.status}`)
    return null
  }
  showSettingsError('')
  return r
}

// ── Settings data ─────────────────────────────────────────────
let _settingsCats = []
let _settingsApps = []

async function refreshSettings() {
  try {
    const [appsRes, catsRes] = await Promise.all([
      fetch('/api/apps', { headers: authHeaders() }),
      fetch('/api/categories', { headers: authHeaders() })
    ])
    _settingsApps = appsRes.ok ? await appsRes.json() : []
    _settingsCats = catsRes.ok ? await catsRes.json() : []
    renderSettingsCats(_settingsCats)
    renderSettingsApps(_settingsApps, _settingsCats)
  } catch (err) {
    console.error('[settings]', err)
  }
}

function iconButton(action, id, label, title, extraClass = '') {
  const btn = el('button', `btn-icon${extraClass ? ' ' + extraClass : ''}`, label)
  btn.type = 'button'
  btn.title = title
  btn.dataset.action = action
  btn.dataset.id = String(id)
  return btn
}

// ── Categories settings ───────────────────────────────────────
function renderSettingsCats(cats) {
  if (!cats.length) {
    elSettingsCatList.replaceChildren(el('div', 'settings-empty', 'Aucune catégorie'))
    return
  }
  elSettingsCatList.replaceChildren(...cats.map((cat, i) => {
    const row = el('div', 'cat-row')
    const actions = el('div', 'cat-row-actions')
    const up = iconButton('cat-up', cat.id, '↑', 'Monter', i === 0 ? 'disabled' : '')
    const down = iconButton('cat-down', cat.id, '↓', 'Descendre', i === cats.length - 1 ? 'disabled' : '')
    up.disabled = i === 0
    down.disabled = i === cats.length - 1
    actions.append(up, down,
      iconButton('cat-rename', cat.id, '✏️', 'Renommer'),
      iconButton('cat-delete', cat.id, '🗑', 'Supprimer', 'danger'))
    row.append(el('span', 'cat-row-name', cat.name), actions)
    return row
  }))
}

async function moveCat(id, dir) {
  const idx = _settingsCats.findIndex(c => c.id === id)
  const swapIdx = dir === 'up' ? idx - 1 : idx + 1
  if (idx === -1 || swapIdx < 0 || swapIdx >= _settingsCats.length) return
  const a = _settingsCats[idx]
  const b = _settingsCats[swapIdx]
  await Promise.all([
    send(`/api/categories/${a.id}`, 'PUT', { name: a.name, order_index: b.order_index }),
    send(`/api/categories/${b.id}`, 'PUT', { name: b.name, order_index: a.order_index })
  ])
  await refreshSettings()
  loadApps()
}

async function renameCat(id) {
  const cat = _settingsCats.find(c => c.id === id)
  if (!cat) return
  const newName = prompt('Nouveau nom :', cat.name)
  if (!newName || newName === cat.name) return
  await send(`/api/categories/${id}`, 'PUT', { name: newName, order_index: cat.order_index })
  await refreshSettings()
  loadApps()
}

async function deleteCat(id) {
  const cat = _settingsCats.find(c => c.id === id)
  if (!cat || !confirm(`Supprimer la catégorie "${cat.name}" ? Les apps seront désassignées.`)) return
  await send(`/api/categories/${id}`, 'DELETE')
  await refreshSettings()
  loadApps()
}

elSettingsCatList.addEventListener('click', e => {
  const btn = e.target.closest('button[data-action]')
  if (!btn || btn.disabled) return
  const id = Number(btn.dataset.id)
  if (btn.dataset.action === 'cat-up') moveCat(id, 'up')
  if (btn.dataset.action === 'cat-down') moveCat(id, 'down')
  if (btn.dataset.action === 'cat-rename') renameCat(id)
  if (btn.dataset.action === 'cat-delete') deleteCat(id)
})

elAddCatBtn.addEventListener('click', () => {
  elAddCatForm.removeAttribute('hidden')
  elAddCatBtn.setAttribute('hidden', '')
  document.getElementById('newCatName').focus()
})
elAddCatCancel.addEventListener('click', () => {
  elAddCatForm.setAttribute('hidden', '')
  elAddCatBtn.removeAttribute('hidden')
})
elAddCatSubmit.addEventListener('click', async () => {
  const name = document.getElementById('newCatName').value.trim()
  if (!name) return
  const maxOrder = _settingsCats.reduce((m, c) => Math.max(m, Number(c.order_index) || 0), -1)
  if (!await send('/api/categories', 'POST', { name, order_index: maxOrder + 1 })) return
  document.getElementById('newCatName').value = ''
  elAddCatForm.setAttribute('hidden', '')
  elAddCatBtn.removeAttribute('hidden')
  await refreshSettings()
})
document.getElementById('newCatName').addEventListener('keydown', e => {
  if (e.key === 'Enter') elAddCatSubmit.click()
})

// ── Apps settings ─────────────────────────────────────────────
function catSelect(cats, app) {
  const select = el('select', 'cat-select')
  select.dataset.id = String(app.id)
  const none = el('option', '', '—')
  none.value = ''
  select.append(none, ...cats.map(c => {
    const opt = el('option', '', c.name)
    opt.value = String(c.id)
    return opt
  }))
  select.value = app.category_id ? String(app.category_id) : ''
  return select
}

function renderSettingsApps(apps, cats) {
  elSettingsAppList.replaceChildren(...apps.map(app => {
    const row = el('div', 'app-row')
    const isPublic = !!app.public
    row.append(iconNode(app, 'app-row-icon', 'app-row-icon-fallback'), el('span', 'app-row-name', app.name))
    if (cats.length) row.append(catSelect(cats, app))
    row.append(
      iconButton('app-public', app.id, isPublic ? '🌐' : '🔒', isPublic ? 'Public' : 'Privé', `app-public-toggle${isPublic ? ' public' : ''}`),
      iconButton('app-edit', app.id, '✏️', 'Modifier'),
      iconButton('app-delete', app.id, '🗑', 'Supprimer', 'danger'))
    return row
  }))
}

function appPayload(app, changes) {
  return {
    name: app.name,
    url: app.url,
    icon: app.icon || '',
    order_index: Number.isInteger(app.order_index) ? app.order_index : 0,
    public: !!app.public,
    category_id: app.category_id ?? null,
    ...changes,
  }
}

async function updateApp(id, changes) {
  const app = _settingsApps.find(a => a.id === id)
  if (!app) return
  if (await send(`/api/apps/${id}`, 'PUT', appPayload(app, changes))) {
    loadApps()
    await refreshSettings()
  }
}

async function editApp(id) {
  const app = _settingsApps.find(a => a.id === id)
  if (!app) return
  const name = prompt('Nom :', app.name)
  if (name === null) return
  const url = prompt('URL :', app.url)
  if (url === null) return
  const icon = prompt('Icône URL :', app.icon || '')
  await updateApp(id, { name, url, icon: icon ?? app.icon ?? '' })
}

async function deleteApp(id) {
  const app = _settingsApps.find(a => a.id === id)
  if (!app || !confirm(`Supprimer "${app.name}" ?`)) return
  if (await send(`/api/apps/${id}`, 'DELETE')) {
    loadApps()
    refreshSettings()
  }
}

elSettingsAppList.addEventListener('click', e => {
  const btn = e.target.closest('button[data-action]')
  if (!btn) return
  const id = Number(btn.dataset.id)
  const app = _settingsApps.find(a => a.id === id)
  if (btn.dataset.action === 'app-public' && app) updateApp(id, { public: !app.public })
  if (btn.dataset.action === 'app-edit') editApp(id)
  if (btn.dataset.action === 'app-delete') deleteApp(id)
})

elSettingsAppList.addEventListener('change', e => {
  const select = e.target.closest('select.cat-select')
  if (!select) return
  updateApp(Number(select.dataset.id), { category_id: select.value ? Number(select.value) : null })
})

// ── Login ─────────────────────────────────────────────────────
elLoginSubmit.addEventListener('click', async () => {
  const pw = elLoginInput.value
  if (!pw) return
  elLoginError.setAttribute('hidden', '')
  const r = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: pw })
  })
  const data = await r.json().catch(() => ({}))
  if (r.ok && data.token) {
    sessionToken = data.token
    localStorage.setItem('sessionToken', sessionToken)
    await loadServerSettings()
    showSettingsPanel()
  } else {
    elLoginError.textContent = data.error || 'Erreur'
    elLoginError.removeAttribute('hidden')
  }
})
elLoginInput.addEventListener('keydown', e => { if (e.key === 'Enter') elLoginSubmit.click() })
elLoginCancel.addEventListener('click', closeSettings)

elLogoutBtn.addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST', headers: authHeaders() })
  sessionToken = null
  localStorage.removeItem('sessionToken')
  loadApps()
  closeSettings()
})

elSettingsClose.addEventListener('click', closeSettings)
elSettingsOverlay.addEventListener('click', e => { if (e.target === elSettingsOverlay) closeSettings() })
elSettingsBtn.addEventListener('click', openSettings)

// ── Mot de passe ──────────────────────────────────────────────
document.getElementById('changePasswordBtn').addEventListener('click', async () => {
  const current = document.getElementById('currentPassword')
  const next = document.getElementById('newPassword')
  const confirmField = document.getElementById('confirmPassword')
  if (next.value !== confirmField.value) {
    showSettingsError('Les deux nouveaux mots de passe diffèrent.')
    return
  }
  const r = await send('/api/auth/password', 'POST', { current: current.value, next: next.value })
  if (!r) return
  // Toutes les autres sessions sont révoquées, celle-ci est remplacée.
  sessionToken = (await r.json()).token
  localStorage.setItem('sessionToken', sessionToken)
  current.value = next.value = confirmField.value = ''
  showSettingsError('Mot de passe changé. Les autres sessions sont déconnectées.')
})

// ── Settings search section ───────────────────────────────────
let _searchInitDone = false

function initSettingsSearch() {
  const sel = document.getElementById('settingsEngineSelect')
  const customRow = document.getElementById('customEngineRow')
  const customUrl = document.getElementById('customEngineUrl')
  const saveBtn   = document.getElementById('saveCustomEngine')
  if (!sel) return

  sel.value = currentEngine
  customRow.hidden = currentEngine !== 'custom'
  if (currentEngine === 'custom') customUrl.value = ENGINES.custom.url

  if (_searchInitDone) return
  _searchInitDone = true

  sel.addEventListener('change', () => {
    const key = sel.value
    customRow.hidden = key !== 'custom'
    applyEngine(key, key !== 'custom')
  })

  saveBtn.addEventListener('click', async () => {
    const url = safeHttpUrl(customUrl.value.trim())
    if (!url) {
      showSettingsError('Adresse du moteur : http ou https uniquement.')
      return
    }
    ENGINES.custom.url = url
    applyEngine('custom', true)
  })
}

// ── Add app ───────────────────────────────────────────────────
elAddAppBtn.addEventListener('click', () => {
  elAddAppForm.removeAttribute('hidden')
  elAddAppBtn.setAttribute('hidden', '')
  document.getElementById('newAppName').focus()
})
elAddAppCancel.addEventListener('click', () => {
  elAddAppForm.setAttribute('hidden', '')
  elAddAppBtn.removeAttribute('hidden')
})
elAddAppSubmit.addEventListener('click', async () => {
  const name = document.getElementById('newAppName').value.trim()
  const url  = document.getElementById('newAppUrl').value.trim()
  const icon = document.getElementById('newAppIcon').value.trim()
  if (!name || !url) return
  if (await send('/api/apps', 'POST', { name, url, icon })) {
    document.getElementById('newAppName').value = ''
    document.getElementById('newAppUrl').value  = ''
    document.getElementById('newAppIcon').value = ''
    elAddAppForm.setAttribute('hidden', '')
    elAddAppBtn.removeAttribute('hidden')
    loadApps()
    refreshSettings()
  }
})
