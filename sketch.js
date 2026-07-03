let CANVAS_W = window.innerWidth;
let CANVAS_H = window.innerHeight;

// Bounding box de Donostia/San Sebastián.
const BBOX = { south: 43.305, west: -2.015, north: 43.330, east: -1.965 };

// ---------- fechas de temperatura ----------
const WEATHER_START = '2026-07-01';
const WEATHER_END = '2026-07-04';

const WEATHER_DATES = [
  '2026-07-01',
  '2026-07-02',
  '2026-07-03',
  '2026-07-04'
];

// Puntos repartidos dentro de la zona visible del mapa.
// No son estaciones exactas: sirven para interpolación visual/artística.
const TEMP_POINTS = [
  { name: 'Antiguo', lat: 43.3138, lon: -2.0080 },
  { name: 'Centro', lat: 43.3183, lon: -1.9812 },
  { name: 'Gros', lat: 43.3223, lon: -1.9735 },
  { name: 'Amara', lat: 43.3098, lon: -1.9805 },
  { name: 'Egia', lat: 43.3149, lon: -1.9730 },
  { name: 'Aiete', lat: 43.3075, lon: -2.0000 },
  { name: 'Intxaurrondo', lat: 43.3165, lon: -1.9665 },
  { name: 'Ulia', lat: 43.3255, lon: -1.9655 }
];

// ---------- cámara ----------
const DEFAULT_ZOOM = 0.8;
let zoom = DEFAULT_ZOOM;
let panX = 0;
let panY = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

// ---------- estado visual ----------
let loadedImages = [];
let pool = [];
let progress = 0;
let tileSizePx = 7;
let loomPoints = [];
let geoReady = false;
let lastLines = null;
let appState = 'loading'; // loading | loom | deposit | composting | done

// ---------- UI ----------
let sortModeEl,
  weaveEl,
  speedEl,
  tileSizeEl,
  statusEl,
  compostBtn,
  resetBtn,
  fileInput,
  reloadGeoBtn,
  toggleUIBtn,
  overlayEl,
  resetViewBtn,
  captureBtn,
  invertBtn,
  weatherModeBtn,
  tempDateEl;

// ---------- modos ----------
let invertColors = false;

// Este modo NO pinta con una paleta térmica artificial.
// Ordena los colores originales de las fotos según temperatura.
let thermalOrderMode = false;

let selectedDate = '2026-07-01';

let tempData = {};
let tempRange = { min: 10, max: 30 };
let temperatureReady = false;

// ---------- SETUP ----------

function setup() {
  const cnv = createCanvas(CANVAS_W, CANVAS_H);
  cnv.parent('canvas-wrap');

  pixelDensity(1);
  noStroke();
  background(14, 13, 10);
  rectMode(CENTER);
  angleMode(RADIANS);

  sortModeEl = document.getElementById('sortMode');
  weaveEl = document.getElementById('weave');
  speedEl = document.getElementById('speed');
  tileSizeEl = document.getElementById('tileSize');
  statusEl = document.getElementById('status');
  compostBtn = document.getElementById('compostBtn');
  resetBtn = document.getElementById('resetBtn');
  fileInput = document.getElementById('fileInput');
  reloadGeoBtn = document.getElementById('reloadGeoBtn');
  toggleUIBtn = document.getElementById('toggleUI');
  overlayEl = document.getElementById('overlay');
  resetViewBtn = document.getElementById('resetViewBtn');
  captureBtn = document.getElementById('captureBtn');
  invertBtn = document.getElementById('invertBtn');
  weatherModeBtn = document.getElementById('weatherModeBtn');
  tempDateEl = document.getElementById('tempDate');

  fileInput.addEventListener('change', handleFiles);
  compostBtn.addEventListener('click', startCompost);
  resetBtn.addEventListener('click', resetAll);
  reloadGeoBtn.addEventListener('click', loadDonostiGeometry);
  toggleUIBtn.addEventListener('click', () => overlayEl.classList.toggle('hidden'));
  resetViewBtn.addEventListener('click', resetView);

  if (captureBtn) {
    captureBtn.addEventListener('click', captureCanvas);
  }

  if (invertBtn) {
    invertBtn.addEventListener('click', toggleInvertColors);
  }

  if (weatherModeBtn) {
    weatherModeBtn.addEventListener('click', toggleThermalOrderMode);
  }

  if (tempDateEl) {
    tempDateEl.addEventListener('change', () => {
      selectedDate = tempDateEl.value;

      updateTempRangeForSelectedDate();
      assignTemperaturesToLoom();

      if (pool.length > 0) {
        if (thermalOrderMode && temperatureReady) {
          assignThermalPhotoTargets();
        } else {
          assignLoomTargets();
        }
      }

      updateTemperatureStatus();
    });
  }

  tileSizeEl.addEventListener('input', onLatticeParamsChanged);
  weaveEl.addEventListener('input', onLatticeParamsChanged);

  loadDonostiGeometry();
}

