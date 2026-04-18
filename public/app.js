const state = {
  snapshot: null,
  selectedZoneId: null,
  ws: null,
  mapMode: '2d',
  mapData: {
    zones: null,
    buildings: null,
  },
  leafletMap: null,
  leafletZones: {},
  leafletBuildings: null,
  leafletLabels: [],
  map3d: null,
  map3dReady: false,
};

const CAMPUS_CENTER = [13.7856, 121.0714];
const BSU_CAMPUS_BOUNDARY_LATLNG = [
  [13.78746, 121.06972],
  [13.78764, 121.07074],
  [13.78758, 121.07248],
  [13.78696, 121.07302],
  [13.7855, 121.0731],
  [13.78466, 121.07254],
  [13.7842, 121.07142],
  [13.78436, 121.0701],
  [13.78508, 121.06946],
  [13.78628, 121.06934],
];
const FALLBACK_ZONES = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { zoneId: 'zoneA', name: 'Engineering Block' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[121.06985, 13.78655], [121.07028, 13.78686], [121.07072, 13.78652], [121.07024, 13.78618], [121.06985, 13.78655]]],
      },
    },
    {
      type: 'Feature',
      properties: { zoneId: 'zoneB', name: 'Library Commons' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[121.07052, 13.78693], [121.07102, 13.78715], [121.07142, 13.78686], [121.07096, 13.7866], [121.07052, 13.78693]]],
      },
    },
    {
      type: 'Feature',
      properties: { zoneId: 'zoneC', name: 'Central Cafeteria' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[121.0716, 13.7868], [121.07202, 13.78712], [121.07246, 13.78682], [121.07205, 13.78646], [121.0716, 13.7868]]],
      },
    },
    {
      type: 'Feature',
      properties: { zoneId: 'zoneD', name: 'Innovation Hub' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[121.07015, 13.7861], [121.0706, 13.78632], [121.071, 13.78601], [121.07052, 13.78572], [121.07015, 13.7861]]],
      },
    },
    {
      type: 'Feature',
      properties: { zoneId: 'zoneE', name: 'Student Plaza' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[121.07095, 13.78634], [121.07138, 13.78658], [121.07183, 13.78631], [121.07138, 13.78597], [121.07095, 13.78634]]],
      },
    },
    {
      type: 'Feature',
      properties: { zoneId: 'zoneF', name: 'Sports Complex' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[121.07183, 13.78618], [121.07226, 13.78642], [121.07265, 13.78614], [121.07222, 13.78584], [121.07183, 13.78618]]],
      },
    },
  ],
};

const FALLBACK_BUILDINGS = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { id: 'b1', name: 'Main Admin', height: 18 },
      geometry: {
        type: 'Polygon',
        coordinates: [[[121.07008, 13.78648], [121.0702, 13.78656], [121.0701, 13.78668], [121.06997, 13.7866], [121.07008, 13.78648]]],
      },
    },
    {
      type: 'Feature',
      properties: { id: 'b2', name: 'Engineering Hall', height: 22 },
      geometry: {
        type: 'Polygon',
        coordinates: [[[121.0704, 13.78642], [121.07056, 13.7865], [121.07044, 13.78665], [121.07027, 13.78656], [121.0704, 13.78642]]],
      },
    },
    {
      type: 'Feature',
      properties: { id: 'b3', name: 'Library', height: 26 },
      geometry: {
        type: 'Polygon',
        coordinates: [[[121.07078, 13.78678], [121.07097, 13.78686], [121.07083, 13.78703], [121.07064, 13.78694], [121.07078, 13.78678]]],
      },
    },
  ],
};

