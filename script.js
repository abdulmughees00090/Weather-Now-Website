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
//  CANVAS SKY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const canvas = document.getElementById('sky-canvas');
const ctx = canvas.getContext('2d');
let W, H, animFrame;
const stars = [];

function resizeCanvas() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function getSkyGradient() {
  const h = new Date().getHours();
  const cond = STATE.skyCondition;
  if (cond === 'storm') return [['#0a0814','#1a1030','#2a1050']];
  if (cond === 'fog')   return [['#1a1e2a','#2a2e3a','#3a3e4a']];
  if (h >= 5 && h < 7)   return [['#0d0c22','#3b2860','#e05c1a']];
  if (h >= 7 && h < 12)  return [['#0a1628','#1a3a5c','#2e6898']];
  if (h >= 12 && h < 17) return [['#0e1f3a','#174872','#2166a8']];
  if (h >= 17 && h < 20) return [['#0a0d1a','#311845','#e8520a']];
  return [['#03040a','#080d1a','#0f1528']];
}

function updateSkyColors() {
  const [[t,m,b]] = getSkyGradient();
  document.documentElement.style.setProperty('--sky-top', t);
  document.documentElement.style.setProperty('--sky-mid', m);
  document.documentElement.style.setProperty('--sky-bot', b);
}

function drawSky(ts) {
  const [[t,m,b]] = getSkyGradient();
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,t); g.addColorStop(0.5,m); g.addColorStop(1,b);
  ctx.fillStyle = g; ctx.fillRect(0,0,W,H);

  const h = new Date().getHours();
  if (h < 6 || h >= 20) {
    stars.forEach(s => {
      const alpha = 0.3 + 0.7*Math.abs(Math.sin(ts/1000*s.speed + s.phase));
      ctx.beginPath();
      ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
      ctx.fillStyle = `rgba(255,255,255,${alpha*0.8})`;
      ctx.fill();
    });
  }

  if (STATE.skyCondition === 'cloudy' || STATE.skyCondition === 'overcast') {
    ctx.globalAlpha = 0.04 + 0.02*Math.sin(ts/8000);
    drawClouds(ts);
    ctx.globalAlpha = 1;
  }

  animFrame = requestAnimationFrame(drawSky);
}

function drawClouds(ts) {
  const clouds = [{x:0.2,y:0.15,s:1.4},{x:0.55,y:0.1,s:1},{x:0.8,y:0.22,s:1.2}];
  clouds.forEach((c,i) => {
    const ox = (ts/15000 + i*0.3)%1.2 - 0.1;
    const cx = (c.x + ox) * W;
    const cy = c.y * H;
    const r = 60 * c.s;
    const g = ctx.createRadialGradient(cx,cy,0,cx,cy,r*2);
    g.addColorStop(0,'rgba(255,255,255,0.6)');
    g.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(cx,cy,r*2,r,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx-r*0.5,cy+r*0.3,r*1.3,r*0.8,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx+r*0.5,cy+r*0.2,r*1.4,r*0.7,0,0,Math.PI*2); ctx.fill();
  });
}