// ---------- RESPONSIVE ----------

function windowResized() {
  CANVAS_W = window.innerWidth;
  CANVAS_H = window.innerHeight;
  resizeCanvas(CANVAS_W, CANVAS_H);

  if (lastLines) {
    buildLoomFromLines(lastLines);
    assignTemperaturesToLoom();

    if (pool.length > 0) {
      if (thermalOrderMode && temperatureReady) {
        assignThermalPhotoTargets();
      } else {
        assignLoomTargets();
      }
    }
  }
}

// ---------- VISTA ----------

function resetView() {
  zoom = DEFAULT_ZOOM;
  panX = 0;
  panY = 0;
}

function onLatticeParamsChanged() {
  tileSizePx = tileSizeFromUI();

  if (lastLines) {
    buildLoomFromLines(lastLines);
    assignTemperaturesToLoom();
  }

  if (appState === 'composting' || appState === 'done') {
    if (thermalOrderMode && temperatureReady) {
      assignThermalPhotoTargets();
    } else {
      sortPool();
      assignLoomTargets();
    }
  }
}

// ---------- NAVEGACIÓN ----------

function isOverUI(e) {
  if (!e || !e.target) return false;
  return (overlayEl && overlayEl.contains(e.target)) || e.target === toggleUIBtn;
}

function mousePressed(e) {
  if (isOverUI(e)) return;
  if (mouseY < 0 || mouseX < 0 || mouseX > width || mouseY > height) return;

  isDragging = true;
  dragStartX = mouseX - panX;
  dragStartY = mouseY - panY;
}

function mouseDragged(e) {
  if (isDragging && !isOverUI(e)) {
    panX = mouseX - dragStartX;
    panY = mouseY - dragStartY;
  }
}

function mouseReleased() {
  isDragging = false;
}

function mouseWheel(e) {
  if (isOverUI(e)) return;

  const factor = 1 - constrain(e.delta, -100, 100) * 0.0015;
  zoom = constrain(zoom * factor, 0.25, 5);

  return false;
}

// ---------- GEOMETRÍA URBANA ----------

async function loadDonostiGeometry() {
  geoReady = false;
  appState = 'loading';
  updateCompostBtnState();

  statusEl.textContent = 'cargando trama urbana de Donostia...';

  const query = `[out:json][timeout:25];
(
  way["highway"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
  way["natural"="coastline"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
);
out geom;`;

  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: 'data=' + encodeURIComponent(query)
    });

    if (!res.ok) throw new Error('overpass status ' + res.status);

    const data = await res.json();

    const lines = data.elements
      .filter(el => el.type === 'way' && el.geometry)
      .map(el => el.geometry.map(pt => [pt.lat, pt.lon]));

    if (lines.length === 0) throw new Error('sin geometría');

    lastLines = lines;
    buildLoomFromLines(lines);

    statusEl.textContent = `trama cargada: ${lines.length} vías/litoral de Donostia. cargando temperaturas...`;
  } catch (err) {
    console.warn('Overpass falló, usando geometría de respaldo:', err);

    lastLines = fallbackDonostiLines();
    buildLoomFromLines(lastLines);

    statusEl.textContent = 'no se pudo consultar OpenStreetMap — usando trama de respaldo. cargando temperaturas...';
  }

  geoReady = true;
  appState = 'loom';
  updateCompostBtnState();

  await loadTemperatureData();

  if (!loadedImages.length) {
    statusEl.textContent = temperatureReady
      ? 'trama y temperaturas cargadas. depositá imágenes para compostar.'
      : 'trama cargada. no se pudieron cargar temperaturas. depositá imágenes para compostar.';
  }
}