const refs = {
  autopilot: document.getElementById('autopilot'),
  autopilotStatus: document.getElementById('autopilotStatus'),
  crowd: document.getElementById('crowd'),
  heatwave: document.getElementById('heatwave'),
  pathBlock: document.getElementById('pathBlock'),
  crowdValue: document.getElementById('crowdValue'),
  heatwaveValue: document.getElementById('heatwaveValue'),
  rushHour: document.getElementById('rushHour'),
  zoneIntelligence: document.getElementById('zoneIntelligence'),
  decisionPanel: document.getElementById('decisionPanel'),
  co2: document.getElementById('co2'),
  temp: document.getElementById('temp'),
  humidity: document.getElementById('humidity'),
  confidence: document.getElementById('confidence'),
  impactTable: document.getElementById('impactTable').querySelector('tbody'),
  predictionChart: document.getElementById('predictionChart'),
  riskList: document.getElementById('riskList'),
  scoreSustainability: document.getElementById('scoreSustainability'),
  scoreEmission: document.getElementById('scoreEmission'),
  scoreHeat: document.getElementById('scoreHeat'),
  scoreOverall: document.getElementById('scoreOverall'),
  eventLog: document.getElementById('eventLog'),
  systemFlow: document.getElementById('systemFlow'),
  predictBtn: document.getElementById('predictBtn'),
  toggleWidgets: document.getElementById('toggleWidgets'),
  toggleMetrics: document.getElementById('toggleMetrics'),
  leftPanel: document.querySelector('.panel.left'),
  rightPanel: document.querySelector('.panel.right'),
  closeLeftPanel: document.getElementById('closeLeftPanel'),
  closeRightPanel: document.getElementById('closeRightPanel'),
  metricsRow: document.querySelector('.metrics-row'),
  mode2d: document.getElementById('mode2d'),
  mode3d: document.getElementById('mode3d'),
  campusMap2D: document.getElementById('campusMap2D'),
  campusMap3D: document.getElementById('campusMap3D'),
};

init();

async function init() {
  bindControls();
  await loadGeoData();
  initGeoMaps();
  setMapMode('2d');
  connectSocket();
}

async function loadGeoData() {
  const [zones, fileBuildings] = await Promise.all([
    fetchGeoJSON('/data/zones.geojson', FALLBACK_ZONES),
    fetchGeoJSON('/data/buildings.geojson', FALLBACK_BUILDINGS),
  ]);

  const liveBuildings = await fetchBSUAlangilanBuildings();

  state.mapData.zones = zones;
  state.mapData.buildings = liveBuildings?.features?.length ? liveBuildings : fileBuildings;
}

async function fetchGeoJSON(url, fallback) {
  try {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) {
      return fallback;
    }
    return await response.json();
  } catch (_error) {
    return fallback;
  }
}

function zoneFeatures() {
  return state.mapData.zones?.features || FALLBACK_ZONES.features;
}

function buildingFeatures() {
  return state.mapData.buildings?.features || FALLBACK_BUILDINGS.features;
}

async function fetchBSUAlangilanBuildings() {
  const campusPoly = BSU_CAMPUS_BOUNDARY_LATLNG.map(([lat, lng]) => `${lat} ${lng}`).join(' ');
  const overpassQuery = `
    [out:json][timeout:30];
    (
      way["building"](poly:"${campusPoly}");
      relation["building"](poly:"${campusPoly}");
    );
    out geom;
  `;

  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: new URLSearchParams({ data: overpassQuery }).toString(),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const features = (data.elements || [])
      .filter((element) => ['way', 'relation'].includes(element.type) && Array.isArray(element.geometry))
      .map((element) => overpassElementToFeature(element))
      .filter((feature) => isFeatureInsideCampus(feature))
      .filter(Boolean);

    return {
      type: 'FeatureCollection',
      features,
    };
  } catch (_error) {
    return null;
  }
}