function initStars() {
  stars.length = 0;
  for (let i=0;i<180;i++) {
    stars.push({
      x: Math.random()*W,
      y: Math.random()*H*0.7,
      r: Math.random()*1.3+0.3,
      speed: Math.random()*0.5+0.2,
      phase: Math.random()*Math.PI*2,
    });
  }
}
initStars();
animFrame = requestAnimationFrame(drawSky);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  PARTICLES (rain / snow)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function clearParticles() {
  document.getElementById('particles').innerHTML = '';
}
function spawnRain(count=80) {
  clearParticles();
  const p = document.getElementById('particles');
  for(let i=0;i<count;i++){
    const el = document.createElement('div');
    el.className = 'particle';
    const size = Math.random()*1+0.5;
    el.style.cssText = `
      left:${Math.random()*110-5}%;
      width:${size}px;height:${10+Math.random()*20}px;
      background:rgba(130,200,255,${0.2+Math.random()*0.3});
      border-radius:1px;
      animation-duration:${0.6+Math.random()*0.6}s;
      animation-delay:${Math.random()*2}s;
      --drift:${(Math.random()-0.5)*30}px;
    `;
    p.appendChild(el);
  }
}
function spawnSnow(count=60) {
  clearParticles();
  const p = document.getElementById('particles');
  for(let i=0;i<count;i++){
    const el = document.createElement('div');
    el.className = 'particle';
    const size = Math.random()*4+2;
    el.style.cssText = `
      left:${Math.random()*110-5}%;
      width:${size}px;height:${size}px;
      background:rgba(220,240,255,${0.4+Math.random()*0.4});
      animation-duration:${3+Math.random()*4}s;
      animation-delay:${Math.random()*4}s;
      --drift:${(Math.random()-0.5)*80}px;
    `;
    p.appendChild(el);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  GEOCODING (Nominatim)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`;
  const r = await fetch(url, {headers:{'Accept-Language':'en'}});
  return r.json();
}
async function reverseGeocode(lat,lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
    const r = await fetch(url, {headers:{'Accept-Language':'en'}});
    const d = await r.json();
    return d.address?.city || d.address?.town || d.address?.village || d.address?.county || d.display_name.split(',')[0];
  } catch { return 'Your Location'; }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  WEATHER (Open-Meteo)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function fetchWeather(lat,lon) {
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

async function fetchAQI(lat,lon) {
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}`
    + `&current=pm10,pm2_5,nitrogen_dioxide,ozone,european_aqi`
    + `&timezone=auto`;
  const r = await fetch(url);
  return r.json();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  WMO CODE → condition
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const WMO = {
  0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',
  45:'Fog',48:'Freezing fog',
  51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',
  61:'Slight rain',63:'Rain',65:'Heavy rain',
  71:'Slight snow',73:'Snow',75:'Heavy snow',
  77:'Snow grains',
  80:'Slight showers',81:'Showers',82:'Heavy showers',
  85:'Slight snow showers',86:'Snow showers',
  95:'Thunderstorm',96:'Thunderstorm w/ hail',99:'Thunderstorm w/ heavy hail',
};
const WMO_ICON = {
  0:'☀️',1:'🌤️',2:'⛅',3:'☁️',
  45:'🌫️',48:'🌫️',
  51:'🌦️',53:'🌧️',55:'🌧️',
  61:'🌦️',63:'🌧️',65:'⛈️',
  71:'🌨️',73:'❄️',75:'❄️',77:'🌨️',
  80:'🌦️',81:'🌧️',82:'⛈️',
  85:'🌨️',86:'🌨️',
  95:'⛈️',96:'⛈️',99:'⛈️',
};

function wmoToSkyCondition(code) {
  if ([0,1].includes(code)) return 'clear';
  if ([2,3].includes(code)) return code===3?'overcast':'cloudy';
  if ([45,48].includes(code)) return 'fog';
  if (code>=51 && code<=82) return 'rain';
  if (code>=71 && code<=77) return 'snow';
  if (code>=95) return 'storm';
  return 'clear';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  TEMPERATURE CONVERSION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function toUnit(c) {
  return STATE.unit === 'F' ? Math.round(c*9/5+32) : Math.round(c);
}
function unitLabel() { return STATE.unit === 'F' ? '°F' : '°C'; }

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  WIND DIRECTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function degToCardinal(d) {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(d/22.5)%16];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  UV LABELS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function uvLabel(v) {
  if (v<=2) return 'Low';
  if (v<=5) return 'Moderate';
  if (v<=7) return 'High';
  if (v<=10) return 'Very High';
  return 'Extreme';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  AQI
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function aqiCategory(v) {
  if (v<=50) return {label:'Good', color:'#00e400'};
  if (v<=100) return {label:'Moderate', color:'#ffff00'};
  if (v<=150) return {label:'Unhealthy for Sensitive Groups', color:'#ff7e00'};
  if (v<=200) return {label:'Unhealthy', color:'#ff0000'};
  if (v<=300) return {label:'Very Unhealthy', color:'#8f3f97'};
  return {label:'Hazardous', color:'#7e0023'};
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  MOOD ENGINE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function getMood(code, temp, hour) {
  if (code===0 && temp>20 && hour>=16 && hour<=20) return {emoji:'🌅',text:'Perfect golden hour. A walk would feel magical right now.'};
  if (code===0 && temp>25) return {emoji:'☀️',text:'Blazing and beautiful. Sunscreen is your best friend today.'};
  if (code===0 && temp>15 && temp<=25) return {emoji:'😊',text:'Ideal conditions. Step outside — the air feels alive.'};
  if (code===0 && temp<=15) return {emoji:'🔥',text:'Crisp and clear. Perfect for a brisk morning run.'};
  if ([1,2].includes(code)) return {emoji:'🌤️',text:'Gentle clouds softening the sun. A breezy, easy kind of day.'};
  if (code===3) return {emoji:'☁️',text:'A blanket of clouds overhead. Cozy indoor vibes or a contemplative stroll.'};
  if ([45,48].includes(code)) return {emoji:'🌫️',text:'The world is hushed and mysterious. Drive carefully out there.'};
  if (code>=51 && code<=55) return {emoji:'🌦️',text:'A light drizzle refreshes the air. Perfect for coffee and a window seat.'};
  if (code>=61 && code<=65) return {emoji:'🌧️',text:'Rain is rewriting the streets. Grab an umbrella before heading out.'};
  if (code>=71 && code<=77) return {emoji:'❄️',text:'Snow is painting the world white. Dress in layers and tread carefully.'};
  if (code>=80 && code<=82) return {emoji:'🌦️',text:'Scattered showers keep things interesting. Weather may change quickly.'};
  if (code>=95) return {emoji:'⛈️',text:'A storm is making its presence known. Stay safe and stay inside.'};
  return {emoji:'🌡️',text:'Conditions are changing. Check back for updates.'};
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  OUTDOOR SAFETY SCORE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function calcOutdoorScore(temp, uv, aqi, windKmh, precip, code) {
  let score = 100;
  const factors = [];

  if (temp > 38) { score -= 25; factors.push('⚠️ Extreme heat'); }
  else if (temp > 32) { score -= 12; factors.push('☀️ High temperature'); }
  else if (temp < 0) { score -= 20; factors.push('🥶 Freezing temperatures'); }
  else if (temp < 5) { score -= 10; factors.push('🧤 Cold conditions'); }

  if (uv >= 11) { score -= 20; factors.push('☢️ Extreme UV'); }
  else if (uv >= 8) { score -= 12; factors.push('🔆 Very high UV'); }
  else if (uv >= 6) { score -= 6; factors.push('🌞 High UV'); }

  if (aqi > 200) { score -= 25; factors.push('🚫 Very unhealthy air'); }
  else if (aqi > 150) { score -= 15; factors.push('😷 Unhealthy air'); }
  else if (aqi > 100) { score -= 8; factors.push('😐 Moderate air quality'); }

  if (windKmh > 60) { score -= 15; factors.push('💨 Storm-force winds'); }
  else if (windKmh > 40) { score -= 8; factors.push('🌬️ Strong winds'); }

  if (code >= 95) { score -= 20; factors.push('⛈️ Thunderstorm'); }
  else if (precip > 5) { score -= 12; factors.push('🌧️ Heavy rain'); }
  else if (precip > 0) { score -= 5; factors.push('🌦️ Some precipitation'); }

  score = Math.max(0, Math.min(100, score));
  return { score, factors };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  LIFESTYLE TEXT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function getClothingSuggestion(temp, wind, humidity) {
  const wc = Math.round(temp - 0.3*(wind**0.5)*1.3);
  if (wc > 30) return { text: 'Light breathable fabrics — shorts and a tee. Stay cool and hydrated.', score: 90 };
  if (wc > 22) return { text: 'T-shirt weather with light trousers or a summer dress.', score: 75 };
  if (wc > 15) return { text: 'A light jacket or sweater should do. Layers are your friend.', score: 60 };
  if (wc > 5)  return { text: 'Warm jacket, scarf, and closed shoes. Don\'t underestimate the wind.', score: 40 };
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
  if (aqi <= 50 && humidity < 70) return { text: 'Air quality is excellent. Deep breaths welcome — it\'s refreshing out there.', score: 95 };
  return { text: 'Good air quality. No concerns for most people today.', score: 75 };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  NEXT 3 HOURS INSIGHT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function buildThreeHourInsight(hourly, currentIdx) {
  const next3 = [0,1,2].map(i => currentIdx+i).filter(i => i < hourly.temperature_2m.length);
  if (!next3.length) return { text: 'Hourly data unavailable.', chips: [] };

  const temps = next3.map(i => hourly.temperature_2m[i]);
  const precips = next3.map(i => hourly.precipitation_probability[i]);
  const winds = next3.map(i => hourly.wind_speed_10m[i]);

  const maxPrec = Math.max(...precips);
  const tempTrend = temps[temps.length-1] - temps[0];
  const maxWind = Math.max(...winds);

  let text = '';
  const chips = [];

  if (maxPrec > 60) {
    text = `Expect rain in the coming hours — precipitation probability peaks at ${maxPrec}%. Keep an umbrella handy.`;
    chips.push('🌧️ Rain likely');
  } else if (maxPrec > 30) {
    text = `Some chance of showers in the next few hours (up to ${maxPrec}%). Conditions may be unsettled.`;
    chips.push('🌦️ Possible showers');
  } else {
    text = `The sky remains mostly dry for the next 3 hours.`;
    chips.push('☀️ Dry conditions');
  }

  if (tempTrend > 3) { text += ` Temperatures will rise by about ${Math.round(tempTrend)}°.`; chips.push(`📈 Warming +${Math.round(tempTrend)}°`); }
  else if (tempTrend < -3) { text += ` A drop of ${Math.round(Math.abs(tempTrend))}° is expected — dress for cooler air.`; chips.push(`📉 Cooling ${Math.round(tempTrend)}°`); }

  if (maxWind > 40) { text += ` Strong gusts up to ${Math.round(maxWind)} km/h — brace yourself outside.`; chips.push(`💨 Gusts ${Math.round(maxWind)} km/h`); }

  chips.push(`Avg temp: ${toUnit(temps.reduce((a,b)=>a+b,0)/temps.length)}${unitLabel()}`);

  return { text, chips };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  BEST TIME OUTSIDE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function getBestTime(hourly) {
  const now = new Date();
  const currentHour = now.getHours();
  let bestScore = -999, bestHour = currentHour;

  for (let i=currentHour; i<Math.min(currentHour+12, hourly.temperature_2m.length); i++) {
    const t = hourly.temperature_2m[i];
    const p = hourly.precipitation_probability[i];
    const w = hourly.wind_speed_10m[i];
    const c = hourly.cloud_cover[i];
    const h = new Date(hourly.time[i]).getHours();
    const dayBonus = (h >= 8 && h <= 20) ? 20 : 0;
    const score = 100 - Math.abs(22-t)*2 - p*0.6 - w*0.3 - c*0.1 + dayBonus;
    if (score > bestScore) { bestScore = score; bestHour = i; }
  }

  const bestT = new Date(hourly.time[bestHour]);
  const hh = bestT.getHours();
  const label = hh >= 12 ? `${hh===12?12:hh-12}:00 PM` : `${hh===0?12:hh}:00 AM`;
  return {
    text: `Best window is around ${label} — comfortable temperature and relatively calm conditions.`,
    score: Math.min(100, Math.max(0, Math.round(bestScore)))
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  SUN ARC
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function updateSunArc(sunriseISO, sunsetISO) {
  const now = Date.now();
  const rise = new Date(sunriseISO).getTime();
  const set = new Date(sunsetISO).getTime();
  const total = set - rise;
  const elapsed = now - rise;
  const t = Math.max(0, Math.min(1, elapsed/total));

  const bx = (1-t)*(1-t)*10 + 2*(1-t)*t*100 + t*t*190;
  const by = (1-t)*(1-t)*75 + 2*(1-t)*t*5 + t*t*75;
  document.getElementById('sun-pos').setAttribute('cx', bx.toFixed(1));
  document.getElementById('sun-pos').setAttribute('cy', by.toFixed(1));

  const fmt = d => {
    const dt = new Date(d);
    return dt.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  };
  document.getElementById('sunrise-time').textContent = fmt(sunriseISO);
  document.getElementById('sunset-time').textContent = fmt(sunsetISO);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  HOURLY CHART
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function buildHourlyChart(hourly) {
  const now = new Date();
  const currentHour = now.getHours();
  const currentIdx = hourly.time.findIndex(t => new Date(t).getHours() === currentHour && new Date(t).toDateString() === now.toDateString());
  const start = Math.max(0, currentIdx);
  const labels = hourly.time.slice(start, start+24).map(t => {
    const h = new Date(t).getHours();
    return h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h-12}pm`;
  });
  const temps = hourly.temperature_2m.slice(start, start+24).map(v => toUnit(v));
  const precips = hourly.precipitation_probability.slice(start, start+24);

  if (STATE.hourlyChart) STATE.hourlyChart.destroy();
  const c = document.getElementById('hourly-chart');
  const chartCtx = c.getContext('2d');
  const grad = chartCtx.createLinearGradient(0,0,0,160);
  grad.addColorStop(0, 'rgba(93,228,255,0.3)');
  grad.addColorStop(1, 'rgba(93,228,255,0)');

  STATE.hourlyChart = new Chart(chartCtx, {
    data: {
      labels,
      datasets: [
        {
          type:'line', label:'Temp',
          data: temps, yAxisID:'y',
          borderColor:'#5de4ff', borderWidth:2,
          backgroundColor: grad,
          fill:true, tension:0.45,
          pointRadius:0, pointHoverRadius:5,
          pointHoverBackgroundColor:'#5de4ff',
        },
        {
          type:'bar', label:'Precip %',
          data: precips, yAxisID:'y1',
          backgroundColor:'rgba(126,203,255,0.2)',
          borderRadius:3, barPercentage:0.6,
        }
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{display:false},
        tooltip:{
          backgroundColor:'rgba(14,20,36,0.9)',
          borderColor:'rgba(93,228,255,0.3)', borderWidth:1,
          titleFont:{family:'DM Mono', size:11},
          bodyFont:{family:'DM Mono', size:11},
          padding:10, cornerRadius:8,
          callbacks:{
            label: ctx => ctx.dataset.label==='Temp'
              ? ` ${ctx.parsed.y}${unitLabel()}`
              : ` ${ctx.parsed.y}% precip`,
          }
        }
      },
      scales:{
        x:{
          grid:{color:'rgba(255,255,255,0.04)'},
          ticks:{color:'rgba(232,237,245,0.4)',font:{family:'DM Mono',size:10}},
        },
        y:{
          position:'left',
          grid:{color:'rgba(255,255,255,0.04)'},
          ticks:{color:'rgba(232,237,245,0.4)',font:{family:'DM Mono',size:10},
            callback:v => `${v}${unitLabel()}`},
        },
        y1:{
          position:'right', min:0, max:100,
          grid:{display:false},
          ticks:{color:'rgba(126,203,255,0.5)',font:{family:'DM Mono',size:10},
            callback:v=>`${v}%`},
        }
      }
    }
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
  updateSkyColors();
  clearParticles();
  if (['rain'].includes(STATE.skyCondition)) spawnRain();
  if (STATE.skyCondition === 'storm') spawnRain(120);
  if (STATE.skyCondition === 'snow') spawnSnow();

  const temp = curr.temperature_2m;
  document.getElementById('hero-temp').textContent = toUnit(temp);
  document.getElementById('hero-unit').textContent = unitLabel();
  document.getElementById('hero-condition').textContent = WMO[code] || 'Unknown';
  document.getElementById('hero-icon').textContent = WMO_ICON[code] || '🌡️';
  document.getElementById('loc-name').textContent = STATE.locationName;
  document.getElementById('feels-like').textContent = `${toUnit(curr.apparent_temperature)}${unitLabel()}`;
  document.getElementById('humidity').textContent = `${curr.relative_humidity_2m}%`;
  document.getElementById('pressure').textContent = `${curr.surface_pressure?.toFixed(0)} hPa`;
  document.getElementById('visibility').textContent = curr.visibility != null ? `${(curr.visibility/1000).toFixed(1)} km` : '—';
  document.getElementById('cloudcover').textContent = `${curr.cloud_cover}%`;

  const uv = curr.uv_index ?? 0;
  document.getElementById('uv-value').textContent = uv.toFixed(1);
  document.getElementById('uv-label').textContent = uvLabel(uv);
  document.getElementById('precip-value').textContent = (curr.precipitation ?? 0).toFixed(1);
  const nowIdx = new Date().getHours();
  const dp = hourly.dew_point_2m?.[nowIdx] ?? '—';
  document.getElementById('dewpoint-value').textContent = dp !== '—' ? toUnit(dp) : '—';
  document.getElementById('dewpoint-unit').textContent = unitLabel();
  document.getElementById('surfpressure-value').textContent = (curr.surface_pressure??0).toFixed(0);

  const windDeg = curr.wind_direction_10m ?? 0;
  const windKmh = curr.wind_speed_10m ?? 0;
  document.getElementById('wind-arrow').style.transform = `rotate(${windDeg}deg)`;
  document.getElementById('wind-speed').textContent = `${Math.round(windKmh)} km/h`;
  document.getElementById('wind-dir-text').textContent = degToCardinal(windDeg);

  const aqiVal = aqiData?.current?.european_aqi ?? 0;
  const uvFrac = Math.min(uv/12, 1);
  const aqiFrac = Math.min(aqiVal/300, 1);
  const C = 251.2;
  document.getElementById('uv-arc').style.strokeDashoffset = (C - uvFrac*C).toFixed(2);
  document.getElementById('uv-arc-val').textContent = uv.toFixed(1);
  document.getElementById('uv-cat').textContent = uvLabel(uv);
  document.getElementById('aqi-arc').style.strokeDashoffset = (C - aqiFrac*C).toFixed(2);
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

  const fg = document.getElementById('forecast-grid');
  fg.innerHTML = '';
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  daily.time.slice(0,7).forEach((dateStr, i) => {
    const d = new Date(dateStr);
    const hi = toUnit(daily.temperature_2m_max[i]);
    const lo = toUnit(daily.temperature_2m_min[i]);
    const dcode = daily.weather_code[i];
    const precip = daily.precipitation_probability_max[i] ?? 0;
    const range = toUnit(daily.temperature_2m_max[0]) - toUnit(daily.temperature_2m_min[0]);
    const thiRange = hi - lo;
    const barW = range > 0 ? Math.min(100, thiRange/range*100) : 50;
    const el = document.createElement('div');
    el.className = 'forecast-day';
    el.innerHTML = `
      <div class="forecast-day-name">${i===0?'Today':days[d.getDay()]}</div>
      <div class="forecast-day-icon">${WMO_ICON[dcode]||'🌡️'}</div>
      <div class="forecast-day-high">${hi}${unitLabel()}</div>
      <div class="forecast-day-low">${lo}${unitLabel()}</div>
      <div class="forecast-day-bar"><div class="forecast-day-bar-fill" style="width:${barW}%"></div></div>
      <div class="forecast-precip">${precip>0?precip+'%':''}</div>
    `;
    fg.appendChild(el);
  });

  document.getElementById('aqi-big').textContent = aqiVal;
  document.getElementById('aqi-big-cat').textContent = aqiCat.label;
  document.getElementById('aqi-big').style.color = aqiCat.color;
  const indLeft = Math.min(95, Math.max(2, aqiVal/300*100));
  document.getElementById('aqi-indicator').style.left = `${indLeft}%`;
  document.getElementById('pm25').textContent = (aqiData?.current?.pm2_5??0).toFixed(1)+' µg/m³';
  document.getElementById('pm10').textContent = (aqiData?.current?.pm10??0).toFixed(1)+' µg/m³';
  document.getElementById('no2').textContent = (aqiData?.current?.nitrogen_dioxide??0).toFixed(1)+' µg/m³';
  document.getElementById('o3').textContent = (aqiData?.current?.ozone??0).toFixed(1)+' µg/m³';

  const { score: oss, factors } = calcOutdoorScore(temp, uv, aqiVal, windKmh, curr.precipitation??0, code);
  const ossC = 314.16;
  document.getElementById('oss-arc').style.strokeDashoffset = (ossC - oss/100*ossC).toFixed(2);
  document.getElementById('oss-arc').style.stroke = oss>70?'#5de4ff':oss>40?'#ff9f43':'#ff4444';
  document.getElementById('oss-val').textContent = oss;
  document.getElementById('oss-desc').textContent =
    oss >= 80 ? 'Excellent — ideal for outdoor activities' :
    oss >= 60 ? 'Good — minor concerns to be aware of' :
    oss >= 40 ? 'Moderate — exercise some caution' :
    oss >= 20 ? 'Poor — limit time outdoors' :
    'Dangerous — avoid going outside';
  document.getElementById('oss-factors').textContent =
    factors.length ? factors.join('  ·  ') : '✅ No significant hazards detected';

  const clothing = getClothingSuggestion(temp, windKmh, curr.relative_humidity_2m);
  document.getElementById('clothing-text').textContent = clothing.text;
  setTimeout(()=>document.getElementById('clothing-bar').style.width=clothing.score+'%',500);

  const hydration = getHydration(temp, curr.relative_humidity_2m, uv);
  document.getElementById('hydration-text').textContent = hydration.text;
  setTimeout(()=>document.getElementById('hydration-bar').style.width=hydration.score+'%',600);

  const breathing = getBreathing(aqiVal, curr.relative_humidity_2m, code);
  document.getElementById('breathing-text').textContent = breathing.text;
  setTimeout(()=>document.getElementById('breathing-bar').style.width=breathing.score+'%',700);

  const besttime = getBestTime(hourly);
  document.getElementById('besttime-text').textContent = besttime.text;
  setTimeout(()=>document.getElementById('besttime-bar').style.width=Math.min(100,besttime.score)+'%',800);

  const insight = buildThreeHourInsight(hourly, currentIdx);
  document.getElementById('three-hour-insight').textContent = insight.text;
  const chipsEl = document.getElementById('insight-chips');
  chipsEl.innerHTML = '';
  insight.chips.forEach(c=>{
    const chip = document.createElement('div');
    chip.className='chip'; chip.textContent=c;
    chipsEl.appendChild(chip);
  });

  document.getElementById('last-updated').textContent = new Date().toLocaleTimeString();
}

function updateScrubber(idx) {
  const h = STATE.scrubberData;
  if (!h) return;
  const i = Math.min(idx, h.temperature_2m.length-1);
  document.getElementById('sc-temp').textContent = `${toUnit(h.temperature_2m[i])}${unitLabel()}`;
  document.getElementById('sc-precip').textContent = `${h.precipitation_probability[i]??0}%`;
  document.getElementById('sc-wind').textContent = `${Math.round(h.wind_speed_10m[i]??0)} km/h`;
  document.getElementById('sc-hum').textContent = `${h.relative_humidity_2m[i]??0}%`;
  document.getElementById('sc-cloud').textContent = `${h.cloud_cover[i]??0}%`;
  const t = new Date(h.time[i]);
  const now = new Date();
  const diffH = Math.round((t-now)/3600000);
  document.getElementById('sc-time-label').textContent =
    diffH===0 ? 'Now' :
    diffH>0 ? `+${diffH}h from now` :
    `${Math.abs(diffH)}h ago`;
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
      results.slice(0,5).forEach(r => {
        const d = document.createElement('div');
        d.className = 'ac-item';
        d.textContent = r.display_name;
        d.addEventListener('click', () => {
          searchInput.value = r.display_name.split(',').slice(0,2).join(',');
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
    document.querySelectorAll('.unit-btn').forEach(b => b.classList.toggle('active', b.dataset.unit===STATE.unit));
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
function cacheKey(lat,lon) { return `wn_${lat.toFixed(2)}_${lon.toFixed(2)}`; }
function getCached(key) {
  try {
    const s = sessionStorage.getItem(key);
    if (!s) return null;
    const d = JSON.parse(s);
    if (Date.now() - d.ts > 10*60*1000) return null;
    return d.data;
  } catch { return null; }
}
function setCache(key, data) {
  try { sessionStorage.setItem(key, JSON.stringify({ts:Date.now(),data})); } catch {}
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
        fetchAQI(STATE.lat, STATE.lon).catch(() => null)
      ]);
      setCache(ck, {w, aqi});
    }

    STATE.weather = w;
    STATE.aqi = aqi || {current:{european_aqi:0,pm2_5:0,pm10:0,nitrogen_dioxide:0,ozone:0}};

    render(w, STATE.aqi);

    document.getElementById('main-content').style.display = 'block';
    document.getElementById('loader').classList.add('hidden');
  } catch(e) {
    console.error(e);
    document.getElementById('loader').classList.add('hidden');
    document.getElementById('error-state').classList.add('show');
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  INIT (exposed globally for retry button)
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  AUTO-REFRESH every 15 minutes
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
setInterval(() => {
  if (STATE.lat) loadData();
}, 15 * 60 * 1000);