function project(lat, lon) {
  const scaleX = CANVAS_W / (BBOX.east - BBOX.west);
  const scaleY = CANVAS_H / (BBOX.north - BBOX.south);
  const scale = min(scaleX, scaleY) * 0.96;

  const offsetX = (CANVAS_W - (BBOX.east - BBOX.west) * scale) / 2;
  const offsetY = (CANVAS_H - (BBOX.north - BBOX.south) * scale) / 2;

  const x = (lon - BBOX.west) * scale + offsetX;
  const y = (BBOX.north - lat) * scale + offsetY;

  return { x, y };
}

function buildLoomFromLines(lines) {
  loomPoints = [];
  const step = max(3, tileSizeFromUI());

  lines.forEach(line => {
    const projected = line.map(([lat, lon]) => project(lat, lon));

    let acc = 0;

    for (let i = 0; i < projected.length - 1; i++) {
      const a = projected[i];
      const b = projected[i + 1];

      const segLen = dist(a.x, a.y, b.x, b.y);
      const angle = atan2(b.y - a.y, b.x - a.x);

      let d = acc;

      while (d < segLen) {
        const t = d / segLen;

        loomPoints.push({
          x: lerp(a.x, b.x, t),
          y: lerp(a.y, b.y, t),
          angle,
          temp: null
        });

        d += step;
      }

      acc = d - segLen;
    }
  });
}

function tileSizeFromUI() {
  return tileSizeEl ? int(tileSizeEl.value) : 7;
}

function fallbackDonostiLines() {
  const bay = [
    [43.3155, -1.9990], [43.3168, -1.9970], [43.3178, -1.9945],
    [43.3182, -1.9915], [43.3178, -1.9885], [43.3168, -1.9860],
    [43.3155, -1.9840], [43.3140, -1.9825]
  ];

  const gridLines = [];

  for (let i = 0; i < 6; i++) {
    const lat = 43.318 + i * 0.0015;
    gridLines.push([[lat, -2.000], [lat, -1.978]]);
  }

  for (let i = 0; i < 5; i++) {
    const lon = -1.998 + i * 0.004;
    gridLines.push([[43.312, lon], [43.325, lon]]);
  }

  return [bay, ...gridLines];
}

function updateCompostBtnState() {
  compostBtn.disabled = !(geoReady && loadedImages.length > 0);
}

// ---------- TEMPERATURAS ----------

async function loadTemperatureData() {
  temperatureReady = false;
  tempData = {};

  statusEl.textContent = 'cargando temperaturas del 1 al 4 de julio...';

  let totalLoaded = 0;

  const promises = TEMP_POINTS.map(async pt => {
    const values = await fetchDailyTempsForPoint(pt);
    tempData[pt.name] = values;

    Object.keys(values).forEach(date => {
      if (values[date] !== null && values[date] !== undefined) {
        totalLoaded++;
      }
    });
  });

  await Promise.all(promises);

  temperatureReady = totalLoaded > 0;

  updateTempRangeForSelectedDate();
  assignTemperaturesToLoom();

  if (pool.length > 0) {
    if (thermalOrderMode && temperatureReady) {
      assignThermalPhotoTargets();
    } else {
      assignLoomTargets();
    }
  }

  if (temperatureReady) {
    updateTemperatureStatus();
  } else {
    statusEl.textContent = 'no se pudieron cargar temperaturas. el orden térmico queda desactivado.';
    thermalOrderMode = false;

    if (weatherModeBtn) {
      weatherModeBtn.textContent = 'orden térmico';
    }
  }
}

async function fetchDailyTempsForPoint(pt) {
  const forecastUrl =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${pt.lat}` +
    `&longitude=${pt.lon}` +
    `&daily=temperature_2m_max,temperature_2m_min` +
    `&timezone=Europe%2FMadrid` +
    `&past_days=7` +
    `&forecast_days=16`;

  const archiveUrl =
    `https://archive-api.open-meteo.com/v1/archive` +
    `?latitude=${pt.lat}` +
    `&longitude=${pt.lon}` +
    `&start_date=${WEATHER_START}` +
    `&end_date=${WEATHER_END}` +
    `&daily=temperature_2m_mean,temperature_2m_max,temperature_2m_min` +
    `&timezone=Europe%2FMadrid`;

  const urls = [forecastUrl, archiveUrl];

  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('weather status ' + res.status);

      const data = await res.json();
      const parsed = parseDailyTemperatureResponse(data);

      if (Object.keys(parsed).length > 0) {
        return parsed;
      }
    } catch (err) {
      console.warn('error cargando temperatura para', pt.name, err);
    }
  }

  return {};
}