function overpassElementToFeature(element) {
  if (!Array.isArray(element.geometry) || element.geometry.length < 3) {
    return null;
  }

  const ring = element.geometry.map((point) => [point.lon, point.lat]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (!first || !last || first[0] !== last[0] || first[1] !== last[1]) {
    ring.push(first);
  }

  const levels = Number(element.tags?.['building:levels']);
  const explicitHeight = Number(String(element.tags?.height || '').replace('m', ''));
  const derivedHeight = Number.isFinite(explicitHeight) && explicitHeight > 0
    ? explicitHeight
    : Number.isFinite(levels) && levels > 0
      ? levels * 3.4
      : 14;

  return {
    type: 'Feature',
    properties: {
      id: `osm-${element.id}`,
      name: element.tags?.name || element.tags?.amenity || 'BSU Building',
      height: Math.round(derivedHeight),
    },
    geometry: {
      type: 'Polygon',
      coordinates: [ring],
    },
  };
}

function isFeatureInsideCampus(feature) {
  if (!feature?.geometry?.coordinates?.[0]) return false;
  const centroid = polygonCentroid(feature.geometry.coordinates[0]);
  if (!centroid) return false;
  return pointInPolygon(centroid, campusBoundaryLngLat());
}

function polygonCentroid(ring) {
  if (!Array.isArray(ring) || !ring.length) return null;
  let lng = 0;
  let lat = 0;
  for (const [x, y] of ring) {
    lng += x;
    lat += y;
  }
  return [lng / ring.length, lat / ring.length];
}

function campusBoundaryLngLat() {
  return BSU_CAMPUS_BOUNDARY_LATLNG.map(([lat, lng]) => [lng, lat]);
}

function pointInPolygon(point, polygon) {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    const intersect = yi > y !== yj > y
      && x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

function bindControls() {
  refs.autopilot.addEventListener('change', () => {
    send({ type: 'set-autopilot', enabled: refs.autopilot.checked });
  });

  refs.crowd.addEventListener('input', () => {
    refs.crowdValue.textContent = `${refs.crowd.value}%`;
    sendScenario();
  });

  refs.heatwave.addEventListener('input', () => {
    refs.heatwaveValue.textContent = `${refs.heatwave.value}%`;
    sendScenario();
  });

  refs.pathBlock.addEventListener('change', () => sendScenario());

  refs.rushHour.addEventListener('click', () => {
    send({ type: 'trigger-rush-hour' });
  });

  refs.predictBtn.addEventListener('click', () => {
    send({ type: 'predict', hours: 2 });
  });

  refs.mode2d.addEventListener('click', () => setMapMode('2d'));
  refs.mode3d.addEventListener('click', () => setMapMode('3d'));

  refs.toggleWidgets.addEventListener('click', () => {
    refs.leftPanel.classList.toggle('collapsed');
    refs.rightPanel.classList.toggle('collapsed');
  });

  refs.toggleMetrics.addEventListener('click', () => {
    refs.metricsRow.classList.toggle('hidden');
  });

  refs.closeLeftPanel.addEventListener('click', () => {
    refs.leftPanel.classList.toggle('collapsed');
  });

  refs.closeRightPanel.addEventListener('click', () => {
    refs.rightPanel.classList.toggle('collapsed');
  });
}

function initGeoMaps() {
  init2DMap();
  init3DMap();
}

function setMapMode(mode) {
  state.mapMode = mode;
  const is2d = mode === '2d';

  refs.mode2d.classList.toggle('active', is2d);
  refs.mode3d.classList.toggle('active', !is2d);
  refs.mode2d.setAttribute('aria-selected', String(is2d));
  refs.mode3d.setAttribute('aria-selected', String(!is2d));

  refs.campusMap2D.classList.toggle('hidden', !is2d);
  refs.campusMap3D.classList.toggle('hidden', is2d);

  if (is2d) {
    state.leafletMap?.invalidateSize();
  } else {
    state.map3d?.resize();
  }
}

function init2DMap() {
  if (!window.L) return;

  state.leafletMap = L.map('campusMap2D', {
    zoomControl: true,
    attributionControl: false,
  }).setView(CAMPUS_CENTER, 17.2);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 20,
    subdomains: 'abcd',
  }).addTo(state.leafletMap);

  L.polygon(BSU_CAMPUS_BOUNDARY_LATLNG, {
    color: '#6ed2ff',
    weight: 2,
    dashArray: '6 6',
    fillColor: '#2b5d83',
    fillOpacity: 0.08,
    interactive: false,
  }).addTo(state.leafletMap);

  state.leafletBuildings = L.geoJSON(
    {
      type: 'FeatureCollection',
      features: buildingFeatures(),
    },
    {
      style: {
        color: '#94b7d4',
        weight: 1,
        fillColor: '#5f7f9a',
        fillOpacity: 0.22,
      },
      interactive: false,
    }
  ).addTo(state.leafletMap);

  zoneFeatures().forEach((feature) => {
    const zoneId = feature.properties.zoneId;
    const name = feature.properties.name || zoneId.toUpperCase();
    const coords = feature.geometry.coordinates[0].map(([lng, lat]) => [lat, lng]);

    const polygon = L.polygon(coords, {
      color: '#9dffd6',
      weight: 2,
      fillColor: '#6effbe',
      fillOpacity: 0.24,
    }).addTo(state.leafletMap);

    polygon.on('click', () => {
      state.selectedZoneId = zoneId;
      renderZoneIntelligence();
    });

    state.leafletZones[zoneId] = polygon;

    const center = polygon.getBounds().getCenter();
    const label = L.marker(center, {
      interactive: false,
      icon: L.divIcon({
        className: 'leaflet-zone-label',
        html: name,
      }),
    });
    label.addTo(state.leafletMap);
    state.leafletLabels.push(label);
  });

  const bounds = getCampusBounds();
  if (bounds) {
    state.leafletMap.fitBounds(bounds, { padding: [24, 24] });
  }
}


