const state = {
  snapshot: null,
  selectedZoneId: null,
  selectedBuildingId: null,
  mapFilter: 'none',
  ws: null,
  mapMode: '2d',
  mapData: {
    zones: null,
    buildings: null,
  },
  buildingZoneMap: {},
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

const MOCK_SNAPSHOT = {
  campus: {
    avgCo2: 912,
    avgTemperature: 30.4,
    avgHumidity: 63,
    avgRisk: 0.58,
  },
  zones: [
    { id: 'zoneA', name: 'Engineering Block', co2: 1260, temperature: 33.6, humidity: 70, crowdDensity: 84, risk: 0.79, status: 'critical' },
    { id: 'zoneB', name: 'Library Commons', co2: 960, temperature: 30.3, humidity: 62, crowdDensity: 58, risk: 0.54, status: 'moderate' },
    { id: 'zoneC', name: 'Central Cafeteria', co2: 1420, temperature: 34.8, humidity: 72, crowdDensity: 92, risk: 0.86, status: 'critical' },
    { id: 'zoneD', name: 'Innovation Hub', co2: 820, temperature: 28.6, humidity: 57, crowdDensity: 44, risk: 0.42, status: 'moderate' },
    { id: 'zoneE', name: 'Student Plaza', co2: 760, temperature: 27.4, humidity: 54, crowdDensity: 33, risk: 0.29, status: 'safe' },
    { id: 'zoneF', name: 'Sports Complex', co2: 690, temperature: 26.8, humidity: 51, crowdDensity: 26, risk: 0.21, status: 'safe' },
  ],
  ai: {
    confidence: 84.2,
    latestDecision: {
      rootCause: 'Localized heat + crowd concentration around high-traffic corridors.',
      insight: 'Model recommends ventilation-first mitigation while preserving circulation throughput.',
      recommendedActions: [{ label: 'Open ventilation corridor' }],
    },
  },
  impact: null,
};

const refs = {
  mode2d: document.getElementById('mode2d'),
  mode3d: document.getElementById('mode3d'),
  filterToggle: document.getElementById('filterToggle'),
  filterMenu: document.getElementById('filterMenu'),
  filterOptions: Array.from(document.querySelectorAll('.filter-option')),
  campusMap2D: document.getElementById('campusMap2D'),
  campusMap3D: document.getElementById('campusMap3D'),
  leftWidgetContent: document.getElementById('leftWidgetContent'),
};

init();

async function init() {
  bindControls();
  await loadGeoData();
  state.snapshot = structuredClone(MOCK_SNAPSHOT);
  initGeoMaps();
  setMapMode('2d');
  setMapFilter(state.mapFilter);
  connectSocket();
  render();
}

function bindControls() {
  refs.mode2d.addEventListener('click', () => setMapMode('2d'));
  refs.mode3d.addEventListener('click', () => setMapMode('3d'));
  refs.filterToggle?.addEventListener('click', toggleFilterMenu);
  refs.filterOptions.forEach((button) => {
    button.addEventListener('click', () => {
      setMapFilter(button.dataset.filter);
      refs.filterMenu?.classList.remove('open');
    });
  });
  document.addEventListener('click', handleOutsideFilterMenuClick);
}

function setMapFilter(filter) {
  state.mapFilter = filter || 'none';

  refs.filterOptions.forEach((button) => {
    const active = button.dataset.filter === state.mapFilter;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });

  renderMap();
}

function toggleFilterMenu() {
  refs.filterMenu?.classList.toggle('open');
}

function handleOutsideFilterMenuClick(event) {
  if (!refs.filterMenu || !refs.filterToggle) return;
  const insideMenu = refs.filterMenu.contains(event.target);
  const insideToggle = refs.filterToggle.contains(event.target);
  if (!insideMenu && !insideToggle) refs.filterMenu.classList.remove('open');
}

async function loadGeoData() {
  const [zones, fileBuildings] = await Promise.all([
    fetchGeoJSON('/data/zones.geojson', FALLBACK_ZONES),
    fetchGeoJSON('/data/buildings.geojson', FALLBACK_BUILDINGS),
  ]);

  const liveBuildings = await fetchBSUAlangilanBuildings();
  state.mapData.zones = zones;
  state.mapData.buildings = liveBuildings?.features?.length ? liveBuildings : fileBuildings;
  state.buildingZoneMap = deriveBuildingZoneMap();
}

async function fetchGeoJSON(url, fallback) {
  try {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) return fallback;
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

function deriveBuildingZoneMap() {
  const map = {};
  const zones = zoneFeatures();

  buildingFeatures().forEach((building) => {
    const centroid = polygonCentroid(building.geometry?.coordinates?.[0] || []);
    const zone = zones.find((z) => pointInPolygon(centroid, z.geometry?.coordinates?.[0] || []));
    map[building.properties.id] = zone?.properties?.zoneId || null;
  });

  return map;
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

    if (!response.ok) return null;

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
  if (!Array.isArray(element.geometry) || element.geometry.length < 3) return null;

  const ring = element.geometry.map((point) => [point.lon, point.lat]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (!first || !last || first[0] !== last[0] || first[1] !== last[1]) ring.push(first);

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
  if (!point || !Array.isArray(polygon) || !polygon.length) return false;
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

  if (is2d) state.leafletMap?.invalidateSize();
  else state.map3d?.resize();
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
      style: (feature) => buildingLayerStyle(feature?.properties?.id),
      onEachFeature: (feature, layer) => {
        layer.on('click', (event) => {
          L.DomEvent.stopPropagation(event);
          selectBuilding(feature.properties.id, state.buildingZoneMap[feature.properties.id]);
        });
      },
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

    polygon.on('click', (event) => {
      L.DomEvent.stopPropagation(event);
      const building = buildingFeatures().find((b) => state.buildingZoneMap[b.properties.id] === zoneId);
      selectBuilding(building?.properties?.id || null, zoneId);
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

  state.leafletMap.on('click', clearSelection);

  const bounds = getCampusBounds();
  if (bounds) state.leafletMap.fitBounds(bounds, { padding: [24, 24] });
}

function buildingLayerStyle(buildingId) {
  const selected = state.selectedBuildingId && state.selectedBuildingId === buildingId;
  const metricStatus = statusForBuilding(buildingId);
  const palette = filterPalette(state.mapFilter, metricStatus);

  return {
    color: selected ? '#6effbe' : palette.stroke,
    weight: selected ? 3 : 1,
    fillColor: selected ? '#6effbe' : palette.fill,
    fillOpacity: selected ? 0.34 : 0.22,
    className: selected ? 'map-building-selected' : '',
  };
}

function init3DMap() {
  // Replace MapLibre 3D map with Mapbox GL + Three.js GLB custom layer.
  if (!window.mapboxgl || !window.THREE) return;

  // Token must be injected at runtime (index.html) to avoid committing secrets.
  mapboxgl.accessToken = window.MAPBOX_TOKEN || '';

  const modelOrigin = [121.07421871661094, 13.784333530392153];
  const modelAltitude = 0;
  const modelRotate = [Math.PI / 2, 0, Math.PI / 2];

  // Meter offsets (tune as needed)
  const offsetX = 0;
  const offsetY = -100;

  const modelAsMercatorCoordinate = mapboxgl.MercatorCoordinate.fromLngLat(modelOrigin, modelAltitude);
  const meterUnits = modelAsMercatorCoordinate.meterInMercatorCoordinateUnits();

  const modelTransform = {
    translateX: modelAsMercatorCoordinate.x + offsetX * meterUnits,
    // Mercator Y increases southward
    translateY: modelAsMercatorCoordinate.y - offsetY * meterUnits,
    translateZ: modelAsMercatorCoordinate.z,
    rotateX: modelRotate[0],
    rotateY: modelRotate[1],
    rotateZ: modelRotate[2],
    scale: meterUnits,
  };

  state.map3dReady = false;
  state.map3d = new mapboxgl.Map({
    container: 'campusMap3D',
    style: 'mapbox://styles/mapbox/dark-v11',
    zoom: 17,
    center: modelOrigin,
    pitch: 60,
    bearing: 0,
    antialias: true,
  });

  state.map3d.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');

  const customLayer = {
    id: 'bsu-glb-overlay',
    type: 'custom',
    renderingMode: '3d',
    onAdd: function (map, gl) {
      this.camera = new THREE.Camera();
      this.scene = new THREE.Scene();

      const directionalLight = new THREE.DirectionalLight(0xffffff);
      directionalLight.position.set(0, -70, 100).normalize();
      this.scene.add(directionalLight);

      const directionalLight2 = new THREE.DirectionalLight(0xffffff);
      directionalLight2.position.set(0, 70, 100).normalize();
      this.scene.add(directionalLight2);

      this.scene.add(new THREE.AmbientLight(0xffffff, 0.4));

      const loader = new THREE.GLTFLoader();
      // Place your GLB in Verdent/public/models/ and load it from there.
      loader.load(
        '/models/bsu-model.glb',
        (gltf) => {
          this.scene.add(gltf.scene);
        },
        undefined,
        (error) => {
          // eslint-disable-next-line no-console
          console.error('An error happened loading the GLB:', error);
        }
      );

      this.map = map;

      this.renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true,
      });
      this.renderer.autoClear = false;
    },
    render: function (gl, matrix) {
      const rotationX = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(1, 0, 0), modelTransform.rotateX);
      const rotationY = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(0, 1, 0), modelTransform.rotateY);
      const rotationZ = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(0, 0, 1), modelTransform.rotateZ);

      const m = new THREE.Matrix4().fromArray(matrix);
      const l = new THREE.Matrix4()
        .makeTranslation(modelTransform.translateX, modelTransform.translateY, modelTransform.translateZ)
        .scale(new THREE.Vector3(modelTransform.scale, -modelTransform.scale, modelTransform.scale))
        .multiply(rotationX)
        .multiply(rotationY)
        .multiply(rotationZ);

      this.camera.projectionMatrix = m.multiply(l);
      this.renderer.resetState();
      this.renderer.render(this.scene, this.camera);
      this.map.triggerRepaint();
    },
  };

  state.map3d.on('style.load', () => {
    state.map3dReady = true;
    try {
      state.map3d.addLayer(customLayer);
    } catch (_e) {
      // ignore if already added
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
        metricStatus: statusForBuilding(feature.properties?.id),
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
  });

  state.ws.addEventListener('close', () => {
    setTimeout(connectSocket, 1000);
  });
}

function render() {
  renderMap();
  renderLeftWidget();
}

function renderMap() {
  render2DZoneStyles();
  render3DZoneStyles();
  if (state.leafletBuildings) {
    state.leafletBuildings.setStyle((feature) => buildingLayerStyle(feature?.properties?.id));
  }
}

function render2DZoneStyles() {
  if (!state.leafletMap || !state.snapshot) return;

  state.snapshot.zones.forEach((zone) => {
    const polygon = state.leafletZones[zone.id];
    if (!polygon) return;
    const style = styleForZoneStatus(zone.status);
    polygon.setStyle({
      ...style,
      weight: state.selectedZoneId === zone.id ? style.weight + 1 : style.weight,
    });
  });
}

function render3DZoneStyles() {
  if (!state.map3dReady || !state.map3d?.getSource('campus-zones')) return;
  state.map3d.getSource('campus-zones').setData(buildMap3DGeoJSON());
  if (state.map3d?.getSource('campus-buildings')) {
    state.map3d.getSource('campus-buildings').setData(buildMap3DBuildingsGeoJSON());
  }

  if (state.map3d.getLayer('campus-buildings-extrusion')) {
    const palette = {
      safe: filterPalette(state.mapFilter, 'safe').fill,
      moderate: filterPalette(state.mapFilter, 'moderate').fill,
      critical: filterPalette(state.mapFilter, 'critical').fill,
    };

    state.map3d.setPaintProperty(
      'campus-buildings-extrusion',
      'fill-extrusion-color',
      [
        'case',
        ['==', ['get', 'id'], state.selectedBuildingId || ''],
        '#6effbe',
        ['match', ['get', 'metricStatus'], 'critical', palette.critical, 'moderate', palette.moderate, palette.safe],
      ]
    );
    state.map3d.setPaintProperty(
      'campus-buildings-extrusion',
      'fill-extrusion-opacity',
      ['case', ['==', ['get', 'id'], state.selectedBuildingId || ''], 0.88, 0.52]
    );
  }

  if (state.map3d.getLayer('campus-buildings-highlight')) {
    state.map3d.setFilter('campus-buildings-highlight', ['==', ['get', 'id'], state.selectedBuildingId || '']);
  }
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

function statusPalette(status) {
  if (status === 'critical') {
    return { fill: '#ff7993', stroke: '#ff9bb3' };
  }
  if (status === 'moderate') {
    return { fill: '#ffd36e', stroke: '#ffe0a2' };
  }
  return { fill: '#6effbe', stroke: '#9dffd6' };
}

function filterPalette(filter, status) {
  const palettes = {
    temperature: {
      safe: { fill: '#59d5ff', stroke: '#9ee8ff' },
      moderate: { fill: '#ffd36e', stroke: '#ffe4a9' },
      critical: { fill: '#ff8ea1', stroke: '#ffb6c4' },
    },
    humidity: {
      safe: { fill: '#6effbe', stroke: '#a7ffd7' },
      moderate: { fill: '#79c8ff', stroke: '#a6ddff' },
      critical: { fill: '#c08bff', stroke: '#dbbaff' },
    },
    crowd: {
      safe: { fill: '#6ee5ff', stroke: '#9ef1ff' },
      moderate: { fill: '#ffb56e', stroke: '#ffd0a8' },
      critical: { fill: '#ff7c98', stroke: '#ffb0c1' },
    },
    co2: {
      safe: { fill: '#6effbe', stroke: '#a7ffd7' },
      moderate: { fill: '#ffd36e', stroke: '#ffe6b3' },
      critical: { fill: '#ff64b2', stroke: '#ff9dd2' },
    },
  };

  return palettes[filter]?.[status] || statusPalette(status);
}

function statusForBuilding(buildingId) {
  const zone = zoneForBuilding(buildingId);
  if (!zone) return 'moderate';
  return metricStatusForZone(zone, state.mapFilter);
}

function zoneForBuilding(buildingId) {
  const zoneId = state.buildingZoneMap[buildingId];
  if (!zoneId) return null;
  return state.snapshot?.zones?.find((zone) => zone.id === zoneId) || null;
}

function metricStatusForZone(zone, filter) {
  if (!zone) return 'moderate';
  if (filter === 'none') return zone.status || 'moderate';

  const zones = state.snapshot?.zones || [];
  if (!zones.length) return zone.status || 'moderate';

  const scores = zones.map((item) => metricScoreForZone(item, filter));
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const span = max - min;
  if (!Number.isFinite(span) || span < 0.01) return zone.status || 'moderate';

  const normalized = (metricScoreForZone(zone, filter) - min) / span;
  if (normalized >= 0.67) return 'critical';
  if (normalized >= 0.34) return 'moderate';
  return 'safe';
}

function metricScoreForZone(zone, filter) {
  if (filter === 'co2') return Number(zone.co2 || 0);
  if (filter === 'temperature') return Number(zone.temperature || 0);
  if (filter === 'humidity') return Math.abs(Number(zone.humidity || 0) - 50);
  if (filter === 'crowd') return Number(zone.crowdDensity || 0);
  return Number(zone.risk || 0);
}

function selectBuilding(buildingId, zoneId) {
  state.selectedBuildingId = buildingId;
  state.selectedZoneId = zoneId || null;
  render();
}

function clearSelection() {
  if (!state.selectedZoneId && !state.selectedBuildingId) return;
  state.selectedZoneId = null;
  state.selectedBuildingId = null;
  render();
}

function renderLeftWidget() {
  if (!refs.leftWidgetContent) return;

  refs.leftWidgetContent.classList.add('switching');
  setTimeout(() => {
    refs.leftWidgetContent.innerHTML = state.selectedBuildingId ? buildingOverviewMarkup() : campusOverviewMarkup();
    refs.leftWidgetContent.classList.remove('switching');

    const openTwin3d = document.getElementById('openTwin3d');
    if (openTwin3d) openTwin3d.addEventListener('click', () => setMapMode('3d'));
  }, 120);
}


function campusOverviewMarkup() {
  const decision = state.snapshot?.ai?.latestDecision;
  const confidence = state.snapshot?.ai?.confidence ?? 0;
  const campus = state.snapshot?.campus || {};
  const avgCrowd = averageCrowdDensity();
  const co2 = Number(campus.avgCo2);
  const temp = Number(campus.avgTemperature);
  const humidity = Number(campus.avgHumidity);

  return `
    <div class="widget-header">
      <h2>Campus Overview</h2>
      <p class="widget-subtitle">${new Date().toLocaleTimeString()} · Live Monitoring</p>
    </div>

    <h3>Live Campus Status</h3>
    <div class="widget-metric-grid">
      <article class="metric widget-metric-card">
        <span>Co2 Level</span>
        <strong>${Number.isFinite(co2) ? `${Math.round(co2)} ppm` : '-- ppm'}</strong>
      </article>
      <article class="metric widget-metric-card">
        <span>Temperature</span>
        <strong>${Number.isFinite(temp) ? `${temp.toFixed(1)} °C` : '-- °C'}</strong>
      </article>
      <article class="metric widget-metric-card">
        <span>Humidity</span>
        <strong>${Number.isFinite(humidity) ? `${Math.round(humidity)} %` : '-- %'}</strong>
      </article>
      <article class="metric widget-metric-card">
        <span>Crowd Density</span>
        <strong>${Number.isFinite(avgCrowd) ? `${crowdLevel(avgCrowd)} · ${Math.round(avgCrowd)}%` : '--'}</strong>
      </article>
    </div>

    <h3>AI Insights</h3>

    <article class="box">
      <div><strong>Root Cause:</strong> ${decision?.rootCause || 'AI model is calibrating current campus conditions.'}</div>
      <div style="margin-top:6px;"><strong>Selected Action:</strong> ${decision?.recommendedActions?.[0]?.label || 'No active intervention selected.'}</div>
      <div style="margin-top:6px;"><strong>Confidence:</strong> ${confidence.toFixed(1)}%</div>
      <p style="margin:8px 0 0;color:#aed5ef;">${decision?.insight || 'High crowd density detected in a key zone. Ventilation corridor adjusted automatically.'}</p>
    </article>

    <div class="widget-btn-row">
      <a href="/simulate.html" class="btn widget-cta-btn">Simulate Rush Hour</a>
      <a href="/report.html" class="btn widget-cta-btn">View Full Report</a>
    </div>
  `;
}

function buildingOverviewMarkup() {
  const zone = selectedZone();
  const building = selectedBuilding();
  const decision = state.snapshot?.ai?.latestDecision;
  const impact = resolveImpactForZone(zone, decision);

  const co2 = Number(zone?.co2);
  const temperature = Number(zone?.temperature);
  const humidity = Number(zone?.humidity);
  const crowdDensity = Number(zone?.crowdDensity);

  return `
    <div class="building-banner">
      <div>
        <h2 style="margin:0;">${building?.properties?.name || zone?.name || 'Building'} Overview</h2>
        <p class="widget-subtitle" style="margin-bottom:0;">Focused environmental status</p>
      </div>
    </div>

    <section class="box twin-section">
      <h3>3D Digital Twin</h3>
      <div class="digital-twin-frame">
        <div class="digital-twin-model" aria-hidden="true">
          <div class="digital-twin-core"></div>
        </div>
        <div class="digital-twin-meta">Synced with live telemetry · ${state.mapMode === '3d' ? '3D map active' : 'Click below for 3D view'}</div>
        <button id="openTwin3d" class="action-btn">Open 3D Map</button>
      </div>
    </section>

    <h3>Key Metrics</h3>
    <div class="widget-metric-grid">
      <article class="metric widget-metric-card">
        <span>Co2 Level</span>
        <strong>${Number.isFinite(co2) ? `${Math.round(co2)} ppm` : '-- ppm'}</strong>
      </article>
      <article class="metric widget-metric-card">
        <span>Temperature</span>
        <strong>${Number.isFinite(temperature) ? `${temperature.toFixed(1)} °C` : '-- °C'}</strong>
      </article>
      <article class="metric widget-metric-card">
        <span>Humidity</span>
        <strong>${Number.isFinite(humidity) ? `${Math.round(humidity)} %` : '-- %'}</strong>
      </article>
      <article class="metric widget-metric-card">
        <span>Crowd Density</span>
        <strong>${Number.isFinite(crowdDensity) ? `${crowdLevel(crowdDensity)} · ${Math.round(crowdDensity)}%` : '--'}</strong>
      </article>
    </div>

    <article class="impact-alert">
      ⚠ This zone is experiencing a heat + emission spike due to crowd concentration and environmental factors.
    </article>

    <h3>Impact Analysis</h3>
    <div class="impact-change-grid">
      <article class="box impact-change-card">
        <span>Co2 Change</span>
        <strong class="${impact.delta.co2 <= 0 ? 'delta-down' : 'delta-up'}">${impact.delta.co2 <= 0 ? '↓' : '↑'} ${formatSigned(impact.delta.co2)} ppm</strong>
      </article>
      <article class="box impact-change-card">
        <span>Temperature Change</span>
        <strong class="${impact.delta.temperature <= 0 ? 'delta-down' : 'delta-up'}">${impact.delta.temperature <= 0 ? '↓' : '↑'} ${formatSigned(impact.delta.temperature, 1)} °C</strong>
      </article>
    </div>

    <table class="impact-table compact-impact">
      <thead>
        <tr>
          <th>Metric</th>
          <th>Before</th>
          <th>After</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Co2</td>
          <td>${Math.round(impact.before.co2)} ppm</td>
          <td>${Math.round(impact.after.co2)} ppm</td>
        </tr>
        <tr>
          <td>Temperature</td>
          <td>${impact.before.temperature.toFixed(1)} °C</td>
          <td>${impact.after.temperature.toFixed(1)} °C</td>
        </tr>
        <tr>
          <td>Crowd Density</td>
          <td>${Math.round(impact.before.crowdDensity)}%</td>
          <td>${Math.round(impact.after.crowdDensity)}%</td>
        </tr>
        <tr>
          <td>Humidity</td>
          <td>${Math.round(impact.before.humidity)}%</td>
          <td>${Math.round(impact.after.humidity)}%</td>
        </tr>
      </tbody>
    </table>
  `;
}

function resolveImpactForZone(zone, decision) {
  const current = {
    co2: Number(zone?.co2) || 0,
    temperature: Number(zone?.temperature) || 0,
    crowdDensity: Number(zone?.crowdDensity) || 0,
    humidity: Number(zone?.humidity) || 0,
  };

  const liveImpact = state.snapshot?.impact;
  if (liveImpact && liveImpact.zoneId && zone?.id && liveImpact.zoneId === zone.id) {
    return {
      actionLabel: liveImpact.actionLabel,
      before: {
        co2: Number(liveImpact.before?.co2 ?? current.co2),
        temperature: Number(liveImpact.before?.temperature ?? current.temperature),
        crowdDensity: Number(liveImpact.before?.crowdDensity ?? current.crowdDensity),
        humidity: current.humidity,
      },
      after: {
        co2: Number(liveImpact.after?.co2 ?? current.co2),
        temperature: Number(liveImpact.after?.temperature ?? current.temperature),
        crowdDensity: Number(liveImpact.after?.crowdDensity ?? current.crowdDensity),
        humidity: current.humidity,
      },
      delta: {
        co2: Number(liveImpact.delta?.co2 ?? 0),
        temperature: Number(liveImpact.delta?.temperature ?? 0),
        crowdDensity: Number(liveImpact.delta?.crowdDensity ?? 0),
      },
    };
  }

  const projected = decision?.recommendedActions?.[0]?.expectedDelta;
  if (projected) {
    return {
      actionLabel: decision?.recommendedActions?.[0]?.label,
      before: {
        co2: current.co2 - Number(projected.co2Delta || 0),
        temperature: current.temperature - Number(projected.tempDelta || 0),
        crowdDensity: current.crowdDensity,
        humidity: current.humidity - Number(projected.humidityDelta || 0),
      },
      after: current,
      delta: {
        co2: Number(projected.co2Delta || 0),
        temperature: Number(projected.tempDelta || 0),
        crowdDensity: Number(projected.crowdDensityDelta || 0),
      },
    };
  }

  return {
    actionLabel: null,
    before: current,
    after: current,
    delta: {
      co2: 0,
      temperature: 0,
      crowdDensity: 0,
    },
  };
}

function formatSigned(value, precision = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '0';
  return numeric > 0 ? `+${numeric.toFixed(precision)}` : numeric.toFixed(precision);
}

function selectedZone() {
  if (!state.selectedZoneId) return null;
  return state.snapshot?.zones?.find((zone) => zone.id === state.selectedZoneId) || null;
}

function selectedBuilding() {
  if (!state.selectedBuildingId) return null;
  return buildingFeatures().find((building) => building.properties.id === state.selectedBuildingId) || null;
}

function highestRiskZone() {
  const zones = state.snapshot?.zones || [];
  if (!zones.length) return null;
  return zones.reduce((a, b) => (a.risk > b.risk ? a : b));
}

function averageCrowdDensity() {
  const zones = state.snapshot?.zones || [];
  if (!zones.length) return NaN;
  return zones.reduce((sum, zone) => sum + Number(zone.crowdDensity || 0), 0) / zones.length;
}

function renderMetrics() {
  // Metrics are rendered inside the left widget.
}

function crowdLevel(value) {
  if (value >= 70) return 'HIGH';
  if (value >= 35) return 'MODERATE';
  return 'LOW';
}