function parseDailyTemperatureResponse(data) {
  const output = {};

  if (!data || !data.daily || !data.daily.time) return output;

  const times = data.daily.time;
  const means = data.daily.temperature_2m_mean || null;
  const maxs = data.daily.temperature_2m_max || null;
  const mins = data.daily.temperature_2m_min || null;

  WEATHER_DATES.forEach(date => {
    const i = times.indexOf(date);
    if (i === -1) return;

    let value = null;

    if (means && means[i] !== null && means[i] !== undefined) {
      value = means[i];
    } else if (
      maxs && mins &&
      maxs[i] !== null && maxs[i] !== undefined &&
      mins[i] !== null && mins[i] !== undefined
    ) {
      value = (maxs[i] + mins[i]) / 2;
    }

    if (value !== null && value !== undefined && !Number.isNaN(value)) {
      output[date] = value;
    }
  });

  return output;
}

function updateTempRangeForSelectedDate() {
  const values = [];

  TEMP_POINTS.forEach(pt => {
    const v = tempData[pt.name] ? tempData[pt.name][selectedDate] : null;

    if (v !== null && v !== undefined && !Number.isNaN(v)) {
      values.push(v);
    }
  });

  if (values.length === 0) {
    tempRange.min = 10;
    tempRange.max = 30;
    return;
  }

  tempRange.min = Math.min(...values);
  tempRange.max = Math.max(...values);

  if (Math.abs(tempRange.max - tempRange.min) < 0.5) {
    const mid = (tempRange.min + tempRange.max) / 2;
    tempRange.min = mid - 1;
    tempRange.max = mid + 1;
  }
}

function assignTemperaturesToLoom() {
  if (!loomPoints.length || !temperatureReady) return;

  const projectedTempPoints = TEMP_POINTS.map(pt => {
    const pos = project(pt.lat, pt.lon);
    const temp = tempData[pt.name] ? tempData[pt.name][selectedDate] : null;

    return {
      name: pt.name,
      x: pos.x,
      y: pos.y,
      temp
    };
  }).filter(pt => pt.temp !== null && pt.temp !== undefined && !Number.isNaN(pt.temp));

  if (projectedTempPoints.length === 0) return;

  loomPoints.forEach(lp => {
    lp.temp = interpolateTemperature(lp.x, lp.y, projectedTempPoints);
  });
}

function interpolateTemperature(x, y, projectedTempPoints) {
  let weighted = 0;
  let weightSum = 0;

  const power = 2;

  for (const pt of projectedTempPoints) {
    const d = max(1, dist(x, y, pt.x, pt.y));
    const w = 1 / pow(d, power);

    weighted += pt.temp * w;
    weightSum += w;
  }

  if (weightSum === 0) return null;

  return weighted / weightSum;
}

function updateTemperatureStatus() {
  if (!temperatureReady) return;

  const values = [];

  TEMP_POINTS.forEach(pt => {
    const v = tempData[pt.name] ? tempData[pt.name][selectedDate] : null;

    if (v !== null && v !== undefined && !Number.isNaN(v)) {
      values.push(v);
    }
  });

  if (values.length === 0) {
    statusEl.textContent = `sin datos de temperatura para ${selectedDate}.`;
    return;
  }

  const minV = Math.min(...values).toFixed(1);
  const maxV = Math.max(...values).toFixed(1);

  statusEl.textContent = thermalOrderMode
    ? `orden térmico activo · ${selectedDate} · frío ${minV}°C / caliente ${maxV}°C.`
    : `temperaturas cargadas · ${selectedDate} · rango ${minV}°C–${maxV}°C.`;
}

// ---------- DEPÓSITO DE IMÁGENES ----------

