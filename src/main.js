// ============================================================
//  Index — main.js
// ============================================================

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
    document.getElementById('weatherCondition').textContent = WMO[code] ?? `Code ${code}`
    document.getElementById('weatherCity').textContent      = city
    document.getElementById('rainToday').textContent        = `${rainToday}mm`
    document.getElementById('feelsLike').textContent        = `${feels}°`

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