function init3DMap() {
  if (!window.maplibregl) return;

  state.map3d = new maplibregl.Map({
    container: 'campusMap3D',
    style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    center: [CAMPUS_CENTER[1], CAMPUS_CENTER[0]],
    zoom: 16.7,
    pitch: 58,
    bearing: 24,
    antialias: true,
  });

  state.map3d.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

  state.map3d.on('load', () => {
    state.map3dReady = true;

    state.map3d.addSource('campus-boundary', {
      type: 'geojson',
      data: buildCampusBoundaryGeoJSON(),
    });

    state.map3d.addLayer({
      id: 'campus-boundary-fill',
      type: 'fill',
      source: 'campus-boundary',
      paint: {
        'fill-color': '#2b5d83',
        'fill-opacity': 0.09,
      },
    });

    state.map3d.addLayer({
      id: 'campus-boundary-line',
      type: 'line',
      source: 'campus-boundary',
      paint: {
        'line-color': '#7ed6ff',
        'line-width': 2,
        'line-dasharray': [2, 2],
      },
    });

    state.map3d.addSource('campus-buildings', {
      type: 'geojson',
      data: buildMap3DBuildingsGeoJSON(),
    });

    state.map3d.addLayer({
      id: 'campus-buildings-extrusion',
      type: 'fill-extrusion',
      source: 'campus-buildings',
      paint: {
        'fill-extrusion-color': '#4b6578',
        'fill-extrusion-opacity': 0.52,
        'fill-extrusion-height': ['coalesce', ['get', 'height'], 16],
      },
    });

    state.map3d.addSource('campus-zones', {
      type: 'geojson',
      data: buildMap3DGeoJSON(),
    });

    state.map3d.addLayer({
      id: 'campus-zones-extrusion',
      type: 'fill-extrusion',
      source: 'campus-zones',
      paint: {
        'fill-extrusion-color': [
          'match',
          ['get', 'status'],
          'critical',
          '#ff7c98',
          'moderate',
          '#ffd36e',
          '#6effbe',
        ],
        'fill-extrusion-opacity': 0.8,
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': 0,
      },
    });

    state.map3d.addLayer({
      id: 'campus-zones-outline',
      type: 'line',
      source: 'campus-zones',
      paint: {
        'line-color': '#d8f2ff',
        'line-width': 1.6,
      },
    });

    state.map3d.on('click', 'campus-zones-extrusion', (event) => {
      const zoneId = event.features?.[0]?.properties?.zoneId;
      if (!zoneId) return;
      state.selectedZoneId = zoneId;
      renderZoneIntelligence();
    });

    state.map3d.on('mouseenter', 'campus-zones-extrusion', () => {
      state.map3d.getCanvas().style.cursor = 'pointer';
    });

    state.map3d.on('mouseleave', 'campus-zones-extrusion', () => {
      state.map3d.getCanvas().style.cursor = '';
    });

    state.map3d.setFog({
      color: 'rgb(9, 23, 37)',
      'high-color': 'rgb(16, 49, 72)',
      'horizon-blend': 0.22,
      'space-color': 'rgb(3, 8, 17)',
      'star-intensity': 0.0,
    });

    if (state.map3d.getLayer('water')) {
      state.map3d.setPaintProperty('water', 'fill-color', '#0f2436');
    }

    const bounds = getCampusBounds();
    if (bounds) {
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      state.map3d.fitBounds(
        [
          [sw.lng, sw.lat],
          [ne.lng, ne.lat],
        ],
        { padding: 40, duration: 0 }
      );
    }
  });
}