function handleFiles(e) {
  const files = Array.from(e.target.files);
  if (files.length === 0) return;

  loadedImages = [];
  let loadedCount = 0;

  statusEl.textContent = `cargando ${files.length} imagen(es)...`;

  files.forEach((file, i) => {
    const reader = new FileReader();

    reader.onload = ev => {
      loadImage(ev.target.result, img => {
        loadedImages[i] = img;
        loadedCount++;

        if (loadedCount === files.length) {
          statusEl.textContent = `${files.length} imagen(es) depositadas. lista para compostar.`;
          appState = 'deposit';
          updateCompostBtnState();
        }
      });
    };

    reader.readAsDataURL(file);
  });
}

function drawDepositImages() {
  let n = loadedImages.length;
  let cols = ceil(sqrt(n));
  let rows = ceil(n / cols);
  let cw = CANVAS_W / cols;
  let ch = CANVAS_H / rows;

  for (let i = 0; i < n; i++) {
    let col = i % cols;
    let row = floor(i / cols);

    image(loadedImages[i], col * cw, row * ch, cw, ch);
  }
}

// ---------- COMPOST ----------

function startCompost() {
  if (loadedImages.length === 0 || loomPoints.length === 0) return;

  tileSizePx = tileSizeFromUI();

  if (lastLines) {
    buildLoomFromLines(lastLines);
    assignTemperaturesToLoom();
  }

  const totalCells = loomPoints.length;

  pool = [];

  let cellsPerImage = floor(totalCells / loadedImages.length);
  cellsPerImage = max(cellsPerImage, 4);

  loadedImages.forEach((img, imgIndex) => {
    let side = floor(sqrt(cellsPerImage));
    let small = createImage(side, side);

    small.copy(img, 0, 0, img.width, img.height, 0, 0, side, side);
    small.loadPixels();

    let cols = ceil(sqrt(loadedImages.length));
    let batchCol = imgIndex % cols;
    let batchRow = floor(imgIndex / cols);
    let batchW = CANVAS_W / cols;
    let batchH = CANVAS_H / ceil(loadedImages.length / cols);

    for (let y = 0; y < side; y++) {
      for (let x = 0; x < side; x++) {
        let idx = (x + y * side) * 4;

        let r = small.pixels[idx];
        let g = small.pixels[idx + 1];
        let b = small.pixels[idx + 2];

        let sx = batchCol * batchW + (x / side) * batchW;
        let sy = batchRow * batchH + (y / side) * batchH;

        pool.push({
          r,
          g,
          b,
          sx,
          sy,
          tx: 0,
          ty: 0,
          angle: 0,
          delay: 0,
          temp: null
        });
      }
    }
  });

  if (thermalOrderMode && temperatureReady) {
    assignThermalPhotoTargets();
  } else {
    sortPool();
    assignLoomTargets();
  }

  assignDelays();

  progress = 0;
  appState = 'composting';

  statusEl.textContent = thermalOrderMode
    ? 'fermentando con orden térmico... los tonos de las fotos buscan las zonas de temperatura'
    : 'fermentando... el tejido busca la trama de Donostia';
}

// ---------- ORDEN NORMAL POR COLOR ----------

function sortPool() {
  const mode = sortModeEl.value;

  pool.forEach(p => {
    let hsl = rgbToHsl(p.r, p.g, p.b);

    p._h = hsl[0];
    p._s = hsl[1];
    p._l = hsl[2];
  });

  if (mode === 'hue') {
    pool.sort((a, b) => a._h - b._h);
  } else if (mode === 'lightness') {
    pool.sort((a, b) => a._l - b._l);
  } else if (mode === 'saturation') {
    pool.sort((a, b) => a._s - b._s);
  } else if (mode === 'hueLight') {
    pool.sort((a, b) => {
      let hb = 24;
      let ha = floor(a._h * hb);
      let hb2 = floor(b._h * hb);

      if (ha !== hb2) return ha - hb2;

      return a._l - b._l;
    });
  }

  const weave = int(weaveEl.value);

  if (weave > 0) {
    for (let i = 0; i < pool.length; i += weave) {
      let end = min(i + weave, pool.length);
      let chunk = pool.slice(i, end);

      shuffleArray(chunk);

      for (let j = i; j < end; j++) {
        pool[j] = chunk[j - i];
      }
    }
  }
}

