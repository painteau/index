// ============================================================
//  Index — main.js
// ============================================================

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
  whoogle:    { name: 'Whoogle',      icon: 'W',  url: 'https://google.onode.fr/search?q=' },
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
    if (s.search_engine_custom_url) ENGINES.custom.url = s.search_engine_custom_url
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
    window.open(ENGINES[currentEngine].url + encodeURIComponent(q), target)
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
  if (saved) return JSON.parse(saved)
  return new Promise(resolve => {
    if (!navigator.geolocation) { resolve({ lat: 48.8566, lon: 2.3522 }); return }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude }
        localStorage.setItem('weatherCoords', JSON.stringify(coords))
        resolve(coords)
      },
      () => resolve({ lat: 48.8566, lon: 2.3522 }),
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
let sessionToken = localStorage.getItem('sessionToken') || null

function authHeaders() {
  return sessionToken ? { 'X-Session-Token': sessionToken } : {}
}

function appCard(app) {
  const initial = app.name.slice(0, 2)
  const favicon = `https://www.google.com/s2/favicons?domain=${new URL(app.url).hostname}&sz=64`
  const iconSrc = app.icon || favicon
  const iconHtml = `<img class="app-icon" src="${iconSrc}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'app-icon-fallback',textContent:'${initial}'}))">`
  return `<a class="app-item" href="${app.url}" target="_blank" rel="noopener" title="${app.name}">
    ${iconHtml}
    <span class="app-name">${app.name}</span>
  </a>`
}

function renderApps(apps, categories) {
  const grid = document.getElementById('appsGrid')
  grid.innerHTML = ''
  if (!apps.length) return

  if (!categories || !categories.length) {
    grid.classList.remove('categorized')
    grid.innerHTML = apps.map(appCard).join('')
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

  const sections = []

  categories.forEach(cat => {
    const list = catApps[cat.id]
    if (!list.length) return
    sections.push(`<div class="cat-section">
      <div class="cat-header">${cat.name}</div>
      <div class="apps-grid cat-grid">${list.map(appCard).join('')}</div>
    </div>`)
  })

  if (uncategorized.length) {
    const header = categories.length ? '<div class="cat-header">Autres</div>' : ''
    sections.push(`<div class="cat-section">
      ${header}
      <div class="apps-grid cat-grid">${uncategorized.map(appCard).join('')}</div>
    </div>`)
  }

  grid.innerHTML = sections.join('')
}

async function loadApps() {
  try {
    const [appsRes, catsRes] = await Promise.all([
      fetch('/api/apps', { headers: authHeaders() }),
      fetch('/api/categories')
    ])
    if (!appsRes.ok) return
    const apps = await appsRes.json()
    const cats = catsRes.ok ? await catsRes.json() : []
    renderApps(apps, cats)
  } catch {}
}

loadApps()
loadServerSettings()


// ── Settings ──────────────────────────────────────────────────
const elSettingsBtn     = document.getElementById('settingsBtn')
const elSettingsOverlay = document.getElementById('settingsOverlay')
const elLoginPanel      = document.getElementById('loginPanel')
const elSettingsPanel   = document.getElementById('settingsPanel')
const elLoginTitle      = document.getElementById('loginTitle')
const elLoginHint       = document.getElementById('loginHint')
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

async function checkAuth() {
  if (!sessionToken) return { ok: false, setup: false }
  try {
    const r = await fetch('/api/auth/check', { headers: authHeaders() })
    return await r.json()
  } catch { return { ok: false, setup: false } }
}

function showLoginPanel(hint, isSetup = false) {
  elLoginPanel.removeAttribute('hidden')
  elSettingsPanel.setAttribute('hidden', '')
  elLoginInput.value = ''
  elLoginError.setAttribute('hidden', '')
  elLoginError.textContent = ''
  elLoginHint.textContent = hint
  elLoginSubmit.textContent = isSetup ? 'Définir' : 'Connexion'
  elLoginTitle.textContent = isSetup ? 'Créer un mot de passe' : 'Accès paramètres'
  setTimeout(() => elLoginInput.focus(), 50)
}

async function openSettings() {
  elLoginPanel.setAttribute('hidden', '')
  elSettingsPanel.setAttribute('hidden', '')
  elSettingsOverlay.removeAttribute('hidden')
  const { ok, setup } = await checkAuth()
  if (ok) {
    showSettingsPanel()
  } else if (setup) {
    showLoginPanel('Premier accès : choisissez un mot de passe', true)
  } else {
    showLoginPanel('Entrez votre mot de passe')
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
  initSettingsSearch()
  loadApps()
  await refreshSettings()
}

// ── Settings data ─────────────────────────────────────────────
let _settingsCats = []

async function refreshSettings() {
  try {
    const [appsRes, catsRes] = await Promise.all([
      fetch('/api/apps', { headers: authHeaders() }),
      fetch('/api/categories', { headers: authHeaders() })
    ])
    const apps = appsRes.ok ? await appsRes.json() : []
    _settingsCats = catsRes.ok ? await catsRes.json() : []
    renderSettingsCats(_settingsCats)
    renderSettingsApps(apps, _settingsCats)
  } catch {}
}

// ── Categories settings ───────────────────────────────────────
function renderSettingsCats(cats) {
  elSettingsCatList.innerHTML = cats.length
    ? cats.map((cat, i) => `
      <div class="cat-row" data-id="${cat.id}" data-order="${cat.order_index}" data-name="${cat.name.replace(/"/g,'&quot;')}">
        <span class="cat-row-name">${cat.name}</span>
        <div class="cat-row-actions">
          <button class="btn-icon${i === 0 ? ' disabled' : ''}" onclick="moveCat(${cat.id},'up')" title="Monter" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="btn-icon${i === cats.length-1 ? ' disabled' : ''}" onclick="moveCat(${cat.id},'down')" title="Descendre" ${i === cats.length-1 ? 'disabled' : ''}>↓</button>
          <button class="btn-icon" onclick="renameCat(${cat.id})" title="Renommer">✏️</button>
          <button class="btn-icon danger" onclick="deleteCat(${cat.id},'${cat.name.replace(/'/g,"\\'")}')">🗑</button>
        </div>
      </div>`
    ).join('')
    : '<div class="settings-empty">Aucune catégorie</div>'
}

window.moveCat = async (id, dir) => {
  const rows = [...document.querySelectorAll('.cat-row')]
  const idx  = rows.findIndex(r => r.dataset.id == id)
  if (idx === -1) return
  const swapIdx = dir === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= rows.length) return

  const a = rows[idx]
  const b = rows[swapIdx]
  const aOrder = parseInt(a.dataset.order)
  const bOrder = parseInt(b.dataset.order)

  await Promise.all([
    fetch(`/api/categories/${a.dataset.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ name: a.dataset.name, order_index: bOrder })
    }),
    fetch(`/api/categories/${b.dataset.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ name: b.dataset.name, order_index: aOrder })
    })
  ])
  await refreshSettings()
  loadApps()
}

