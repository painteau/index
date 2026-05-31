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
const DAYS_FR = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
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
  google:     { name: 'Google',      icon: 'G',  url: 'https://www.google.com/search?q=' },
  duckduckgo: { name: 'DuckDuckGo',  icon: 'D',  url: 'https://duckduckgo.com/?q=' },
  brave:      { name: 'Brave',       icon: 'B',  url: 'https://search.brave.com/search?q=' },
  bing:       { name: 'Bing',        icon: 'Bi', url: 'https://www.bing.com/search?q=' },
  qwant:      { name: 'Qwant',       icon: 'Q',  url: 'https://www.qwant.com/?q=' },
}

let currentEngine = localStorage.getItem('searchEngine') || 'google'

const elEngineBtn      = document.getElementById('engineBtn')
const elEngineIcon     = document.getElementById('engineIcon')
const elEngineDropdown = document.getElementById('engineDropdown')
const elSearchInput    = document.getElementById('searchInput')
const elSearchSubmit   = document.getElementById('searchSubmit')
const elOverlay        = document.getElementById('overlay')

function applyEngine(key) {
  currentEngine = key
  localStorage.setItem('searchEngine', key)
  elEngineIcon.textContent = ENGINES[key].icon
  document.querySelectorAll('.engine-opt').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.engine === key)
  })
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
    applyEngine(btn.dataset.engine)
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

// Auto-focus: click anywhere to focus search
document.addEventListener('keydown', e => {
  if (
    e.target !== elSearchInput &&
    !e.ctrlKey && !e.metaKey && !e.altKey &&
    e.key.length === 1
  ) {
    elSearchInput.focus()
  }
})

// Focus on load
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

const WMO = {
  0: 'Ciel dégagé',        1: 'Principalement dégagé', 2: 'Partiellement nuageux', 3: 'Couvert',
  45: 'Brouillard',        48: 'Brouillard givrant',
  51: 'Bruine légère',     53: 'Bruine',               55: 'Bruine dense',
  61: 'Pluie légère',      63: 'Pluie modérée',        65: 'Pluie forte',
  71: 'Neige légère',      73: 'Neige',                75: 'Neige forte',
  77: 'Grains de neige',
  80: 'Averses légères',   81: 'Averses',              82: 'Averses violentes',
  85: 'Averses de neige',  86: 'Averses de neige fortes',
  95: 'Orage',             96: 'Orage avec grêle',     99: 'Orage violent',
}

const elWeatherSkeleton = document.getElementById('weatherSkeleton')
const elWeatherCard     = document.getElementById('weatherCard')
const elWeatherError    = document.getElementById('weatherError')
const elWeatherIcon     = document.getElementById('weatherIcon')