// ---------- ORDEN TÉRMICO CON COLORES DE FOTO ----------

function assignThermalPhotoTargets() {
  if (!pool.length || !loomPoints.length || !temperatureReady) {
    assignLoomTargets();
    return;
  }

  const sortedPool = [...pool].sort((a, b) => {
    return colorWarmthScore(a) - colorWarmthScore(b);
  });

  applyLocalWeave(sortedPool);

  const sortedLoom = [...loomPoints]
    .filter(lp => lp.temp !== null && lp.temp !== undefined && !Number.isNaN(lp.temp))
    .sort((a, b) => a.temp - b.temp);

  if (!sortedLoom.length) {
    assignLoomTargets();
    return;
  }

  for (let i = 0; i < sortedPool.length; i++) {
    const lp = sortedLoom[i % sortedLoom.length];

    sortedPool[i].tx = lp.x;
    sortedPool[i].ty = lp.y;
    sortedPool[i].angle = lp.angle;
    sortedPool[i].temp = lp.temp;
  }
}

function colorWarmthScore(p) {
  const hsl = rgbToHsl(p.r, p.g, p.b);

  const h = hsl[0];
  const s = hsl[1];
  const l = hsl[2];

  // Mide qué tan cerca está el color de rojos/naranjas/amarillos.
  let hueWarmth;

  if (h < 0.17) {
    hueWarmth = 1.0; // rojo → amarillo
  } else if (h > 0.92) {
    hueWarmth = 1.0; // rojo al cierre del círculo cromático
  } else if (h < 0.33) {
    hueWarmth = 0.65; // amarillo-verde
  } else if (h > 0.55 && h < 0.78) {
    hueWarmth = 0.10; // azul
  } else {
    hueWarmth = 0.35; // neutros / verdes / violetas
  }

  // Blanco o colores muy pálidos se empujan hacia frío.
  const paleWhiteCold = (1 - s) * l;

  // Evita que negros absolutos caigan siempre como "lo más frío".
  const darkNeutralCompensation = (1 - l) * 0.05;

  let warmth =
    hueWarmth * 0.65 +
    s * 0.25 +
    l * 0.10 -
    paleWhiteCold * 0.35 +
    darkNeutralCompensation;

  return constrain(warmth, 0, 1);
}

function applyLocalWeave(arr) {
  const weave = int(weaveEl.value);

  if (weave <= 0) return;

  for (let i = 0; i < arr.length; i += weave) {
    let end = min(i + weave, arr.length);
    let chunk = arr.slice(i, end);

    shuffleArray(chunk);

    for (let j = i; j < end; j++) {
      arr[j] = chunk[j - i];
    }
  }
}

// ---------- TARGETS ----------

function assignLoomTargets() {
  if (!pool.length || !loomPoints.length) return;

  for (let i = 0; i < pool.length; i++) {
    const lp = loomPoints[i % loomPoints.length];

    pool[i].tx = lp.x;
    pool[i].ty = lp.y;
    pool[i].angle = lp.angle;
    pool[i].temp = lp.temp;
  }
}