function getCampusBounds() {
  const features = zoneFeatures();
  if (!features.length || !window.L) return null;

  const points = features
    .flatMap((feature) => feature.geometry?.coordinates?.[0] || [])
    .map(([lng, lat]) => [lat, lng]);

  if (!points.length) return null;
  return L.latLngBounds(points);
}

function buildMap3DGeoJSON() {
  const zones = state.snapshot?.zones || [];
  const fallbackStatusById = zones.reduce((acc, zone) => {
    acc[zone.id] = zone.status;
    return acc;
  }, {});

  return {
    type: 'FeatureCollection',
    features: zoneFeatures().map((feature) => {
      const zoneId = feature.properties.zoneId;
      const sourceZone = zones.find((z) => z.id === zoneId);
      const risk = sourceZone?.risk ?? 0.3;
      const status = fallbackStatusById[zoneId] || 'safe';

      return {
        type: 'Feature',
        properties: {
          zoneId,
          status,
          height: 25 + Math.round(risk * 110),
        },
        geometry: feature.geometry,
      };
    }),
  };
}

function buildCampusBoundaryGeoJSON() {
  const ring = campusBoundaryLngLat();
  ring.push(ring[0]);
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: 'BSU Alangilan Campus' },
        geometry: {
          type: 'Polygon',
          coordinates: [ring],
        },
      },
    ],
  };
}

function buildMap3DBuildingsGeoJSON() {
  return {
    type: 'FeatureCollection',
    features: buildingFeatures().map((feature) => ({
      type: 'Feature',
      properties: {
        ...feature.properties,
        height: feature.properties?.height ?? 16,
      },
      geometry: feature.geometry,
    })),
  };
}
function connectSocket() {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  state.ws = new WebSocket(`${protocol}://${location.host}`);

  state.ws.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'snapshot') {
      state.snapshot = data.payload;
      render();
    }
    if (data.type === 'prediction') {
      if (state.snapshot) {
        state.snapshot.prediction = data.payload;
      }
      renderPrediction();
      renderRiskList();
    }
  });

  state.ws.addEventListener('close', () => {
    setTimeout(connectSocket, 1000);
  });
}

function send(payload) {
  if (state.ws?.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify(payload));
  }
}

function sendScenario() {
  send({
    type: 'set-scenario',
    payload: {
      crowd: Number(refs.crowd.value),
      heatwave: Number(refs.heatwave.value),
      pathBlock: refs.pathBlock.checked,
    },
  });
}

