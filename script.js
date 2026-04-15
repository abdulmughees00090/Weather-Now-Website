// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  STATE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const STATE = {
  lat: null, lon: null,
  unit: 'C',
  locationName: '',
  weather: null,
  forecast: null,
  hourly: null,
  aqi: null,
  hourlyChart: null,
  skyCondition: 'clear',
  scrubberData: null,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  ENHANCED CANVAS SKY — full dynamic sky simulation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const canvas = document.getElementById('sky-canvas');
const ctx = canvas.getContext('2d');
let W, H, animFrame;
const stars = [];

// Cloud objects for smooth animation
const CLOUDS = [
  { xFrac: 0.08, y: 0.12, scale: 1.5, speed: 0.000012, opacity: 1 },
  { xFrac: 0.38, y: 0.07, scale: 1.1, speed: 0.000009, opacity: 0.85 },
  { xFrac: 0.62, y: 0.16, scale: 1.3, speed: 0.000011, opacity: 0.9 },
  { xFrac: 0.82, y: 0.09, scale: 0.9, speed: 0.000008, opacity: 0.75 },
  { xFrac: 0.22, y: 0.22, scale: 0.7, speed: 0.000013, opacity: 0.65 },
];

function resizeCanvas() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
  initStars();
}
window.addEventListener('resize', () => { clearTimeout(window._resizeT); window._resizeT = setTimeout(resizeCanvas, 150); });
resizeCanvas();

// ── TIME-OF-DAY GRADIENT ENGINE ──
// Returns interpolated sky stop colors based on fractional hour
function getSkyForTime(hourFrac, cond) {
  // Sky gradient definitions: [top, mid, bottom]
  const PALETTES = {
    night:     ['#010208', '#050812', '#080e1e'],
    predawn:   ['#050418', '#1a0e30', '#2a1545'],
    dawn:      ['#0c0820', '#3b1c50', '#d4421a'],
    sunrise:   ['#0d0b1e', '#7a2c60', '#f07030'],
    morning:   ['#0a1628', '#1b3d6e', '#3579b8'],
    midday:    ['#0b1c38', '#1755a0', '#2c83d4'],
    afternoon: ['#0d2040', '#1b5aaa', '#2875c8'],
    golden:    ['#090c1a', '#2e1845', '#e85c18'],
    sunset:    ['#07091a', '#2a0e38', '#c03010'],
    dusk:      ['#040610', '#12103a', '#3a1255'],
    earlynight:['#030508', '#080c22', '#0f1535'],
  };

  // Hour fraction (0–24) to palette key
  function getPalette(h) {
    if (h < 4)   return PALETTES.night;
    if (h < 5)   return PALETTES.predawn;
    if (h < 6)   return PALETTES.dawn;
    if (h < 7.5) return PALETTES.sunrise;
    if (h < 10)  return PALETTES.morning;
    if (h < 13)  return PALETTES.midday;
    if (h < 16.5)return PALETTES.afternoon;
    if (h < 18)  return PALETTES.golden;
    if (h < 19.5)return PALETTES.sunset;
    if (h < 21)  return PALETTES.dusk;
    if (h < 22)  return PALETTES.earlynight;
    return PALETTES.night;
  }

  // Override for storm/fog
  if (cond === 'storm') return ['#07060e', '#141028', '#201540'];
  if (cond === 'fog')   return ['#151820', '#22252e', '#2e3138'];

  // Smooth blend between adjacent palette steps
  const h = hourFrac;
  const steps = [0, 4, 5, 6, 7.5, 10, 13, 16.5, 18, 19.5, 21, 22, 24];
  let lo = steps[0], hi = steps[1];
  for (let i = 0; i < steps.length - 1; i++) {
    if (h >= steps[i] && h < steps[i + 1]) { lo = steps[i]; hi = steps[i + 1]; break; }
  }
  const t = (h - lo) / (hi - lo);
  const p1 = getPalette(lo + 0.01);
  const p2 = getPalette(hi - 0.01);
  return p1.map((c, i) => lerpColor(c, p2[i], t));
}

// Hex color lerp
function lerpColor(a, b, t) {
  const ah = a.replace('#',''), bh = b.replace('#','');
  const ar = parseInt(ah.slice(0,2),16), ag = parseInt(ah.slice(2,4),16), ab = parseInt(ah.slice(4,6),16);
  const br = parseInt(bh.slice(0,2),16), bg = parseInt(bh.slice(2,4),16), bb = parseInt(bh.slice(4,6),16);
  const rr = Math.round(ar + (br-ar)*t), rg = Math.round(ag + (bg-ag)*t), rb = Math.round(ab + (bb-ab)*t);
  return '#' + [rr,rg,rb].map(v => v.toString(16).padStart(2,'0')).join('');
}

function updateSkyColors(hourFrac) {
  const [t, m, b] = getSkyForTime(hourFrac, STATE.skyCondition);
  document.documentElement.style.setProperty('--sky-top', t);
  document.documentElement.style.setProperty('--sky-mid', m);
  document.documentElement.style.setProperty('--sky-bot', b);
}