async function getCoords() {
  const saved = localStorage.getItem('weatherCoords')
  if (saved) return JSON.parse(saved)

  return new Promise(resolve => {
    if (!navigator.geolocation) {
      resolve({ lat: 48.8566, lon: 2.3522 })
      return
    }
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
  } catch {
    return 'Localisation'
  }
}

function buildRainChart(hourlyPrecip, currentHour) {
  const container = document.getElementById('rainChart')
  container.innerHTML = ''

  // Show next 12 hours
  const maxMm  = Math.max(...hourlyPrecip, 0.5)
  const chartH = 18 // px usable height

  hourlyPrecip.forEach((mm, i) => {
    const bar = document.createElement('div')
    bar.className = 'rain-bar'
    const heightPct = Math.max(mm / maxMm, 0.05)
    bar.style.height = `${Math.round(heightPct * chartH)}px`
    if (mm > 0.1) bar.classList.add('has-rain')
    if (i === 0)  bar.classList.add('current-hour')
    bar.title = `${i === 0 ? 'Maintenant' : `+${i}h`}: ${mm.toFixed(1)} mm`
    container.appendChild(bar)
  })
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
    const feels     = Math.round(cur.apparent_temperature)
    const code      = cur.weather_code
    const rainToday = (data.daily.precipitation_sum[0] || 0).toFixed(1)

    // Current + next 11 hours of precipitation
    const now         = new Date(cur.time)
    const currentHour = now.getHours()
    const allTimes    = data.hourly.time
    const allPrecip   = data.hourly.precipitation

    const startIdx = allTimes.findIndex(t => {
      const d = new Date(t)
      return d.getHours() === currentHour && d.getDate() === now.getDate()
    })

    const next12 = startIdx >= 0
      ? allPrecip.slice(startIdx, startIdx + 12)
      : allPrecip.slice(0, 12)

    const rainNextHour = (next12[1] ?? next12[0] ?? 0).toFixed(1)

    // Update DOM
    if (elWeatherIcon) elWeatherIcon.textContent = WMO_ICON[code] ?? '🌡'
    document.getElementById('weatherTemp').textContent      = `${temp}°`
    document.getElementById('weatherCity').textContent      = city
    document.getElementById('rainToday').textContent        = `${rainToday}mm`

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

// ── Apps ─────────────────────────────────────────────────
async function loadApps() {
  try {
    let res = await fetch('/api/apps')
    if (!res.ok) res = await fetch('/apps.json')
    if (!res.ok) return
    const apps = await res.json()
    renderApps(apps)
  } catch {
    try {
      const res = await fetch('/apps.json')
      if (res.ok) renderApps(await res.json())
    } catch {}
  }
}

function renderApps(apps) {
  const grid = document.getElementById('appsGrid')
  if (!apps.length) return

  grid.innerHTML = apps.map(app => {
    const initial = app.name.slice(0, 2)
    const iconHtml = app.icon
      ? `<img class="app-icon" src="${app.icon}" alt="" loading="lazy" onerror="this.parentNode.querySelector('.app-icon').replaceWith(Object.assign(document.createElement('div'), {className:'app-icon-fallback', textContent:'${initial}'}))">`
      : `<div class="app-icon-fallback">${initial}</div>`
    return `<a class="app-item" href="${app.url}" target="_blank" rel="noopener" title="${app.name}">
      ${iconHtml}
      <span class="app-name">${app.name}</span>
    </a>`
  }).join('')
}

loadApps()

// ── Settings ──────────────────────────────────────────────
let sessionToken = localStorage.getItem('sessionToken') || null

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
const elAddAppBtn       = document.getElementById('addAppBtn')
const elAddAppForm      = document.getElementById('addAppForm')
const elAddAppCancel    = document.getElementById('addAppCancel')
const elAddAppSubmit    = document.getElementById('addAppSubmit')

function authHeaders() {
  return sessionToken ? { 'X-Session-Token': sessionToken } : {}
}

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
  await refreshSettingsApps()
}

async function refreshSettingsApps() {
  try {
    const r = await fetch('/api/apps')
    const apps = await r.json()
    renderSettingsApps(apps)
  } catch {}
}

function renderSettingsApps(apps) {
  elSettingsAppList.innerHTML = apps.map(app => {
    const initial = (app.name || '?').slice(0, 2).toUpperCase()
    const iconHtml = app.icon
      ? `<img class="app-row-icon" src="${app.icon}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'app-row-icon-fallback',textContent:'${initial}'}))">`
      : `<div class="app-row-icon-fallback">${initial}</div>`
    return `<div class="app-row" data-id="${app.id}">
      ${iconHtml}
      <span class="app-row-name">${app.name}</span>
      <span class="app-row-url">${new URL(app.url).hostname}</span>
      <button class="btn-icon" onclick="editApp(${app.id})" title="Modifier">✏️</button>
      <button class="btn-icon danger" onclick="deleteApp(${app.id},'${app.name.replace(/'/g,"\\'")}')">🗑</button>
    </div>`
  }).join('')
}

window.deleteApp = async (id, name) => {
  if (!confirm(`Supprimer "${name}" ?`)) return
  await fetch(`/api/apps/${id}`, { method: 'DELETE', headers: authHeaders() })
  loadApps()
  refreshSettingsApps()
}

window.editApp = async (id) => {
  const row = document.querySelector(`.app-row[data-id="${id}"]`)
  if (!row) return
  const name = row.querySelector('.app-row-name').textContent
  const hostname = row.querySelector('.app-row-url').textContent

  const newName = prompt('Nom :', name)
  if (newName === null) return
  const newUrl  = prompt('URL :', `https://${hostname}`)
  if (newUrl === null) return
  const newIcon = prompt('Icône URL (laisser vide pour garder) :', '')

  const r = await fetch(`/api/apps/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ name: newName, url: newUrl, icon: newIcon || undefined, order_index: 0 })
  })
  if (r.ok) { loadApps(); refreshSettingsApps() }
}

// Login
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
    showSettingsPanel()
  } else {
    elLoginError.textContent = data.error || 'Erreur'
    elLoginError.removeAttribute('hidden')
  }
})
elLoginInput.addEventListener('keydown', e => { if (e.key === 'Enter') elLoginSubmit.click() })
elLoginCancel.addEventListener('click', closeSettings)

// Logout
elLogoutBtn.addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST', headers: authHeaders() })
  sessionToken = null
  localStorage.removeItem('sessionToken')
  closeSettings()
})

// Close
elSettingsClose.addEventListener('click', closeSettings)
elSettingsOverlay.addEventListener('click', e => { if (e.target === elSettingsOverlay) closeSettings() })
elSettingsBtn.addEventListener('click', openSettings)

// Add app
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
    refreshSettingsApps()
  }
})