function render() {
  if (!state.snapshot) return;

  renderTopState();
  renderMap();
  renderMetrics();
  renderZoneIntelligence();
  renderDecisionPanel();
  renderImpact();
  renderPrediction();
  renderRiskList();
  renderScore();
  renderLog();

  refs.systemFlow.textContent = state.snapshot.flow;
}

function renderTopState() {
  const { autopilot, systemStatus, scenario } = state.snapshot;
  refs.autopilot.checked = autopilot;
  refs.autopilotStatus.textContent = systemStatus;
  refs.autopilotStatus.className = `chip ${autopilot ? 'good' : 'warn'}`;

  refs.crowd.value = scenario.crowd;
  refs.heatwave.value = scenario.heatwave;
  refs.pathBlock.checked = scenario.pathBlock;
  refs.crowdValue.textContent = `${scenario.crowd}%`;
  refs.heatwaveValue.textContent = `${scenario.heatwave}%`;
}

function renderMap() {
  render2DZoneStyles();
  render3DZoneStyles();
}

function render2DZoneStyles() {
  if (!state.leafletMap) return;

  state.snapshot.zones.forEach((zone) => {
    const polygon = state.leafletZones[zone.id];
    if (!polygon) return;

    const style = styleForZoneStatus(zone.status);
    polygon.setStyle(style);
  });
}

function render3DZoneStyles() {
  if (!state.map3dReady || !state.map3d?.getSource('campus-zones')) return;
  state.map3d.getSource('campus-zones').setData(buildMap3DGeoJSON());
}

function styleForZoneStatus(status) {
  if (status === 'critical') {
    return {
      color: '#ff9bb3',
      weight: 2,
      fillColor: '#ff7993',
      fillOpacity: 0.36,
    };
  }

  if (status === 'moderate') {
    return {
      color: '#ffe0a2',
      weight: 2,
      fillColor: '#ffd36e',
      fillOpacity: 0.32,
    };
  }

  return {
    color: '#9dffd6',
    weight: 2,
    fillColor: '#6effbe',
    fillOpacity: 0.28,
  };
}

function renderMetrics() {
  const { campus, ai } = state.snapshot;
  refs.co2.textContent = `${Math.round(campus.avgCo2)} ppm`;
  refs.temp.textContent = `${campus.avgTemperature.toFixed(1)} °C`;
  refs.humidity.textContent = `${Math.round(campus.avgHumidity)} %`;
  refs.confidence.textContent = `${ai.confidence.toFixed(1)} %`;
}

function renderZoneIntelligence() {
  const selected =
    state.snapshot?.zones.find((zone) => zone.id === state.selectedZoneId) ||
    state.snapshot?.zones.reduce((a, b) => (a.risk > b.risk ? a : b), state.snapshot?.zones[0]);

  if (!selected) return;

  refs.zoneIntelligence.innerHTML = `
    <strong>${selected.name}</strong>
    <div>CO₂: ${selected.co2} ppm</div>
    <div>Temp: ${selected.temperature.toFixed(1)}°C</div>
    <div>Humidity: ${selected.humidity}%</div>
    <div>Crowd Density: ${selected.crowdDensity}%</div>
    <div>Airflow: ${selected.airflow}%</div>
    <p style="margin:8px 0 0;color:#aed5ef;">AI Insight: This zone is experiencing a ${selected.status} state driven by density + airflow coupling.</p>
  `;
}