// ── CELESTIAL BODY (sun/moon) drawn on canvas ──
function drawCelestial(ts, hourFrac) {
  const h = hourFrac;
  const cond = STATE.skyCondition;
  const isNight = h < 6 || h >= 20;

  if (!isNight) {
    // Sun arc: rises from left (6am) to peak at noon, sets right (19pm)
    const dayProgress = Math.max(0, Math.min(1, (h - 6) / 13));
    const angle = Math.PI * dayProgress;
    // Parabolic path
    const sunX = 0.08 * W + (0.84 * W) * dayProgress;
    const sunY = H * 0.65 - Math.sin(angle) * H * 0.52;

    // Sun glow halo (outer)
    const haloRadius = 80;
    const halo = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, haloRadius);
    const isGolden = (h > 17 || h < 8);
    const sunCore = isGolden ? 'rgba(255,190,80,0.18)' : 'rgba(255,235,160,0.12)';
    halo.addColorStop(0, isGolden ? 'rgba(255,190,80,0.35)' : 'rgba(255,250,200,0.25)');
    halo.addColorStop(0.4, sunCore);
    halo.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(sunX, sunY, haloRadius, 0, Math.PI * 2); ctx.fill();

    // Sun disc
    const sunColor = isGolden ? '#ffb340' : '#ffe87a';
    ctx.beginPath(); ctx.arc(sunX, sunY, 18, 0, Math.PI * 2);
    ctx.fillStyle = sunColor; ctx.fill();
    // Sun inner highlight
    ctx.beginPath(); ctx.arc(sunX - 4, sunY - 4, 7, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fill();
  } else {
    // Moon
    const nightProgress = h >= 20 ? (h - 20) / 10 : (h + 4) / 10;
    const moonX = 0.1 * W + 0.8 * W * nightProgress;
    const moonY = H * 0.55 - Math.sin(Math.PI * nightProgress) * H * 0.38;

    // Moon glow
    const moonHalo = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, 60);
    moonHalo.addColorStop(0, 'rgba(180,210,255,0.18)');
    moonHalo.addColorStop(1, 'rgba(150,180,255,0)');
    ctx.fillStyle = moonHalo;
    ctx.beginPath(); ctx.arc(moonX, moonY, 60, 0, Math.PI * 2); ctx.fill();

    // Moon crescent disc
    ctx.beginPath(); ctx.arc(moonX, moonY, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#d0e4ff'; ctx.fill();
    // Crescent shadow
    ctx.beginPath(); ctx.arc(moonX + 6, moonY - 2, 12, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fill();
  }
}

// ── CLOUD DRAWING ──
function drawCloud(cx, cy, r, alpha, ctx) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.2);
  g.addColorStop(0, `rgba(255,255,255,${alpha * 0.85})`);
  g.addColorStop(0.5, `rgba(240,245,255,${alpha * 0.45})`);
  g.addColorStop(1, `rgba(220,230,255,0)`);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(cx, cy, r * 2.0, r, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx - r * 0.65, cy + r * 0.4, r * 1.4, r * 0.85, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + r * 0.65, cy + r * 0.3, r * 1.5, r * 0.75, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + r * 0.1, cy - r * 0.4, r * 1.2, r * 0.9, 0, 0, Math.PI * 2); ctx.fill();
}

function drawClouds(ts, opacity) {
  const cond = STATE.skyCondition;
  CLOUDS.forEach((c, i) => {
    const drift = ((ts * c.speed + i * 0.25) % 1.3) - 0.15;
    const cx = (c.xFrac + drift) * W;
    const cy = c.y * H;
    const r = 45 * c.scale * (W / 1200);
    let cloudAlpha = c.opacity * opacity;
    if (cond === 'overcast') cloudAlpha = Math.min(1, cloudAlpha * 1.8);
    else if (cond === 'cloudy') cloudAlpha = Math.min(0.7, cloudAlpha * 1.3);
    else if (cond === 'storm') cloudAlpha = Math.min(0.5, cloudAlpha * 1.1);
    drawCloud(cx, cy, r, cloudAlpha, ctx);
  });
  // Extra dark storm clouds
  if (cond === 'storm') {
    const stormClouds = [
      { xf: 0.3, y: 0.08, r: 70 },
      { xf: 0.65, y: 0.05, r: 80 },
    ];
    stormClouds.forEach((c, i) => {
      const drift = ((ts * 0.000007 + i * 0.4) % 1.2) - 0.1;
      const cx = (c.xf + drift) * W;
      const cy = c.y * H;
      const gd = ctx.createRadialGradient(cx, cy, 0, cx, cy, c.r * 2);
      gd.addColorStop(0, 'rgba(50,45,70,0.7)');
      gd.addColorStop(1, 'rgba(30,25,50,0)');
      ctx.fillStyle = gd;
      ctx.beginPath(); ctx.ellipse(cx, cy, c.r * 2.2, c.r, 0, 0, Math.PI * 2); ctx.fill();
    });
  }
}

// ── FOG LAYER ──
function drawFog(ts) {
  const fogAlpha = 0.12 + 0.06 * Math.sin(ts / 6000);
  const g = ctx.createLinearGradient(0, H * 0.5, 0, H);
  g.addColorStop(0, `rgba(200,210,220,${fogAlpha})`);
  g.addColorStop(1, `rgba(190,200,215,${fogAlpha * 1.5})`);
  ctx.fillStyle = g; ctx.fillRect(0, H * 0.4, W, H * 0.6);
}

// ── LIGHTNING ──
let lightningTimer = 0;
let lightningActive = false;
function maybeLightning(ts) {
  if (STATE.skyCondition !== 'storm') return;
  if (ts > lightningTimer) {
    lightningTimer = ts + 3000 + Math.random() * 8000;
    lightningActive = true;
    setTimeout(() => { lightningActive = false; }, 120);
  }
  if (lightningActive) {
    ctx.fillStyle = 'rgba(200,220,255,0.04)';
    ctx.fillRect(0, 0, W, H);
  }
}