function assignDelays() {
  pool.forEach(p => {
    let n = noise(p.sx * 0.01, p.sy * 0.01);
    p.delay = n;
  });
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    let j = floor(random(i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  let max_ = Math.max(r, g, b);
  let min_ = Math.min(r, g, b);

  let h;
  let s;
  let l = (max_ + min_) / 2;

  if (max_ === min_) {
    h = 0;
    s = 0;
  } else {
    let d = max_ - min_;

    s = l > 0.5
      ? d / (2 - max_ - min_)
      : d / (max_ + min_);

    switch (max_) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }

    h /= 6;
  }

  return [h, s, l];
}

// ---------- DIBUJO ----------

function draw() {
  // Ahora invertir color funciona también en orden térmico.
  if (invertColors) {
    background(255);
  } else {
    background(14, 13, 10);
  }

  push();

  translate(width / 2 + panX, height / 2 + panY);
  scale(zoom);
  translate(-width / 2, -height / 2);

  if (appState === 'loom') {
    drawLoomPreview();
  } else if (appState === 'deposit') {
    drawDepositImages();
  } else if (appState === 'composting' || appState === 'done') {
    drawPoolFrame();
  }

  pop();
}

function drawLoomPreview() {
  strokeWeight(1 / zoom);

  if (invertColors) {
    stroke(20, 20, 20, 120);
  } else {
    stroke(90, 100, 60, 90);
  }

  loomPoints.forEach(p => point(p.x, p.y));

  noStroke();
}

function drawPoolFrame() {
  const speed = speedEl.value / 1000;

  if (appState === 'composting') {
    progress += speed;
  }

  let allDone = true;

  for (let p of pool) {
    let localT = constrain((progress - p.delay * 0.7), 0, 1);

    if (localT < 1) {
      allDone = false;
    }

    let t = localT < 0.5
      ? 2 * localT * localT
      : 1 - pow(-2 * localT + 2, 2) / 2;

    let x = lerp(p.sx, p.tx, t);
    let y = lerp(p.sy, p.ty, t);
    let ang = lerp(0, p.angle, t);
    let stretch = lerp(1, 2.1, t);

    push();

    translate(x, y);
    rotate(ang);

    // La inversión funciona tanto en modo normal como en orden térmico.
    // El orden térmico decide la distribución; la inversión solo cambia la visualización.
    if (invertColors) {
      fill(255 - p.r, 255 - p.g, 255 - p.b);
    } else {
      fill(p.r, p.g, p.b);
    }

    rect(0, 0, tileSizePx * stretch, tileSizePx * 0.75);

    pop();
  }

  if (appState === 'composting' && allDone) {
    appState = 'done';

    statusEl.textContent = thermalOrderMode
      ? `compost por orden térmico listo — ${selectedDate}. Los tonos de las fotos se organizaron según temperatura.`
      : 'compost listo — tejido tramado sobre Donostia a partir de ' + loadedImages.length + ' imagen(es). arrastrá o usá la rueda para explorarlo.';
  }
}

// ---------- RESET ----------

function resetAll() {
  loadedImages = [];
  pool = [];
  progress = 0;

  fileInput.value = '';
  appState = 'loom';

  updateCompostBtnState();

  statusEl.textContent = temperatureReady
    ? 'reiniciado. trama y temperaturas listas. depositá imágenes para empezar.'
    : 'reiniciado. depositá una o más imágenes para empezar.';
}

// ---------- CAPTURA ----------

function captureCanvas() {
  const now = new Date();

  const stamp = now.toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19);

  const mode = thermalOrderMode ? `orden-termico_${selectedDate}` : 'color';
  const invert = invertColors ? '_invertido' : '';

  saveCanvas(`compost-digital-donosti_${mode}${invert}_${stamp}`, 'png');

  if (statusEl) {
    statusEl.textContent = 'captura guardada como PNG.';
  }
}

// ---------- MODOS ----------

function toggleInvertColors() {
  invertColors = !invertColors;

  if (invertBtn) {
    invertBtn.textContent = invertColors ? 'color original' : 'invertir color';
  }

  if (statusEl) {
    if (thermalOrderMode) {
      statusEl.textContent = invertColors
        ? 'orden térmico invertido: fondo blanco y tonos de las fotos invertidos.'
        : 'orden térmico restaurado: tonos originales de las fotos.';
    } else {
      statusEl.textContent = invertColors
        ? 'modo invertido: fondo blanco y píxeles invertidos.'
        : 'modo original restaurado.';
    }
  }
}

function toggleThermalOrderMode() {
  if (!temperatureReady) {
    thermalOrderMode = false;

    if (weatherModeBtn) {
      weatherModeBtn.textContent = 'orden térmico';
    }

    statusEl.textContent = 'todavía no hay temperaturas cargadas.';
    return;
  }

  thermalOrderMode = !thermalOrderMode;

  if (weatherModeBtn) {
    weatherModeBtn.textContent = thermalOrderMode ? 'modo imagen' : 'orden térmico';
  }

  updateTempRangeForSelectedDate();
  assignTemperaturesToLoom();

  if (pool.length > 0) {
    if (thermalOrderMode) {
      assignThermalPhotoTargets();
    } else {
      sortPool();
      assignLoomTargets();
    }
  }

  if (thermalOrderMode) {
    updateTemperatureStatus();
  } else {
    statusEl.textContent = 'modo imagen activo: el tejido usa el orden cromático normal.';
  }
}