window.renameCat = async (id) => {
  const row = document.querySelector(`.cat-row[data-id="${id}"]`)
  if (!row) return
  const current = row.dataset.name
  const order   = parseInt(row.dataset.order)
  const newName = prompt('Nouveau nom :', current)
  if (!newName || newName === current) return
  await fetch(`/api/categories/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ name: newName, order_index: order })
  })
  await refreshSettings()
  loadApps()
}

window.deleteCat = async (id, name) => {
  if (!confirm(`Supprimer la catégorie "${name}" ? Les apps seront désassignées.`)) return
  await fetch(`/api/categories/${id}`, { method: 'DELETE', headers: authHeaders() })
  await refreshSettings()
  loadApps()
}

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
  const maxOrder = _settingsCats.reduce((m, c) => Math.max(m, c.order_index), -1)
  await fetch('/api/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ name, order_index: maxOrder + 1 })
  })
  document.getElementById('newCatName').value = ''
  elAddCatForm.setAttribute('hidden', '')
  elAddCatBtn.removeAttribute('hidden')
  await refreshSettings()
})
document.getElementById('newCatName').addEventListener('keydown', e => {
  if (e.key === 'Enter') elAddCatSubmit.click()
})

// ── Apps settings ─────────────────────────────────────────────
function catSelect(cats, currentCatId) {
  const opts = cats.map(c =>
    `<option value="${c.id}" ${c.id == currentCatId ? 'selected' : ''}>${c.name}</option>`
  ).join('')
  return `<select class="cat-select" onchange="setAppCat(this)">
    <option value="" ${!currentCatId ? 'selected' : ''}>—</option>
    ${opts}
  </select>`
}

function renderSettingsApps(apps, cats) {
  elSettingsAppList.innerHTML = apps.map(app => {
    const initial = (app.name || '?').slice(0, 2).toUpperCase()
    const iconHtml = app.icon
      ? `<img class="app-row-icon" src="${app.icon}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'app-row-icon-fallback',textContent:'${initial}'}))">`
      : `<div class="app-row-icon-fallback">${initial}</div>`
    const isPublic = !!app.public
    return `<div class="app-row" data-id="${app.id}" data-url="${app.url}" data-icon="${app.icon ?? ''}" data-public="${isPublic ? '1' : '0'}" data-cat="${app.category_id ?? ''}">
      ${iconHtml}
      <span class="app-row-name">${app.name}</span>
      ${cats.length ? catSelect(cats, app.category_id) : ''}
      <button class="btn-icon app-public-toggle ${isPublic ? 'public' : ''}" onclick="togglePublic(${app.id})" title="${isPublic ? 'Public' : 'Privé'}">${isPublic ? '🌐' : '🔒'}</button>
      <button class="btn-icon" onclick="editApp(${app.id})" title="Modifier">✏️</button>
      <button class="btn-icon danger" onclick="deleteApp(${app.id},'${app.name.replace(/'/g,"\\'")}')">🗑</button>
    </div>`
  }).join('')
}

window.setAppCat = async (select) => {
  const row = select.closest('.app-row')
  if (!row) return
  const id       = row.dataset.id
  const name     = row.querySelector('.app-row-name').textContent
  const url      = row.dataset.url
  const icon     = row.dataset.icon
  const isPublic = row.dataset.public === '1'
  const catId    = select.value ? parseInt(select.value) : null
  await fetch(`/api/apps/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ name, url, icon, order_index: 0, public: isPublic, category_id: catId })
  })
  row.dataset.cat = catId ?? ''
  loadApps()
}