// ── MAIN DRAW ──
function drawSky(ts) {
  const now = new Date();
  const hourFrac = now.getHours() + now.getMinutes() / 60;
  const cond = STATE.skyCondition;

  // Background gradient
  const [topC, midC, botC] = getSkyForTime(hourFrac, cond);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, topC);
  g.addColorStop(0.55, midC);
  g.addColorStop(1, botC);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // Stars (night + twilight)
  const starOpacity = hourFrac < 6.5 ? 1 : (hourFrac > 19.5 ? 1 : (hourFrac > 18 ? (hourFrac - 18) / 1.5 : 0));
  if (starOpacity > 0.01) {
    stars.forEach(s => {
      const alpha = starOpacity * (0.2 + 0.8 * Math.abs(Math.sin(ts / 1000 * s.speed + s.phase)));
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${alpha * 0.85})`;
      ctx.fill();
    });
  }

  // Celestial body
  if (cond !== 'overcast' && cond !== 'fog') {
    drawCelestial(ts, hourFrac);
  }

  // Clouds
  const needsClouds = ['cloudy','overcast','rain','snow','storm','fog'].includes(cond);
  const lightClouds = cond === 'clear' || cond === '';
  if (needsClouds) drawClouds(ts, 1.0);
  else if (lightClouds) drawClouds(ts, 0.08);

  // Fog overlay
  if (cond === 'fog') drawFog(ts);

  // Lightning
  maybeLightning(ts);

  // Atmospheric ground haze
  if (hourFrac > 6 && hourFrac < 20 && cond !== 'storm') {
    const haze = ctx.createLinearGradient(0, H * 0.72, 0, H);
    haze.addColorStop(0, 'rgba(255,200,120,0)');
    haze.addColorStop(1, 'rgba(200,140,80,0.06)');
    ctx.fillStyle = haze; ctx.fillRect(0, H * 0.72, W, H * 0.28);
  }

  // Update CSS vars smoothly — throttled to once per second
  if (!drawSky._lastColorUpdate || ts - drawSky._lastColorUpdate > 1000) {
    updateSkyColors(hourFrac);
    drawSky._lastColorUpdate = ts;
  }

  animFrame = requestAnimationFrame(drawSky);
}

function initStars() {
  stars.length = 0;
  const count = Math.min(220, Math.floor(W * H / 6000));
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H * 0.72,
      r: Math.random() * 1.4 + 0.2,
      speed: Math.random() * 0.4 + 0.15,
      phase: Math.random() * Math.PI * 2,
    });
  }
}
initStars();
animFrame = requestAnimationFrame(drawSky);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  PARTICLES (rain / snow)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function clearParticles() { document.getElementById('particles').innerHTML = ''; }

function spawnRain(count = 90) {
  clearParticles();
  const p = document.getElementById('particles');
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'particle';
    const size = Math.random() * 1.2 + 0.4;
    el.style.cssText = `
      left:${Math.random() * 115 - 5}%;
      width:${size}px; height:${12 + Math.random() * 22}px;
      background:rgba(140,210,255,${0.15 + Math.random() * 0.3});
      border-radius:1px;
      animation-duration:${0.55 + Math.random() * 0.55}s;
      animation-delay:${Math.random() * 2}s;
      --drift:${(Math.random() - 0.5) * 30}px;
    `;
    p.appendChild(el);
  }
}

function spawnSnow(count = 65) {
  clearParticles();
  const p = document.getElementById('particles');
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'particle';
    const size = Math.random() * 4.5 + 1.5;
    el.style.cssText = `
      left:${Math.random() * 115 - 5}%;
      width:${size}px; height:${size}px;
      background:rgba(225,242,255,${0.4 + Math.random() * 0.4});
      animation-duration:${3 + Math.random() * 4.5}s;
      animation-delay:${Math.random() * 4}s;
      --drift:${(Math.random() - 0.5) * 90}px;
    `;
    p.appendChild(el);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  LIFESTYLE ICON SYSTEM — SVG-based refined icons
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const LIFESTYLE_ICONS = {
  clothing: (color) => `<svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 4H18L22 9L18 11V24H10V11L6 9L10 4Z" stroke="${color}" stroke-width="1.8" stroke-linejoin="round" fill="${color}22"/>
    <path d="M10 4C10 4 12 7 14 7C16 7 18 4 18 4" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>
  </svg>`,

  hydration: (color) => `<svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 4C14 4 7 13 7 17.5C7 21.09 10.13 24 14 24C17.87 24 21 21.09 21 17.5C21 13 14 4 14 4Z" stroke="${color}" stroke-width="1.8" fill="${color}22"/>
    <path d="M11 19.5C11 19.5 11 22 14 22" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>
  </svg>`,

  breathing: (color) => `<svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="11" cy="14" rx="4" ry="7" stroke="${color}" stroke-width="1.8" fill="${color}22"/>
    <ellipse cx="17" cy="14" rx="4" ry="7" stroke="${color}" stroke-width="1.8" fill="${color}22"/>
    <path d="M11 14H17" stroke="${color}" stroke-width="1.8"/>
    <path d="M14 7V4M14 24V21" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,

  besttime: (color) => `<svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="14" cy="14" r="9" stroke="${color}" stroke-width="1.8" fill="${color}22"/>
    <path d="M14 9V14L17.5 16.5" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M6 14H4M24 14H22M14 4V6M14 22V24" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,
};

function upgradeLifestyleIcons() {
  const icons = [
    { id: 'clothing-icon',  key: 'clothing',  color: '#38d9ff' },
    { id: 'hydration-icon', key: 'hydration', color: '#5de4ff' },
    { id: 'breathing-icon', key: 'breathing', color: '#7ecbff' },
    { id: 'besttime-icon',  key: 'besttime',  color: '#ffb347' },
  ];
  icons.forEach(({ id, key, color }) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = LIFESTYLE_ICONS[key](color);
    el.style.fontSize = '0';
    el.style.width = '52px';
    el.style.height = '52px';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.borderRadius = '16px';
    el.style.background = `${color}18`;
    el.style.border = `1px solid ${color}30`;
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  GEOCODING (Nominatim)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`;
  const r = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  return r.json();
}
async function reverseGeocode(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
    const r = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    const d = await r.json();
    return d.address?.city || d.address?.town || d.address?.village || d.address?.county || d.display_name.split(',')[0];
  } catch { return 'Your Location'; }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  WEATHER (Open-Meteo)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function fetchWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
    + `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,`
    + `surface_pressure,wind_speed_10m,wind_direction_10m,cloud_cover,visibility,uv_index`
    + `&hourly=temperature_2m,precipitation_probability,wind_speed_10m,relative_humidity_2m,cloud_cover,`
    + `dew_point_2m,uv_index`
    + `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max,uv_index_max`
    + `&timezone=auto&forecast_days=7`;
  const r = await fetch(url);
  return r.json();
}
async function fetchAQI(lat, lon) {
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}`
    + `&current=pm10,pm2_5,nitrogen_dioxide,ozone,european_aqi&timezone=auto`;
  const r = await fetch(url);
  return r.json();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  WMO CODES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const WMO = {
  0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',
  45:'Fog',48:'Freezing fog',
  51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',
  61:'Slight rain',63:'Rain',65:'Heavy rain',
  71:'Slight snow',73:'Snow',75:'Heavy snow',77:'Snow grains',
  80:'Slight showers',81:'Showers',82:'Heavy showers',
  85:'Slight snow showers',86:'Snow showers',
  95:'Thunderstorm',96:'Thunderstorm w/ hail',99:'Thunderstorm w/ heavy hail',
};
const WMO_ICON_DAY = {
  0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',
  51:'🌦️',53:'🌧️',55:'🌧️',61:'🌦️',63:'🌧️',65:'⛈️',
  71:'🌨️',73:'❄️',75:'❄️',77:'🌨️',80:'🌦️',81:'🌧️',82:'⛈️',
  85:'🌨️',86:'🌨️',95:'⛈️',96:'⛈️',99:'⛈️',
};
const WMO_ICON_NIGHT = {
  0:'🌙',1:'🌤️',2:'☁️',3:'☁️',45:'🌫️',48:'🌫️',
  51:'🌦️',53:'🌧️',55:'🌧️',61:'🌦️',63:'🌧️',65:'⛈️',
  71:'🌨️',73:'❄️',75:'❄️',77:'🌨️',80:'🌦️',81:'🌧️',82:'⛈️',
  85:'🌨️',86:'🌨️',95:'⛈️',96:'⛈️',99:'⛈️',
};

function getWeatherIcon(code, sunriseISO, sunsetISO) {
  const now = new Date();
  const sunrise = new Date(sunriseISO);
  const sunset = new Date(sunsetISO);
  const isNight = now < sunrise || now > sunset;
  if (isNight && WMO_ICON_NIGHT[code]) return WMO_ICON_NIGHT[code];
  return WMO_ICON_DAY[code] || '🌡️';
}

function wmoToSkyCondition(code) {
  if ([0, 1].includes(code)) return 'clear';
  if ([2, 3].includes(code)) return code === 3 ? 'overcast' : 'cloudy';
  if ([45, 48].includes(code)) return 'fog';
  if (code >= 51 && code <= 82) return 'rain';
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 95) return 'storm';
  return 'clear';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  TEMPERATURE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function toUnit(c) { return STATE.unit === 'F' ? Math.round(c * 9 / 5 + 32) : Math.round(c); }
function unitLabel() { return STATE.unit === 'F' ? '°F' : '°C'; }

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  WIND
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function degToCardinal(d) {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(d / 22.5) % 16];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  UV
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function uvLabel(v) {
  if (v <= 2) return 'Low';
  if (v <= 5) return 'Moderate';
  if (v <= 7) return 'High';
  if (v <= 10) return 'Very High';
  return 'Extreme';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  AQI
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function aqiCategory(v) {
  if (v <= 50)  return { label: 'Good', color: '#00e400' };
  if (v <= 100) return { label: 'Moderate', color: '#ffff00' };
  if (v <= 150) return { label: 'Unhealthy for Sensitive Groups', color: '#ff7e00' };
  if (v <= 200) return { label: 'Unhealthy', color: '#ff0000' };
  if (v <= 300) return { label: 'Very Unhealthy', color: '#8f3f97' };
  return { label: 'Hazardous', color: '#7e0023' };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  MOOD ENGINE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function getMood(code, temp, hour) {
  if (code === 0 && temp > 20 && hour >= 16 && hour <= 20) return { emoji: '🌅', text: 'Perfect golden hour. A walk would feel magical right now.' };
  if (code === 0 && temp > 25) return { emoji: '☀️', text: 'Blazing and beautiful. Sunscreen is your best friend today.' };
  if (code === 0 && temp > 15 && temp <= 25) return { emoji: '😊', text: 'Ideal conditions. Step outside — the air feels alive.' };
  if (code === 0 && temp <= 15) return { emoji: '🔥', text: 'Crisp and clear. Perfect for a brisk morning run.' };
  if ([1, 2].includes(code)) return { emoji: '🌤️', text: 'Gentle clouds softening the sun. A breezy, easy kind of day.' };
  if (code === 3) return { emoji: '☁️', text: 'A blanket of clouds overhead. Cozy indoor vibes or a contemplative stroll.' };
  if ([45, 48].includes(code)) return { emoji: '🌫️', text: 'The world is hushed and mysterious. Drive carefully out there.' };
  if (code >= 51 && code <= 55) return { emoji: '🌦️', text: 'A light drizzle refreshes the air. Perfect for coffee and a window seat.' };
  if (code >= 61 && code <= 65) return { emoji: '🌧️', text: 'Rain is rewriting the streets. Grab an umbrella before heading out.' };
  if (code >= 71 && code <= 77) return { emoji: '❄️', text: 'Snow is painting the world white. Dress in layers and tread carefully.' };
  if (code >= 80 && code <= 82) return { emoji: '🌦️', text: 'Scattered showers keep things interesting. Weather may change quickly.' };
  if (code >= 95) return { emoji: '⛈️', text: 'A storm is making its presence known. Stay safe and stay inside.' };
  return { emoji: '🌡️', text: 'Conditions are changing. Check back for updates.' };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  OUTDOOR SAFETY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function calcOutdoorScore(temp, uv, aqi, windKmh, precip, code) {
  let score = 100;
  const factors = [];
  if (temp > 38)      { score -= 25; factors.push('⚠️ Extreme heat'); }
  else if (temp > 32) { score -= 12; factors.push('☀️ High temperature'); }
  else if (temp < 0)  { score -= 20; factors.push('🥶 Freezing temperatures'); }
  else if (temp < 5)  { score -= 10; factors.push('🧤 Cold conditions'); }
  if (uv >= 11)       { score -= 20; factors.push('☢️ Extreme UV'); }
  else if (uv >= 8)   { score -= 12; factors.push('🔆 Very high UV'); }
  else if (uv >= 6)   { score -= 6;  factors.push('🌞 High UV'); }
  if (aqi > 200)      { score -= 25; factors.push('🚫 Very unhealthy air'); }
  else if (aqi > 150) { score -= 15; factors.push('😷 Unhealthy air'); }
  else if (aqi > 100) { score -= 8;  factors.push('😐 Moderate air quality'); }
  if (windKmh > 60)   { score -= 15; factors.push('💨 Storm-force winds'); }
  else if (windKmh > 40) { score -= 8; factors.push('🌬️ Strong winds'); }
  if (code >= 95)     { score -= 20; factors.push('⛈️ Thunderstorm'); }
  else if (precip > 5){ score -= 12; factors.push('🌧️ Heavy rain'); }
  else if (precip > 0){ score -= 5;  factors.push('🌦️ Some precipitation'); }
  return { score: Math.max(0, Math.min(100, score)), factors };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  LIFESTYLE TEXT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function getClothingSuggestion(temp, wind, humidity) {
  const wc = Math.round(temp - 0.3 * (wind ** 0.5) * 1.3);
  if (wc > 30) return { text: 'Light breathable fabrics — shorts and a tee. Stay cool and hydrated.', score: 90 };
  if (wc > 22) return { text: 'T-shirt weather with light trousers or a summer dress.', score: 75 };
  if (wc > 15) return { text: 'A light jacket or sweater should do. Layers are your friend.', score: 60 };
  if (wc > 5)  return { text: "Warm jacket, scarf, and closed shoes. Don't underestimate the wind.", score: 40 };
  return { text: 'Full winter gear — coat, gloves, hat. Every layer counts.', score: 20 };
}
function getHydration(temp, humidity, uv) {
  if (temp > 32 || uv > 8) return { text: 'Critical: Drink 500ml+ per hour if active outdoors. Heat risk is significant.', score: 95 };
  if (temp > 26 || humidity > 75) return { text: 'High heat or humidity — increase your fluid intake significantly today.', score: 75 };
  if (temp > 20) return { text: 'Warm conditions — keep a water bottle with you throughout the day.', score: 55 };
  return { text: 'Standard hydration: 2–3L daily is sufficient in these conditions.', score: 35 };
}
function getBreathing(aqi, humidity, code) {
  if (aqi > 200 || code >= 95) return { text: 'Outdoor activity not recommended. Sensitive groups should stay indoors.', score: 10 };
  if (aqi > 150) return { text: 'Limit prolonged outdoor exertion. Consider wearing a mask outside.', score: 30 };
  if (aqi > 100 || humidity > 85) return { text: 'Moderate concerns. Those with respiratory conditions should take care.', score: 50 };
  if (aqi <= 50 && humidity < 70) return { text: "Air quality is excellent. Deep breaths welcome — it's refreshing out there.", score: 95 };
  return { text: 'Good air quality. No concerns for most people today.', score: 75 };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  BEST TIME OUTSIDE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function getBestTime(hourly) {
  if (!hourly || !hourly.temperature_2m) return { text: 'Data unavailable.', score: 50 };
  const now = new Date().getHours();
  let bestHour = now, bestScore = -Infinity;
  for (let i = now; i < Math.min(now + 12, hourly.temperature_2m.length); i++) {
    const t = hourly.temperature_2m[i];
    const p = hourly.precipitation_probability[i] ?? 0;
    const uv = hourly.uv_index ? hourly.uv_index[i] : 0;
    const s = (100 - p * 0.8) - Math.abs(t - 22) * 1.5 - (uv > 7 ? (uv - 7) * 3 : 0);
    if (s > bestScore) { bestScore = s; bestHour = i; }
  }
  const hour = bestHour % 24;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;
  return { text: `Optimal window around ${h}:00 ${ampm}. Moderate conditions expected.`, score: Math.min(100, 50 + bestScore / 2) };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  NEXT 3 HOURS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function buildThreeHourInsight(hourly, currentIdx) {
  const next3 = [0, 1, 2].map(i => currentIdx + i).filter(i => i < hourly.temperature_2m.length);
  if (!next3.length) return { text: 'Hourly data unavailable.', chips: [] };
  const temps = next3.map(i => hourly.temperature_2m[i]);
  const precips = next3.map(i => hourly.precipitation_probability[i]);
  const winds = next3.map(i => hourly.wind_speed_10m[i]);
  const maxPrec = Math.max(...precips);
  const tempTrend = temps[temps.length - 1] - temps[0];
  const maxWind = Math.max(...winds);
  let text = '';
  const chips = [];
  if (maxPrec > 60) {
    text = `Rain is highly likely in the next few hours (${maxPrec}% chance). Keep an umbrella at hand.`;
    chips.push('🌧️ High rain chance');
  } else if (maxPrec > 30) {
    text = `There's a moderate chance of rain (${maxPrec}%). You might want to carry a light jacket.`;
    chips.push('🌦️ Some rain possible');
  } else {
    text = `Conditions look ${maxPrec < 10 ? 'dry and stable' : 'mostly dry'} for the next 3 hours.`;
    chips.push('✅ Low rain risk');
  }
  if (Math.abs(tempTrend) > 2) {
    const dir = tempTrend > 0 ? 'rising' : 'dropping';
    chips.push(`🌡️ Temp ${dir} ${Math.abs(tempTrend.toFixed(1))}°`);
  }
  if (maxWind > 40) chips.push(`💨 Strong winds ${maxWind.toFixed(0)} km/h`);
  return { text, chips };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  SUN ARC UPDATE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function updateSunArc(sunriseISO, sunsetISO) {
  const now = new Date();
  const sunrise = new Date(sunriseISO);
  const sunset = new Date(sunsetISO);
  const isNight = now < sunrise || now > sunset;

  let t;
  if (!isNight) {
    t = Math.max(0, Math.min(1, (now - sunrise) / (sunset - sunrise)));
  } else {
    t = 0;
  }

  // Quadratic bezier position along arc
  const ax = 10, ay = 75, bx = 100, by = 5, cx = 190, cy = 75;
  const px = (1 - t) ** 2 * ax + 2 * (1 - t) * t * bx + t ** 2 * cx;
  const py = (1 - t) ** 2 * ay + 2 * (1 - t) * t * by + t ** 2 * cy;

  const el = document.getElementById('sun-pos');
  if (el) {
    el.setAttribute('cx', px.toFixed(1));
    el.setAttribute('cy', py.toFixed(1));
    // Night mode: switch to moon style
    if (isNight) {
      el.setAttribute('r', '7');
      el.setAttribute('fill', '#c8d8ff');
      el.setAttribute('filter', 'url(#moonGlow)');
    } else {
      el.setAttribute('r', '9');
      el.setAttribute('fill', '#ffd740');
      el.setAttribute('filter', 'url(#sunGlow)');
    }
  }

  // Format times
  const fmt = d => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  document.getElementById('sunrise-time').textContent = fmt(sunrise);
  document.getElementById('sunset-time').textContent = fmt(sunset);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  HOURLY CHART
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function buildHourlyChart(hourly) {
  const now = new Date();
  const currentIdx = now.getHours();
  const start = currentIdx;
  const end = Math.min(start + 24, hourly.temperature_2m.length);
  const labels = hourly.time.slice(start, end).map(t => {
    const d = new Date(t);
    return d.getHours() + ':00';
  });
  const temps = hourly.temperature_2m.slice(start, end).map(toUnit);
  const precips = hourly.precipitation_probability.slice(start, end);

  if (STATE.hourlyChart) { STATE.hourlyChart.destroy(); STATE.hourlyChart = null; }

  const chartCtx = document.getElementById('hourly-chart').getContext('2d');
  STATE.hourlyChart = new Chart(chartCtx, {
    data: {
      labels,
      datasets: [
        {
          type: 'line',
          label: 'Temp',
          data: temps,
          borderColor: 'rgba(56,217,255,0.85)',
          backgroundColor: 'rgba(56,217,255,0.06)',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: 'rgba(56,217,255,0.9)',
          tension: 0.4,
          fill: true,
          yAxisID: 'y',
        },
        {
          type: 'bar',
          label: 'Precip',
          data: precips,
          backgroundColor: 'rgba(126,203,255,0.18)',
          borderColor: 'rgba(126,203,255,0.3)',
          borderWidth: 1,
          borderRadius: 3,
          yAxisID: 'y1',
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(10,14,28,0.92)',
          borderColor: 'rgba(56,217,255,0.3)', borderWidth: 1,
          titleFont: { family: 'JetBrains Mono, DM Mono', size: 11 },
          bodyFont:  { family: 'JetBrains Mono, DM Mono', size: 11 },
          padding: 10, cornerRadius: 10,
          callbacks: {
            label: ctx => ctx.dataset.label === 'Temp'
              ? ` ${ctx.parsed.y}${unitLabel()}`
              : ` ${ctx.parsed.y}% precip`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: 'rgba(220,230,255,0.4)', font: { family: 'JetBrains Mono, DM Mono', size: 10 } },
        },
        y: {
          position: 'left',
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: 'rgba(220,230,255,0.4)', font: { family: 'JetBrains Mono, DM Mono', size: 10 }, callback: v => `${v}${unitLabel()}` },
        },
        y1: {
          position: 'right', min: 0, max: 100,
          grid: { display: false },
          ticks: { color: 'rgba(126,203,255,0.4)', font: { family: 'JetBrains Mono, DM Mono', size: 10 }, callback: v => `${v}%` },
        },
      },
    },
  });
  return currentIdx;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  RENDER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function render(w, aqiData) {
  const curr = w.current;
  const hourly = w.hourly;
  const daily = w.daily;
  const code = curr.weather_code;

  STATE.skyCondition = wmoToSkyCondition(code);
  clearParticles();
  if (['rain'].includes(STATE.skyCondition)) spawnRain();
  if (STATE.skyCondition === 'storm') spawnRain(130);
  if (STATE.skyCondition === 'snow') spawnSnow();

  const temp = curr.temperature_2m;
  document.getElementById('hero-temp').textContent = toUnit(temp);
  document.getElementById('hero-unit').textContent = unitLabel();
  document.getElementById('hero-condition').textContent = WMO[code] || 'Unknown';

  const weatherIcon = getWeatherIcon(code, daily.sunrise[0], daily.sunset[0]);
  document.getElementById('hero-icon').textContent = weatherIcon;

  document.getElementById('loc-name').textContent = STATE.locationName;
  document.getElementById('feels-like').textContent = `${toUnit(curr.apparent_temperature)}${unitLabel()}`;
  document.getElementById('humidity').textContent = `${curr.relative_humidity_2m}%`;
  document.getElementById('pressure').textContent = `${curr.surface_pressure?.toFixed(0)} hPa`;
  document.getElementById('visibility').textContent = curr.visibility != null ? `${(curr.visibility / 1000).toFixed(1)} km` : '—';
  document.getElementById('cloudcover').textContent = `${curr.cloud_cover}%`;

  const uv = curr.uv_index ?? 0;
  document.getElementById('uv-value').textContent = uv.toFixed(1);
  document.getElementById('uv-label').textContent = uvLabel(uv);
  document.getElementById('precip-value').textContent = (curr.precipitation ?? 0).toFixed(1);
  const nowIdx = new Date().getHours();
  const dp = hourly.dew_point_2m?.[nowIdx] ?? '—';
  document.getElementById('dewpoint-value').textContent = dp !== '—' ? toUnit(dp) : '—';
  document.getElementById('dewpoint-unit').textContent = unitLabel();
  document.getElementById('surfpressure-value').textContent = (curr.surface_pressure ?? 0).toFixed(0);

  const windDeg = curr.wind_direction_10m ?? 0;
  const windKmh = curr.wind_speed_10m ?? 0;
  document.getElementById('wind-arrow').style.transform = `rotate(${windDeg}deg)`;
  document.getElementById('wind-speed').textContent = `${Math.round(windKmh)} km/h`;
  document.getElementById('wind-dir-text').textContent = degToCardinal(windDeg);

  const aqiVal = aqiData?.current?.european_aqi ?? 0;
  const uvFrac = Math.min(uv / 12, 1);
  const aqiFrac = Math.min(aqiVal / 300, 1);
  const C = 201.06;
  document.getElementById('uv-arc').style.strokeDashoffset = (C - uvFrac * C).toFixed(2);
  document.getElementById('uv-arc-val').textContent = uv.toFixed(1);
  document.getElementById('uv-cat').textContent = uvLabel(uv);
  document.getElementById('aqi-arc').style.strokeDashoffset = (C - aqiFrac * C).toFixed(2);
  document.getElementById('aqi-val').textContent = aqiVal;
  const aqiCat = aqiCategory(aqiVal);
  document.getElementById('aqi-arc').style.stroke = aqiCat.color;
  document.getElementById('aqi-cat').textContent = aqiCat.label;

  const mood = getMood(code, temp, new Date().getHours());
  document.getElementById('mood-emoji').textContent = mood.emoji;
  document.getElementById('mood-text').textContent = mood.text;

  updateSunArc(daily.sunrise[0], daily.sunset[0]);

  const currentIdx = buildHourlyChart(hourly);

  STATE.scrubberData = hourly;
  const sc = document.getElementById('time-scrubber');
  sc.value = currentIdx;
  updateScrubber(currentIdx);

  // 7-day forecast
  const fg = document.getElementById('forecast-grid');
  fg.innerHTML = '';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  daily.time.slice(0, 7).forEach((dateStr, i) => {
    const d = new Date(dateStr);
    const hi = toUnit(daily.temperature_2m_max[i]);
    const lo = toUnit(daily.temperature_2m_min[i]);
    const dcode = daily.weather_code[i];
    const precip = daily.precipitation_probability_max[i] ?? 0;
    const range = toUnit(daily.temperature_2m_max[0]) - toUnit(daily.temperature_2m_min[0]);
    const thiRange = hi - lo;
    const barW = range > 0 ? Math.min(100, thiRange / range * 100) : 50;
    const el = document.createElement('div');
    el.className = 'forecast-day';
    const forecastIcon = WMO_ICON_DAY[dcode] || '🌡️';
    el.innerHTML = `
      <div class="forecast-day-name">${i === 0 ? 'Today' : days[d.getDay()]}</div>
      <div class="forecast-day-icon">${forecastIcon}</div>
      <div class="forecast-day-high">${hi}${unitLabel()}</div>
      <div class="forecast-day-low">${lo}${unitLabel()}</div>
      <div class="forecast-day-bar"><div class="forecast-day-bar-fill" style="width:${barW}%"></div></div>
      <div class="forecast-precip">${precip > 0 ? precip + '%' : ''}</div>
    `;
    fg.appendChild(el);
  });

  // AQI section
  document.getElementById('aqi-big').textContent = aqiVal;
  document.getElementById('aqi-big-cat').textContent = aqiCat.label;
  document.getElementById('aqi-big').style.color = aqiCat.color;
  const indLeft = Math.min(95, Math.max(2, aqiVal / 300 * 100));
  document.getElementById('aqi-indicator').style.left = `${indLeft}%`;
  document.getElementById('pm25').textContent = (aqiData?.current?.pm2_5 ?? 0).toFixed(1) + ' µg/m³';
  document.getElementById('pm10').textContent = (aqiData?.current?.pm10 ?? 0).toFixed(1) + ' µg/m³';
  document.getElementById('no2').textContent = (aqiData?.current?.nitrogen_dioxide ?? 0).toFixed(1) + ' µg/m³';
  document.getElementById('o3').textContent = (aqiData?.current?.ozone ?? 0).toFixed(1) + ' µg/m³';

  // Outdoor score
  const { score: oss, factors } = calcOutdoorScore(temp, uv, aqiVal, windKmh, curr.precipitation ?? 0, code);
  const ossC = 314.16;
  document.getElementById('oss-arc').style.strokeDashoffset = (ossC - oss / 100 * ossC).toFixed(2);
  document.getElementById('oss-arc').style.stroke = oss > 70 ? '#38d9ff' : oss > 40 ? '#ffb347' : '#ff4455';
  document.getElementById('oss-val').textContent = oss;
  document.getElementById('oss-desc').textContent =
    oss >= 80 ? 'Excellent — ideal for outdoor activities' :
    oss >= 60 ? 'Good — minor concerns to be aware of' :
    oss >= 40 ? 'Moderate — exercise some caution' :
    oss >= 20 ? 'Poor — limit time outdoors' :
    'Dangerous — avoid going outside';
  document.getElementById('oss-factors').textContent =
    factors.length ? factors.join('  ·  ') : '✅ No significant hazards detected';

  // Lifestyle
  const clothing = getClothingSuggestion(temp, windKmh, curr.relative_humidity_2m);
  document.getElementById('clothing-text').textContent = clothing.text;
  setTimeout(() => document.getElementById('clothing-bar').style.width = clothing.score + '%', 500);

  const hydration = getHydration(temp, curr.relative_humidity_2m, uv);
  document.getElementById('hydration-text').textContent = hydration.text;
  setTimeout(() => document.getElementById('hydration-bar').style.width = hydration.score + '%', 600);

  const breathing = getBreathing(aqiVal, curr.relative_humidity_2m, code);
  document.getElementById('breathing-text').textContent = breathing.text;
  setTimeout(() => document.getElementById('breathing-bar').style.width = breathing.score + '%', 700);

  const besttime = getBestTime(hourly);
  document.getElementById('besttime-text').textContent = besttime.text;
  setTimeout(() => document.getElementById('besttime-bar').style.width = Math.min(100, besttime.score) + '%', 800);

  // Upgrade lifestyle icons after data is rendered
  setTimeout(upgradeLifestyleIcons, 50);

  const insight = buildThreeHourInsight(hourly, currentIdx);
  document.getElementById('three-hour-insight').textContent = insight.text;
  const chipsEl = document.getElementById('insight-chips');
  chipsEl.innerHTML = '';
  insight.chips.forEach(c => {
    const chip = document.createElement('div');
    chip.className = 'chip'; chip.textContent = c;
    chipsEl.appendChild(chip);
  });

  document.getElementById('last-updated').textContent = new Date().toLocaleTimeString();
}

function updateScrubber(idx) {
  const h = STATE.scrubberData;
  if (!h) return;
  const i = Math.min(idx, h.temperature_2m.length - 1);
  document.getElementById('sc-temp').textContent = `${toUnit(h.temperature_2m[i])}${unitLabel()}`;
  document.getElementById('sc-precip').textContent = `${h.precipitation_probability[i] ?? 0}%`;
  document.getElementById('sc-wind').textContent = `${Math.round(h.wind_speed_10m[i] ?? 0)} km/h`;
  document.getElementById('sc-hum').textContent = `${h.relative_humidity_2m[i] ?? 0}%`;
  document.getElementById('sc-cloud').textContent = `${h.cloud_cover[i] ?? 0}%`;
  const t = new Date(h.time[i]);
  const now = new Date();
  const diffH = Math.round((t - now) / 3600000);
  document.getElementById('sc-time-label').textContent =
    diffH === 0 ? 'Now' : diffH > 0 ? `+${diffH}h from now` : `${Math.abs(diffH)}h ago`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  SEARCH
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let acTimer;
const searchInput = document.getElementById('search-input');
const acList = document.getElementById('autocomplete-list');

searchInput.addEventListener('input', () => {
  clearTimeout(acTimer);
  const q = searchInput.value.trim();
  if (q.length < 2) { acList.classList.remove('show'); return; }
  acTimer = setTimeout(async () => {
    try {
      const results = await geocode(q);
      acList.innerHTML = '';
      results.slice(0, 5).forEach(r => {
        const d = document.createElement('div');
        d.className = 'ac-item';
        d.textContent = r.display_name;
        d.addEventListener('click', () => {
          searchInput.value = r.display_name.split(',').slice(0, 2).join(',');
          acList.classList.remove('show');
          STATE.lat = parseFloat(r.lat);
          STATE.lon = parseFloat(r.lon);
          STATE.locationName = r.display_name.split(',')[0];
          loadData();
        });
        acList.appendChild(d);
      });
      if (results.length) acList.classList.add('show');
    } catch {}
  }, 350);
});

document.addEventListener('click', e => {
  if (!e.target.closest('.search-wrap')) acList.classList.remove('show');
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  CONTROLS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
document.querySelectorAll('.unit-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    STATE.unit = btn.dataset.unit;
    document.querySelectorAll('.unit-btn').forEach(b => b.classList.toggle('active', b.dataset.unit === STATE.unit));
    if (STATE.weather) render(STATE.weather, STATE.aqi);
  });
});

document.getElementById('locate-btn').addEventListener('click', () => {
  toast('Locating you…');
  navigator.geolocation.getCurrentPosition(async pos => {
    STATE.lat = pos.coords.latitude;
    STATE.lon = pos.coords.longitude;
    STATE.locationName = await reverseGeocode(STATE.lat, STATE.lon);
    loadData();
  }, () => toast('Location access denied.'));
});

document.getElementById('refresh-btn').addEventListener('click', () => {
  if (STATE.lat) loadData();
  else toast('No location set yet.');
});

document.getElementById('time-scrubber').addEventListener('input', e => {
  updateScrubber(parseInt(e.target.value));
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  TOAST
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  CACHE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function cacheKey(lat, lon) { return `wn_${lat.toFixed(2)}_${lon.toFixed(2)}`; }
function getCached(key) {
  try {
    const s = sessionStorage.getItem(key);
    if (!s) return null;
    const d = JSON.parse(s);
    if (Date.now() - d.ts > 10 * 60 * 1000) return null;
    return d.data;
  } catch { return null; }
}
function setCache(key, data) {
  try { sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch {}
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  LOAD DATA
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function loadData() {
  document.getElementById('loader').classList.remove('hidden');
  document.getElementById('main-content').style.display = 'none';
  document.getElementById('error-state').classList.remove('show');

  try {
    const ck = cacheKey(STATE.lat, STATE.lon);
    let cached = getCached(ck);
    let w, aqi;

    if (cached) {
      w = cached.w; aqi = cached.aqi;
    } else {
      [w, aqi] = await Promise.all([
        fetchWeather(STATE.lat, STATE.lon),
        fetchAQI(STATE.lat, STATE.lon).catch(() => null),
      ]);
      setCache(ck, { w, aqi });
    }

    STATE.weather = w;
    STATE.aqi = aqi || { current: { european_aqi: 0, pm2_5: 0, pm10: 0, nitrogen_dioxide: 0, ozone: 0 } };

    render(w, STATE.aqi);

    document.getElementById('main-content').style.display = 'block';
    document.getElementById('loader').classList.add('hidden');
  } catch (e) {
    console.error(e);
    document.getElementById('loader').classList.add('hidden');
    document.getElementById('error-state').classList.add('show');
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  INIT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function initApp() {
  document.getElementById('error-state').classList.remove('show');

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      async pos => {
        STATE.lat = pos.coords.latitude;
        STATE.lon = pos.coords.longitude;
        STATE.locationName = await reverseGeocode(STATE.lat, STATE.lon);
        loadData();
      },
      async () => {
        STATE.lat = 51.5074; STATE.lon = -0.1278;
        STATE.locationName = 'London';
        loadData();
      },
      { timeout: 5000 }
    );
  } else {
    STATE.lat = 51.5074; STATE.lon = -0.1278;
    STATE.locationName = 'London';
    loadData();
  }
}

window.initApp = initApp;
initApp();

// Auto-refresh every 15 minutes
setInterval(() => { if (STATE.lat) loadData(); }, 15 * 60 * 1000);