function renderDecisionPanel() {
  const decision = state.snapshot.ai.latestDecision;
  if (!decision) {
    refs.decisionPanel.textContent = 'Decision engine warming up...';
    return;
  }

  const actions = (decision.recommendedActions || [])
    .map(
      (action) => `
      <div class="action-row">
        <div>
          <strong>${action.label}</strong>
          <div>Expected: CO₂ ${action.expectedDelta?.co2Delta ?? 0} ppm, Temp ${action.expectedDelta?.tempDelta ?? 0}°C, ETA ${action.expectedDelta?.etaMin ?? action.expected?.timeMin ?? '-'} min</div>
        </div>
        <button class="action-btn" data-action="${action.id}">Run</button>
      </div>`
    )
    .join('');

  refs.decisionPanel.innerHTML = `
    <div><strong>Target Zone:</strong> ${decision.zoneName}</div>
    <div><strong>Root Cause:</strong> ${decision.rootCause}</div>
    <div><strong>Why this?</strong> ${decision.explanation}</div>
    <ul>
      <li>${decision.insight}</li>
    </ul>
    ${actions || '<p>No intervention needed in this cycle.</p>'}
  `;

  refs.decisionPanel.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      send({ type: 'manual-action', actionId: btn.getAttribute('data-action') });
    });
  });
}

function renderImpact() {
  const impact = state.snapshot.impact;
  if (!impact) {
    refs.impactTable.innerHTML = `
      <tr><td>CO₂</td><td>--</td><td>--</td></tr>
      <tr><td>Temp</td><td>--</td><td>--</td></tr>
      <tr><td>Crowd</td><td>--</td><td>--</td></tr>
    `;
    return;
  }

  refs.impactTable.innerHTML = `
    <tr><td>CO₂</td><td>${impact.before.co2} ppm</td><td>${impact.after.co2} ppm</td></tr>
    <tr><td>Temp</td><td>${impact.before.temperature}°C</td><td>${impact.after.temperature}°C</td></tr>
    <tr><td>Crowd</td><td>${impact.before.crowdDensity}%</td><td>${impact.after.crowdDensity}%</td></tr>
  `;
}

function renderPrediction() {
  const prediction = state.snapshot.prediction;
  if (!prediction?.points?.length) return;

  const canvas = refs.predictionChart;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const values = prediction.points.map((p) => p.co2);
  const min = Math.min(...values) - 40;
  const max = Math.max(...values) + 40;

  drawGrid(ctx, canvas.width, canvas.height);

  ctx.strokeStyle = '#74d8ff';
  ctx.lineWidth = 2;
  ctx.beginPath();

  prediction.points.forEach((point, index) => {
    const x = 20 + (index * (canvas.width - 40)) / (prediction.points.length - 1 || 1);
    const y = map(point.co2, min, max, canvas.height - 22, 18);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = '#b4e4ff';
  ctx.font = '11px Inter';
  ctx.fillText('Predicted CO₂ trajectory', 10, 14);
}

function renderRiskList() {
  const risks = state.snapshot.prediction?.risks || [];
  refs.riskList.innerHTML = risks.length
    ? risks.map((r) => `<li><strong>${r.level.toUpperCase()}</strong> · ${r.message}</li>`).join('')
    : '<li>No critical forecast for the next 2 hours.</li>';
}

function renderScore() {
  const score = state.snapshot.score || {};
  refs.scoreSustainability.textContent = score.sustainability ?? '--';
  refs.scoreEmission.textContent = score.emissionTrend ?? '--';
  refs.scoreHeat.textContent = score.heatReduction ?? '--';
  refs.scoreOverall.textContent = score.overall ?? '--';
}

function renderLog() {
  const logs = state.snapshot.ai.logs || [];
  refs.eventLog.innerHTML = logs
    .slice(0, 10)
    .map((log) => `<li><strong>${log.time}</strong> — ${log.message}</li>`)
    .join('');
}

function drawGrid(ctx, width, height) {
  ctx.strokeStyle = 'rgba(130, 190, 225, 0.22)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 5; i += 1) {
    const y = (height / 5) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function map(value, inMin, inMax, outMin, outMax) {
  const normalized = (value - inMin) / (inMax - inMin || 1);
  return outMin + normalized * (outMax - outMin);
}