window.togglePublic = async (id) => {
  const row = document.querySelector(`.app-row[data-id="${id}"]`)
  if (!row) return
  const name     = row.querySelector('.app-row-name').textContent
  const url      = row.dataset.url
  const icon     = row.dataset.icon
  const isPublic = row.dataset.public === '1'
  const catId    = row.dataset.cat ? parseInt(row.dataset.cat) : null
  const r = await fetch(`/api/apps/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ name, url, icon, order_index: 0, public: !isPublic, category_id: catId })
  })
  if (r.ok) refreshSettings()
}

window.deleteApp = async (id, name) => {
  if (!confirm(`Supprimer "${name}" ?`)) return
  await fetch(`/api/apps/${id}`, { method: 'DELETE', headers: authHeaders() })
  loadApps()
  refreshSettings()
}

window.editApp = async (id) => {
  const row = document.querySelector(`.app-row[data-id="${id}"]`)
  if (!row) return
  const name     = row.querySelector('.app-row-name').textContent
  const url      = row.dataset.url
  const icon     = row.dataset.icon
  const isPublic = row.dataset.public === '1'
  const catId    = row.dataset.cat ? parseInt(row.dataset.cat) : null

  const newName = prompt('Nom :', name)
  if (newName === null) return
  const newUrl  = prompt('URL :', url)
  if (newUrl === null) return
  const newIcon = prompt('Icône URL :', icon)

  const r = await fetch(`/api/apps/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ name: newName, url: newUrl, icon: newIcon ?? icon, order_index: 0, public: isPublic, category_id: catId })
  })
  if (r.ok) { loadApps(); refreshSettings() }
}

// ── Login ─────────────────────────────────────────────────────
elLoginSubmit.addEventListener('click', async () => {
  const pw = elLoginInput.value.trim()
  if (!pw) return
  elLoginError.setAttribute('hidden', '')
  const r = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: pw })
  })
  const data = await r.json()
  if (r.ok) {
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

// ── Settings search section ───────────────────────────────────
async function initSettingsSearch() {
  const sel = document.getElementById('settingsEngineSelect')
  const customRow = document.getElementById('customEngineRow')
  const customUrl = document.getElementById('customEngineUrl')
  const saveBtn   = document.getElementById('saveCustomEngine')
  if (!sel) return

  sel.value = currentEngine
  customRow.hidden = currentEngine !== 'custom'
  if (currentEngine === 'custom') customUrl.value = ENGINES.custom.url

  sel.addEventListener('change', () => {
    const key = sel.value
    customRow.hidden = key !== 'custom'
    applyEngine(key, key !== 'custom')
  })

  saveBtn.addEventListener('click', async () => {
    const url = customUrl.value.trim()
    if (!url) return
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
  const r = await fetch('/api/apps', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ name, url, icon })
  })
  if (r.ok) {
    document.getElementById('newAppName').value = ''
    document.getElementById('newAppUrl').value  = ''
    document.getElementById('newAppIcon').value = ''
    elAddAppForm.setAttribute('hidden', '')
    elAddAppBtn.removeAttribute('hidden')
    loadApps()
    refreshSettings()
  }
})
