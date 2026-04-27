import {
  CAMPUS_CENTER,
  CAMPUS_MODEL_URL,
  BSU_CAMPUS_BOUNDARY_LATLNG,
  FALLBACK_BUILDINGS,
  FALLBACK_ZONES,
  MAPBOX_DARK_STYLE,
  MAPBOX_FALLBACK_DELAY_MS,
  MOCK_SNAPSHOT,
  refs,
  state,
} from './app-shared.js';
import { buildingOverviewMarkup as buildingOverviewComponent, campusOverviewMarkup as campusOverviewComponent, updateBuildingMetricValues as updateBuildingMetricValuesComponent, updateCampusMetricValues as updateCampusMetricValuesComponent } from './components/overview.js';

init();

// =========================
// App bootstrap and events
// =========================

async function init() {
  bindControls();
  await loadGeoData();
  state.snapshot = structuredClone(MOCK_SNAPSHOT);
  initGeoMaps();
  startIndexPulseLoop();
  setMapMode('2d');
  setMapFilter(state.mapFilter);
  connectSocket();
  render();
  refreshLiveBuildingsInBackground();
}

function bindControls() {
  refs.mode2d?.addEventListener('click', () => setMapMode('2d'));
  refs.mode3d?.addEventListener('click', () => setMapMode('3d'));
  refs.filterToggle?.addEventListener('click', toggleFilterMenu);
  refs.filterOptions.forEach((button) => {
    button.addEventListener('click', () => {
      setMapFilter(button.dataset.filter);
      refs.filterMenu?.classList.remove('open');
    });
  });
  document.addEventListener('click', handleOutsideFilterMenuClick);
  window.addEventListener('resize', () => {
    if (state.mapMode === '2d') state.map3d?.resize();
    else resizeModelViewer3D();
  });
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

// =========================
// Data loading and campus geometry
// =========================

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

  state.mapData.zones = zones;
  state.mapData.buildings = fileBuildings;
  state.buildingZoneMap = deriveBuildingZoneMap();
}

async function refreshLiveBuildingsInBackground() {
  const liveBuildings = await fetchBSUAlangilanBuildings(6000);
  if (!liveBuildings?.features?.length) return;

  state.mapData.buildings = liveBuildings;
  state.buildingZoneMap = deriveBuildingZoneMap();

  if (state.map3d?.getSource('campus-buildings')) {
    state.map3d.getSource('campus-buildings').setData(buildMap3DBuildingsGeoJSON());
  }

  renderMap();
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

async function fetchBSUAlangilanBuildings(timeoutMs = 6000) {
  const campusPoly = BSU_CAMPUS_BOUNDARY_LATLNG.map(([lat, lng]) => `${lat} ${lng}`).join(' ');
  const overpassQuery = `
    [out:json][timeout:12];
    (
      way["building"](poly:"${campusPoly}");
      relation["building"](poly:"${campusPoly}");
    );
    out geom;
  `;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: new URLSearchParams({ data: overpassQuery }).toString(),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

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
// =========================
// 2D / 3D map initialization
// =========================

    const [xj, yj] = polygon[j];
    const intersect = yi > y !== yj > y
      && x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

function loadCampusModel(LoaderCtor, targetScene, { url = CAMPUS_MODEL_URL, onLoaded, onError } = {}) {
  const loader = new LoaderCtor();
  loader.load(
    url,
    (gltf) => {
      targetScene.add(gltf.scene);
      if (typeof onLoaded === 'function') onLoaded(gltf);
    },
    undefined,
    (error) => {
      if (typeof onError === 'function') onError(error);
    }
  );
}

function fitModelToScene(model, targetSize, verticalOffset = 1) {
  model.rotation.set(Math.PI / 2, 0, 0);

  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const fitScale = targetSize / maxDim;
  model.scale.setScalar(fitScale);
  model.position.set(-center.x * fitScale, -center.y * fitScale + verticalOffset, -center.z * fitScale);
}

function initGeoMaps() {
  init3DMap();
  initModelViewer3D();
}

function setMapMode(mode) {
  state.mapMode = mode;
  const is2d = mode === '2d';

  refs.mode2d?.classList.toggle('active', is2d);
  refs.mode3d?.classList.toggle('active', !is2d);
  refs.mode2d?.setAttribute('aria-selected', String(is2d));
  refs.mode3d?.setAttribute('aria-selected', String(!is2d));

  refs.campusMap2D?.classList.toggle('hidden', !is2d);
  refs.campusMap3D?.classList.toggle('hidden', is2d);

  if (is2d) {
    state.map3d?.resize();
  } else {
    resizeModelViewer3D();
  }
}

function init2DMap() {
  if (!window.L) return;

  const bounds = getCampusBounds();

  state.leafletMap = L.map('campusMap2D', {
    zoomControl: true,
    attributionControl: false,
    maxBounds: bounds || undefined,
    maxBoundsViscosity: 0.98,
    minZoom: 16.2,
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

  if (bounds) state.leafletMap.fitBounds(bounds, { padding: [24, 24] });

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

  initHeatIndexLayer();
}

function initHeatIndexLayer() {
  if (!state.leafletMap || !state.snapshot) return;

  zoneFeatures().forEach((feature) => {
    const zoneId = feature.properties.zoneId;
    const coords = feature.geometry.coordinates[0].map(([lng, lat]) => [lat, lng]);
    const zone = state.snapshot.zones.find((item) => item.id === zoneId) || null;
    const heatIndex = heatIndexForZone(zone);

    const polygon = L.polygon(coords, {
      color: '#69d9ff',
      weight: 1.5,
      fillColor: '#69d9ff',
      fillOpacity: 0,
      opacity: 0,
      interactive: false,
      className: 'leaflet-heat-zone',
    }).addTo(state.leafletMap);

    const center = polygon.getBounds().getCenter();
    const label = L.marker(center, {
      interactive: false,
      icon: L.divIcon({
        className: 'leaflet-heat-label heat-hidden',
        html: `${heatIndex.toFixed(1)}°`,
      }),
    }).addTo(state.leafletMap);

    state.leafletHeatZones[zoneId] = polygon;
    state.leafletHeatLabels[zoneId] = label;
  });
}

function init3DMap() {
  if (!window.maplibregl) return;

  const lockedBounds = campusBoundaryBoundsLngLat(0.00012);

  state.map3d = new maplibregl.Map({
    container: 'campusMap2D',
    style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    center: [CAMPUS_CENTER[1], CAMPUS_CENTER[0]],
    zoom: 17.1,
    pitch: 0,
    bearing: 0,
    antialias: false,
    maxBounds: lockedBounds,
    minZoom: 16.8,
    maxZoom: 20,
    dragRotate: false,
    pitchWithRotate: false,
  });

  state.map3d.dragRotate?.disable();
  state.map3d.touchZoomRotate?.disableRotation();

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

    state.map3d.addSource('campus-index-overlay', {
      type: 'geojson',
      data: emptyFeatureCollection(),
    });

    state.map3d.addLayer({
      id: 'campus-index-overlay-fill',
      type: 'fill',
      source: 'campus-index-overlay',
      paint: {
        'fill-color': [
          'interpolate',
          ['linear'],
          ['get', 'indexValue'],
          0, '#2ddc74',
          40, '#2ddc74',
          55, '#ff9d3a',
          70, '#ff9d3a',
          85, '#ff3b30',
          100, '#ff3b30',
        ],
        'fill-opacity': 0,
      },
    });

    state.map3d.addLayer({
      id: 'campus-index-overlay-line',
      type: 'line',
      source: 'campus-index-overlay',
      paint: {
        'line-color': [
          'interpolate',
          ['linear'],
          ['get', 'indexValue'],
          0, '#7dffaf',
          40, '#7dffaf',
          55, '#ffc274',
          70, '#ffc274',
          85, '#ff8e88',
          100, '#ff8e88',
        ],
        'line-width': 0.35,
        'line-opacity': 0,
      },
    });

    state.map3d.addLayer({
      id: 'campus-buildings-extrusion',
      type: 'fill',
      source: 'campus-buildings',
      paint: {
        'fill-color': '#c7d0d8',
        'fill-opacity': 0.42,
        'fill-outline-color': '#8ea3b2',
      },
    });

    state.map3d.addLayer({
      id: 'campus-buildings-hitbox',
      type: 'fill',
      source: 'campus-buildings',
      paint: {
        'fill-color': '#000000',
        'fill-opacity': 0.01,
      },
    });

    state.map3d.addLayer({
      id: 'campus-buildings-highlight',
      type: 'line',
      source: 'campus-buildings',
      paint: {
        'line-color': '#6effbe',
        'line-width': 2.4,
        'line-opacity': 0.95,
      },
      filter: ['==', ['get', 'id'], ''],
    });

    const selectBuildingFromMapEvent = (event) => {
      const featureFromEvent = event.features?.find((feature) => feature?.properties?.id);
      const queried = state.map3d.queryRenderedFeatures(event.point, {
        layers: ['campus-buildings-hitbox', 'campus-buildings-extrusion'],
      });
      const feature = featureFromEvent || queried.find((item) => item?.properties?.id);
      const buildingId = String(feature?.properties?.id || '');
      if (!buildingId) return;
      selectBuilding(buildingId, state.buildingZoneMap[buildingId]);
    };

    state.map3d.on('click', 'campus-buildings-extrusion', selectBuildingFromMapEvent);
    state.map3d.on('click', 'campus-buildings-hitbox', selectBuildingFromMapEvent);

    state.map3d.on('click', (event) => {
      const hits = state.map3d.queryRenderedFeatures(event.point, {
        layers: ['campus-buildings-hitbox', 'campus-buildings-extrusion'],
      });
      if (!hits.length) clearSelection();
    });

    ['campus-buildings-extrusion', 'campus-buildings-hitbox'].forEach((layerId) => {
      state.map3d.on('mouseenter', layerId, () => {
        state.map3d.getCanvas().style.cursor = 'pointer';
      });

      state.map3d.on('mouseleave', layerId, () => {
        state.map3d.getCanvas().style.cursor = '';
      });
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

    if (lockedBounds) {
      state.map3d.fitBounds(lockedBounds, { padding: 28, duration: 0 });
      state.map3d.setMaxBounds(lockedBounds);
      state.map3d.setMinZoom(Math.max(16.8, state.map3d.getZoom() - 0.1));
    }
  });
}

function initModelViewer3D() {
  if (!window.THREE || !refs.campusMap3D) return;

  const LoaderCtor = window.THREE.GLTFLoader || window.GLTFLoader;
  if (!LoaderCtor) {
    refs.campusMap3D.innerHTML = '<div style="color:#d6e9ff;display:flex;align-items:center;justify-content:center;height:100%;font:600 14px Inter,sans-serif;">GLTF loader not available</div>';
    return;
  }

  cleanup3DViewer();

  if (!window.mapboxgl) {
    initStandaloneThreeViewer(LoaderCtor);
    return;
  }

  const mapboxToken = window.MAPBOX_TOKEN;
  if (!mapboxToken) {
    initStandaloneThreeViewer(LoaderCtor);
    return;
  }

  mapboxgl.accessToken = mapboxToken;

  const modelOrigin = [121.07421871661094, 13.784333530392153];
  const modelAltitude = 0;
  const modelRotate = [Math.PI / 2, 0, Math.PI / 2];
  const offsetX = 0;
  const offsetY = -100;

  const mercator = mapboxgl.MercatorCoordinate.fromLngLat(modelOrigin, modelAltitude);
  const meterUnits = mercator.meterInMercatorCoordinateUnits();

  const modelTransform = {
    translateX: mercator.x + offsetX * meterUnits,
    translateY: mercator.y - offsetY * meterUnits,
    translateZ: mercator.z,
    rotateX: modelRotate[0],
    rotateY: modelRotate[1],
    rotateZ: modelRotate[1],
    scale: meterUnits,
  };

  let layerAdded = false;
  let fallbackTimer = null;

  const map = new mapboxgl.Map({
    container: 'campusMap3D',
    style: MAPBOX_DARK_STYLE,
    zoom: 17,
    center: modelOrigin,
    pitch: 60,
    bearing: 0,
    dragRotate: true,
    pitchWithRotate: true,
    antialias: true,
  });

  map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');

  // Left-drag rotate/pitch support (friendlier on trackpads).
  let dragRotating = false;
  let lastX = 0;
  let lastY = 0;
  const canvas = map.getCanvas();

  const onMouseMoveRotate = (event) => {
    if (!dragRotating) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;

    map.setBearing(map.getBearing() + dx * 0.35);
    map.setPitch(clamp(map.getPitch() - dy * 0.25, 15, 85));
  };

  const onMouseUpRotate = () => {
    if (!dragRotating) return;
    dragRotating = false;
    map.dragPan?.enable();
    canvas.style.cursor = '';
  };

  canvas.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    dragRotating = true;
    lastX = event.clientX;
    lastY = event.clientY;
    map.dragPan?.disable();
    canvas.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', onMouseMoveRotate);
  window.addEventListener('mouseup', onMouseUpRotate);

  map.on('remove', () => {
    window.removeEventListener('mousemove', onMouseMoveRotate);
    window.removeEventListener('mouseup', onMouseUpRotate);
  });
  map.dragRotate?.enable();
  map.touchZoomRotate?.enableRotation();

  const failToFallback = () => {
    if (layerAdded) return;
    try {
      map.remove();
    } catch (_error) {
      // no-op
    }
    initStandaloneThreeViewer(LoaderCtor);
  };

  fallbackTimer = setTimeout(failToFallback, MAPBOX_FALLBACK_DELAY_MS);

  map.on('error', () => {
    if (fallbackTimer) clearTimeout(fallbackTimer);
    failToFallback();
  });

  const customLayer = {
    id: 'bsu-glb-overlay',
    type: 'custom',
    renderingMode: '3d',
    onAdd(mapInstance, gl) {
      this.camera = new THREE.Camera();
      this.scene = new THREE.Scene();

      const directionalLight = new THREE.DirectionalLight(0xffffff);
      directionalLight.position.set(0, -70, 100).normalize();
      this.scene.add(directionalLight);

      const directionalLight2 = new THREE.DirectionalLight(0xffffff);
      directionalLight2.position.set(0, 70, 100).normalize();
      this.scene.add(directionalLight2);

      this.scene.add(new THREE.AmbientLight(0xffffff, 0.4));

      loadCampusModel(LoaderCtor, this.scene, {
        onLoaded: (gltf) => {
          this.modelRoot = gltf.scene;
          this.pickTargets = [];
          gltf.scene.traverse((obj) => {
            if (obj && obj.isMesh) {
              obj.frustumCulled = false;
              this.pickTargets.push(obj);
            }
          });

          layerAdded = true;
          if (fallbackTimer) clearTimeout(fallbackTimer);
        },
        onError: () => {
          if (fallbackTimer) clearTimeout(fallbackTimer);
          failToFallback();
        },
      });

      this.map = mapInstance;
      this.renderer = new THREE.WebGLRenderer({
        canvas: mapInstance.getCanvas(),
        context: gl,
        antialias: true,
      });
      this.renderer.autoClear = false;
    },
    render(gl, matrix) {
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

  map.on('style.load', () => {
    try {
      map.addLayer(customLayer);
    } catch (_error) {
      if (fallbackTimer) clearTimeout(fallbackTimer);
      failToFallback();
    }
  });

  state.modelViewer3d = map;
}

function resizeModelViewer3D() {
  if (!state.modelViewer3d || !refs.campusMap3D) return;
  if (typeof state.modelViewer3d.resize === 'function') {
    state.modelViewer3d.resize();
    return;
  }

  if (state.modelViewer3d.renderer && state.modelViewer3d.camera) {
    const width = refs.campusMap3D.clientWidth || 1;
    const height = refs.campusMap3D.clientHeight || 1;
    state.modelViewer3d.renderer.setSize(width, height, false);
    state.modelViewer3d.camera.aspect = width / height;
    state.modelViewer3d.camera.updateProjectionMatrix();
  }
}

function cleanup3DViewer() {
  if (!state.modelViewer3d) return;

  if (typeof state.modelViewer3d.remove === 'function') {
    try {
      state.modelViewer3d.remove();
    } catch (_error) {
      // no-op
    }
  }

  if (state.modelViewer3d.rafId) {
    cancelAnimationFrame(state.modelViewer3d.rafId);
  }

  refs.campusMap3D.innerHTML = '';
  state.modelViewer3d = null;
}

function cleanupBuildingTwinPreview() {
  if (!state.buildingTwinPreview) return;

  if (state.buildingTwinPreview.rafId) {
    cancelAnimationFrame(state.buildingTwinPreview.rafId);
  }

  if (state.buildingTwinPreview.controls?.dispose) {
    state.buildingTwinPreview.controls.dispose();
  }

  if (state.buildingTwinPreview.renderer?.dispose) {
    state.buildingTwinPreview.renderer.dispose();
  }

  state.buildingTwinPreview = null;
}

// =========================
// Mapbox + fallback 3D viewers
// =========================

function initBuildingTwinPreview() {
  const host = document.getElementById('buildingTwinModelHost');
  if (!host || !window.THREE) return;

  const LoaderCtor = window.THREE.GLTFLoader || window.GLTFLoader;
  if (!LoaderCtor) return;

  cleanupBuildingTwinPreview();
  host.innerHTML = '';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0a1725');

  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 1200);
  camera.position.set(0, 12, 40);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  host.appendChild(renderer.domElement);

  const ambient = new THREE.AmbientLight(0xffffff, 0.9);
  const key = new THREE.DirectionalLight(0xffffff, 1.0);
  key.position.set(16, 24, 14);
  scene.add(ambient);
  scene.add(key);

  const stage = new THREE.Group();
  scene.add(stage);

  loadCampusModel(LoaderCtor, stage, {
    url: '/models/building.glb',
    onLoaded: (gltf) => {
      fitModelToScene(gltf.scene, 24);
    },
    onError: () => {
      host.innerHTML = '<div style="color:#d6e9ff;display:flex;align-items:center;justify-content:center;height:100%;font:600 12px Inter,sans-serif;">3D twin unavailable</div>';
    },
  });

  const OrbitControlsCtor = THREE.OrbitControls || window.OrbitControls;
  let controls = null;
  if (OrbitControlsCtor) {
    controls = new OrbitControlsCtor(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 8;
    controls.maxDistance = 70;
    controls.target.set(0, 3, 0);
    controls.update();
  }

  const preview = {
    renderer,
    camera,
    scene,
    stage,
    controls,
    rafId: 0,
  };

  const resize = () => {
    const width = host.clientWidth || 1;
    const height = host.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const tick = () => {
    if (preview.controls) preview.controls.update();
    else preview.stage.rotation.y += 0.0025;
    renderer.render(scene, camera);
    preview.rafId = requestAnimationFrame(tick);
  };

  state.buildingTwinPreview = preview;
  resize();
  tick();
}

function initStandaloneThreeViewer(LoaderCtor) {
  refs.campusMap3D.innerHTML = '';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#08131f');

  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 2000);
  camera.position.set(0, 20, 64);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  refs.campusMap3D.appendChild(renderer.domElement);

  const ambient = new THREE.AmbientLight(0xffffff, 0.95);
  const key = new THREE.DirectionalLight(0xffffff, 1.05);
  key.position.set(24, 34, 18);
  scene.add(ambient);
  scene.add(key);

  const stage = new THREE.Group();
  scene.add(stage);

  loadCampusModel(LoaderCtor, stage, {
    onLoaded: (gltf) => {
      fitModelToScene(gltf.scene, 36);
    },
    onError: () => {
      refs.campusMap3D.innerHTML = '<div style="color:#d6e9ff;display:flex;align-items:center;justify-content:center;height:100%;font:600 14px Inter,sans-serif;">Failed to load /models/bsu-model.glb</div>';
    },
  });

  const viewer = {
    scene,
    camera,
    renderer,
    stage,
    controls: null,
    rafId: 0,
  };

  const OrbitControlsCtor = THREE.OrbitControls || window.OrbitControls;
  if (OrbitControlsCtor) {
    viewer.controls = new OrbitControlsCtor(camera, renderer.domElement);
    viewer.controls.enableDamping = true;
    viewer.controls.dampingFactor = 0.07;
    viewer.controls.rotateSpeed = 0.9;
    viewer.controls.zoomSpeed = 0.9;
    viewer.controls.panSpeed = 0.7;
    viewer.controls.minDistance = 14;
    viewer.controls.maxDistance = 180;
    viewer.controls.target.set(0, 4, 0);
    viewer.controls.update();
  }

  const tick = () => {
    if (viewer.controls) {
      viewer.controls.update();
    } else {
      viewer.stage.rotation.y += 0.003;
    }
    viewer.renderer.render(viewer.scene, viewer.camera);
    viewer.rafId = requestAnimationFrame(tick);
  };

  state.modelViewer3d = viewer;
  resizeModelViewer3D();
  tick();
}

// =========================
// Campus map styling helpers
// =========================

// =========================
// Shared rendering helpers
// =========================

function buildingLayerStyle(buildingId) {
  const selected = state.selectedBuildingId && state.selectedBuildingId === buildingId;

  return {
    color: selected ? '#6effbe' : '#8ea3b2',
    weight: selected ? 3 : 1,
    fillColor: selected ? '#6effbe' : '#c7d0d8',
    fillOpacity: selected ? 0.34 : 0.18,
    className: selected ? 'map-building-selected' : '',
  };
}

function getCampusBounds() {
  if (!window.L || !BSU_CAMPUS_BOUNDARY_LATLNG.length) return null;
  return L.latLngBounds(BSU_CAMPUS_BOUNDARY_LATLNG);
}

function campusBoundaryBoundsLngLat(padding = 0) {
  const ring = campusBoundaryLngLat();
  if (!ring.length) return null;

  const lngs = ring.map(([lng]) => lng);
  const lats = ring.map(([, lat]) => lat);
  const minLng = Math.min(...lngs) - padding;
  const maxLng = Math.max(...lngs) + padding;
  const minLat = Math.min(...lats) - padding;
  const maxLat = Math.max(...lats) + padding;

  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
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

function buildMap3DIndexGeoJSON() {
  const nowMs = Date.now();
  ensureIndexCellTemplates();
  ensureIndexGeoJSON();
  return updateCampusIndexGeoJSON(nowMs);
}

// =========================
// Heat / index generation
// =========================

function ensureIndexCellTemplates() {
  if (Array.isArray(state.indexCellTemplates) && state.indexCellTemplates.length) return;

  const boundary = campusBoundaryLngLat();
  if (!boundary.length) {
    state.indexCellTemplates = [];
    return;
  }

  const lngs = boundary.map(([lng]) => lng);
  const lats = boundary.map(([, lat]) => lat);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  const cols = 80;
  const rows = 80;
  const stepLng = (maxLng - minLng) / cols;
  const stepLat = (maxLat - minLat) / rows;

  const templates = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const lng0 = minLng + c * stepLng;
      const lng1 = minLng + (c + 1) * stepLng;
      const lat0 = minLat + r * stepLat;
      const lat1 = minLat + (r + 1) * stepLat;
      const center = [(lng0 + lng1) / 2, (lat0 + lat1) / 2];

      if (!pointInPolygon(center, boundary)) continue;

      templates.push({
        row: r,
        col: c,
        ring: [
          [lng0, lat0],
          [lng1, lat0],
          [lng1, lat1],
          [lng0, lat1],
          [lng0, lat0],
        ],
      });
    }
  }

  state.indexCellTemplates = templates;
}

function ensureIndexGeoJSON() {
  if (state.indexGeoJSON) return;
  const templates = state.indexCellTemplates || [];

  state.indexGeoJSON = {
    type: 'FeatureCollection',
    features: templates.map((cell) => ({
      type: 'Feature',
      properties: {
        cellId: `r${cell.row}c${cell.col}`,
        indexValue: 0,
        indexLabel: '0%',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [cell.ring],
      },
    })),
  };
}

function updateCampusIndexGeoJSON(nowMs = Date.now()) {
  const templates = state.indexCellTemplates || [];
  const geo = state.indexGeoJSON || emptyFeatureCollection();
  if (!templates.length || !geo.features?.length) return geo;

  const campusAverage = simulatedCampusIndex(nowMs);
  const rawValues = new Array(templates.length);

  for (let i = 0; i < templates.length; i += 1) {
    const cell = templates[i];
    rawValues[i] = simulatedCellIndex(campusAverage, cell.row, cell.col, nowMs);
  }

  let minValue = state.indexBandCache?.minValue;
  let maxValue = state.indexBandCache?.maxValue;
  let lowCut = state.indexBandCache?.lowCut;
  let highCut = state.indexBandCache?.highCut;
  const shouldRefreshBands = !state.indexBandCache || (nowMs - state.indexBandCache.updatedAt) > 700;

  if (shouldRefreshBands) {
    const sorted = [...rawValues].sort((a, b) => a - b);
    minValue = sorted[0] ?? 0;
    maxValue = sorted[sorted.length - 1] ?? 100;
    lowCut = percentileValue(sorted, 0.58);
    highCut = percentileValue(sorted, 0.87);
    state.indexBandCache = {
      minValue,
      maxValue,
      lowCut,
      highCut,
      updatedAt: nowMs,
    };
  }

  for (let i = 0; i < geo.features.length; i += 1) {
    const feature = geo.features[i];
    const raw = rawValues[i] ?? 0;
    const indexValue = rebalanceIndexBands(raw, minValue, lowCut, highCut, maxValue);
    feature.properties.indexValue = indexValue;
    feature.properties.indexLabel = `${indexValue.toFixed(0)}%`;
  }

  return geo;
}

function emptyFeatureCollection() {
  return { type: 'FeatureCollection', features: [] };
}

function percentileValue(sortedValues, p) {
  if (!sortedValues.length) return 0;
  const index = Math.min(sortedValues.length - 1, Math.max(0, Math.floor((sortedValues.length - 1) * p)));
  return sortedValues[index];
}

function rebalanceIndexBands(value, minValue, lowCut, highCut, maxValue) {
  const lowerSpan = Math.max(0.001, lowCut - minValue);
  const middleSpan = Math.max(0.001, highCut - lowCut);
  const upperSpan = Math.max(0.001, maxValue - highCut);

  if (value <= lowCut) {
    const t = (value - minValue) / lowerSpan;
    return clamp(22 + t * 32, 0, 100);
  }

  if (value <= highCut) {
    const t = (value - lowCut) / middleSpan;
    return clamp(55 + t * 29, 0, 100);
  }

  const t = (value - highCut) / upperSpan;
  return clamp(85 + t * 13, 0, 100);
}

function simulatedCellIndex(campusAverage, row, col, nowMs = Date.now()) {
  const seed = row * 1.7 + col * 2.3;
  const waveA = Math.sin(nowMs / 360 + seed) * 18;
  const waveB = Math.cos(nowMs / 510 + row * 0.9) * 9;
  const waveC = Math.sin(nowMs / 220 + col * 0.7) * 6;
  return clamp(campusAverage + waveA + waveB + waveC, 0, 100);
}

function startIndexPulseLoop() {
  if (state.indexPulseTimer) clearInterval(state.indexPulseTimer);

  state.indexPulseTimer = setInterval(() => {
    if (state.mapFilter !== 'index') return;
    render3DZoneStyles();
  }, 120);
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
  renderHeatIndexLayer();
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
    const style = styleForZoneMetric(zone, state.mapFilter);
    polygon.setStyle({
      ...style,
      weight: state.selectedZoneId === zone.id ? style.weight + 1 : style.weight,
    });
  });
}

function renderHeatIndexLayer() {
  if (!state.leafletMap || !state.snapshot) return;

  const visible = state.mapFilter === 'heat';

  state.snapshot.zones.forEach((zone) => {
    const polygon = state.leafletHeatZones[zone.id];
    const label = state.leafletHeatLabels[zone.id];
    if (!polygon || !label) return;

    const heatIndex = heatIndexForZone(zone);
    const palette = heatIndexPalette(heatIndexStatus(heatIndex));

    polygon.setStyle({
      color: palette.stroke,
      fillColor: palette.fill,
      fillOpacity: visible ? 0.42 : 0,
      opacity: visible ? 0.9 : 0,
      weight: visible ? 2 : 0,
    });

    const labelElement = label.getElement();
    if (labelElement) {
      labelElement.classList.toggle('heat-hidden', !visible);
      labelElement.innerHTML = `${heatIndex.toFixed(1)}°`;
    }
  });
}

function heatIndexStatus(heatIndex) {
  if (heatIndex >= 34) return 'critical';
  if (heatIndex >= 31.5) return 'moderate';
  return 'safe';
}

function heatIndexPalette(status) {
  if (status === 'critical') {
    return { fill: '#ff4f7b', stroke: '#ffd166' };
  }
  if (status === 'moderate') {
    return { fill: '#ffe95a', stroke: '#7afff5' };
  }
  return { fill: '#45d6ff', stroke: '#7dff7a' };
}

function render3DZoneStyles() {
  if (!state.map3dReady || !state.map3d?.getSource('campus-buildings')) return;

  const showIndex = state.mapFilter === 'index';

  if (showIndex && state.map3d?.getSource('campus-index-overlay')) {
    state.map3d.getSource('campus-index-overlay').setData(buildMap3DIndexGeoJSON());
  }

  if (state.map3d.getLayer('campus-index-overlay-fill')) {
    state.map3d.setPaintProperty('campus-index-overlay-fill', 'fill-opacity', showIndex ? 0.28 : 0);
  }
  if (state.map3d.getLayer('campus-index-overlay-line')) {
    state.map3d.setPaintProperty('campus-index-overlay-line', 'line-opacity', showIndex ? 0.92 : 0);
  }

  if (state.map3d.getLayer('campus-buildings-extrusion')) {
    state.map3d.setPaintProperty(
      'campus-buildings-extrusion',
      'fill-color',
      ['case', ['==', ['get', 'id'], state.selectedBuildingId || ''], '#6effbe', '#c7d0d8']
    );
    state.map3d.setPaintProperty(
      'campus-buildings-extrusion',
      'fill-opacity',
      ['case', ['==', ['get', 'id'], state.selectedBuildingId || ''], 0.74, 0.42]
    );
  }

  if (state.map3d.getLayer('campus-buildings-highlight')) {
    state.map3d.setFilter('campus-buildings-highlight', ['==', ['get', 'id'], state.selectedBuildingId || '']);
  }
}

function styleForZoneMetric(zone, filter) {
  const metricStatus = metricStatusForZone(zone, filter);

  if (metricStatus === 'critical') {
    return {
      color: '#ffb07a',
      weight: 2,
      fillColor: '#ff8859',
      fillOpacity: 0.36,
    };
  }

  if (metricStatus === 'moderate') {
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
    return { fill: '#ff8859', stroke: '#ffb07a' };
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
      critical: { fill: '#ff8859', stroke: '#ffb07a' },
    },
    humidity: {
      safe: { fill: '#6effbe', stroke: '#a7ffd7' },
      moderate: { fill: '#79c8ff', stroke: '#a6ddff' },
      critical: { fill: '#ff8859', stroke: '#ffb07a' },
    },
    airflow: {
      safe: { fill: '#6effbe', stroke: '#a7ffd7' },
      moderate: { fill: '#ffd36e', stroke: '#ffe4a9' },
      critical: { fill: '#ff8859', stroke: '#ffb07a' },
    },
    heat: {
      safe: { fill: '#64e8ff', stroke: '#a8f3ff' },
      moderate: { fill: '#ffca6a', stroke: '#ffe0a4' },
      critical: { fill: '#ff8859', stroke: '#ffb07a' },
    },
    crowd: {
      safe: { fill: '#6ee5ff', stroke: '#9ef1ff' },
      moderate: { fill: '#ffb56e', stroke: '#ffd0a8' },
      critical: { fill: '#ff8859', stroke: '#ffb07a' },
    },
    co2: {
      safe: { fill: '#6effbe', stroke: '#a7ffd7' },
      moderate: { fill: '#ffd36e', stroke: '#ffe6b3' },
      critical: { fill: '#ff8859', stroke: '#ffb07a' },
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
  if (filter === 'airflow') return Math.max(0, 100 - Number(zone.airflow || 0));
  if (filter === 'heat') return heatIndexForZone(zone);
  if (filter === 'index') return simulatedIndexForZone(zone, Date.now());
  if (filter === 'crowd') return Number(zone.crowdDensity || 0);
  return Number(zone.risk || 0);
}

function heatIndexForZone(zone) {
  const temperature = Number(zone?.temperature);
  const humidity = Number(zone?.humidity);
  const airflow = Number(zone?.airflow);

  if (![temperature, humidity, airflow].every(Number.isFinite)) return 0;

  return Number((temperature + humidity * 0.08 - airflow * 0.05).toFixed(1));
}

function simulatedIndexForZone(zone, nowMs = Date.now()) {
  const temperature = Number(zone?.temperature || 0);
  const humidity = Number(zone?.humidity || 0);
  const airflow = Number(zone?.airflow || 0);
  const co2 = Number(zone?.co2 || 0);
  const crowd = Number(zone?.crowdDensity || 0);

  const heatBase = heatIndexForZone(zone) * 2.2;
  const co2Factor = Math.max(0, (co2 - 500) / 12);
  const crowdFactor = crowd * 0.45;
  const humidityFactor = Math.max(0, humidity - 45) * 0.55;
  const airflowRelief = Math.max(0, airflow) * 0.35;
  const tempFactor = Math.max(0, temperature - 24) * 1.5;

  const baseline = heatBase + co2Factor + crowdFactor + humidityFactor + tempFactor - airflowRelief;
  const phaseSeed = zone?.id ? zone.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) : 0;
  const pulse = Math.sin(nowMs / 1400 + phaseSeed * 0.07) * 8;
  const indexed = baseline * 0.36 + 22 + pulse;

  return clamp(indexed, 0, 100);
}

function simulatedCampusIndex(nowMs = Date.now()) {
  const zones = state.snapshot?.zones || [];
  if (!zones.length) return 0;

  const total = zones.reduce((sum, zone) => sum + simulatedIndexForZone(zone, nowMs), 0);
  const average = total / zones.length;
  const pulse = Math.sin(nowMs / 1150) * 9 + Math.sin(nowMs / 530) * 3;

  return clamp(average + pulse, 0, 100);
}

// =========================
// UI rendering and metrics
// =========================

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
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

  const nextKey = state.selectedBuildingId ? `building:${state.selectedBuildingId}` : 'campus';
  if (state.leftWidgetViewKey !== nextKey || !refs.leftWidgetContent.childElementCount) {
    cleanupBuildingTwinPreview();
    refs.leftWidgetContent.innerHTML = state.selectedBuildingId ? buildingOverviewComponent() : campusOverviewComponent();
    state.leftWidgetViewKey = nextKey;

    const openTwin3d = document.getElementById('openTwin3d');
    if (openTwin3d) openTwin3d.addEventListener('click', () => setMapMode('3d'));
    if (state.selectedBuildingId) initBuildingTwinPreview();
    return;
  }

  updateLeftWidgetMetricValues();
}

function updateLeftWidgetMetricValues() {
  if (state.leftWidgetViewKey?.startsWith('building:')) {
    updateBuildingMetricValuesComponent();
    return;
  }
  updateCampusMetricValuesComponent();
}

function setMetricText(elementId, value) {
  const node = document.getElementById(elementId);
  if (!node) return;
  node.textContent = value;
}

function updateCampusMetricValues() {
  const campus = state.snapshot?.campus || {};
  const co2 = Number(campus.avgCo2);
  const temp = Number(campus.avgTemperature);
  const humidity = Number(campus.avgHumidity);
  const airflow = Number(campus.avgAirflow ?? averageAirflow());
  const heatIndex = averageHeatIndex();
  const avgCrowd = averageCrowdDensity();

  setMetricText('campusLiveTime', `${new Date().toLocaleTimeString()} · Live Monitoring`);
  setMetricText('campusMetricCo2', Number.isFinite(co2) ? `${Math.round(co2)} ppm` : '-- ppm');
  setMetricText('campusMetricTemp', Number.isFinite(temp) ? `${temp.toFixed(1)} °C` : '-- °C');
  setMetricText('campusMetricHumidity', Number.isFinite(humidity) ? `${Math.round(humidity)} %` : '-- %');
  setMetricText('campusMetricAirflow', Number.isFinite(airflow) ? `${Math.round(airflow)} %` : '-- %');
  setMetricText('campusMetricHeat', Number.isFinite(heatIndex) ? `${heatIndex.toFixed(1)} °C` : '-- °C');
  setMetricText('campusMetricCrowd', Number.isFinite(avgCrowd) ? `${crowdLevel(avgCrowd)} · ${Math.round(avgCrowd)}%` : '--');
}

function updateBuildingMetricValues() {
  const zone = selectedZone();
  const co2 = Number(zone?.co2);
  const temperature = Number(zone?.temperature);
  const humidity = Number(zone?.humidity);
  const airflow = Number(zone?.airflow);
  const crowdDensity = Number(zone?.crowdDensity);
  const heatIndex = heatIndexForZone(zone);

  setMetricText('buildingMetricCo2', Number.isFinite(co2) ? `${Math.round(co2)} ppm` : '-- ppm');
  setMetricText('buildingMetricTemp', Number.isFinite(temperature) ? `${temperature.toFixed(1)} °C` : '-- °C');
  setMetricText('buildingMetricHumidity', Number.isFinite(humidity) ? `${Math.round(humidity)} %` : '-- %');
  setMetricText('buildingMetricAirflow', Number.isFinite(airflow) ? `${Math.round(airflow)} %` : '-- %');
  setMetricText('buildingMetricHeat', Number.isFinite(heatIndex) ? `${heatIndex.toFixed(1)} °C` : '-- °C');
  setMetricText('buildingMetricCrowd', Number.isFinite(crowdDensity) ? `${crowdLevel(crowdDensity)} · ${Math.round(crowdDensity)}%` : '--');
  setMetricText('buildingTwinMeta', `Synced with live telemetry · ${state.mapMode === '3d' ? '3D map active' : 'Click below for 3D view'}`);
}


function campusOverviewMarkup() {
  const decision = state.snapshot?.ai?.latestDecision;
  const confidence = state.snapshot?.ai?.confidence ?? 0;
  const campus = state.snapshot?.campus || {};
  const avgCrowd = averageCrowdDensity();
  const co2 = Number(campus.avgCo2);
  const temp = Number(campus.avgTemperature);
  const humidity = Number(campus.avgHumidity);
  const airflow = Number(campus.avgAirflow ?? averageAirflow());
  const heatIndex = averageHeatIndex();
  const recommendedSpots = decision?.recommendedSpots || buildRecommendedSpots();
  const recommendedActions = decision?.recommendedActions || [];

  return `
    <div class="widget-header">
      <h2>Campus Overview</h2>
      <p class="widget-subtitle" id="campusLiveTime">${new Date().toLocaleTimeString()} · Live Monitoring</p>
    </div>

    <h3>Live Campus Status</h3>
    <div class="widget-metric-grid">
      <article class="metric widget-metric-card">
        <span>Co2 Level</span>
        <strong id="campusMetricCo2">${Number.isFinite(co2) ? `${Math.round(co2)} ppm` : '-- ppm'}</strong>
      </article>
      <article class="metric widget-metric-card">
        <span>Temperature</span>
        <strong id="campusMetricTemp">${Number.isFinite(temp) ? `${temp.toFixed(1)} °C` : '-- °C'}</strong>
      </article>
      <article class="metric widget-metric-card">
        <span>Humidity</span>
        <strong id="campusMetricHumidity">${Number.isFinite(humidity) ? `${Math.round(humidity)} %` : '-- %'}</strong>
      </article>
      <article class="metric widget-metric-card">
        <span>Airflow</span>
        <strong id="campusMetricAirflow">${Number.isFinite(airflow) ? `${Math.round(airflow)} %` : '-- %'}</strong>
      </article>
      <article class="metric widget-metric-card">
        <span>Heat Index</span>
        <strong id="campusMetricHeat">${Number.isFinite(heatIndex) ? `${heatIndex.toFixed(1)} °C` : '-- °C'}</strong>
      </article>
      <article class="metric widget-metric-card">
        <span>Crowd Density</span>
        <strong id="campusMetricCrowd">${Number.isFinite(avgCrowd) ? `${crowdLevel(avgCrowd)} · ${Math.round(avgCrowd)}%` : '--'}</strong>
      </article>
    </div>

    <h3>AI Insights</h3>

    <article class="box">
      <div><strong>Root Cause:</strong> ${decision?.rootCause || 'AI model is calibrating current campus conditions.'}</div>
      <div style="margin-top:6px;"><strong>Selected Action:</strong> ${decision?.recommendedActions?.[0]?.label || 'No active intervention selected.'}</div>
      <div style="margin-top:6px;"><strong>Confidence:</strong> ${confidence.toFixed(1)}%</div>
      <p style="margin:8px 0 0;color:#aed5ef;">${decision?.insight || 'High crowd density detected in a key zone. Ventilation corridor adjusted automatically.'}</p>
    </article>

    <h3>Cool Spots</h3>
    <div class="recommendation-list">
      ${renderSpotRecommendations(recommendedSpots)}
    </div>

    <h3>Risk Actions</h3>
    <div class="recommendation-list">
      ${renderActionRecommendations(recommendedActions)}
    </div>

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
  const recommendedSpots = decision?.recommendedSpots || buildRecommendedSpots(zone?.id);
  const recommendedActions = decision?.recommendedActions || [];

  const co2 = Number(zone?.co2);
  const temperature = Number(zone?.temperature);
  const humidity = Number(zone?.humidity);
  const airflow = Number(zone?.airflow);
  const crowdDensity = Number(zone?.crowdDensity);
  const heatIndex = heatIndexForZone(zone);
  const buildingHeight = Number(building?.properties?.height);
  const estimatedFloors = Number.isFinite(buildingHeight) ? Math.max(1, Math.round(buildingHeight / 3.4)) : NaN;

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
        <div class="digital-twin-model" id="buildingTwinModelHost" aria-label="Building digital twin preview">
        </div>
        <div class="digital-twin-meta" id="buildingTwinMeta">Synced with live telemetry · ${state.mapMode === '3d' ? '3D map active' : 'Click below for 3D view'}</div>
        <button id="openTwin3d" class="action-btn">Open 3D Map</button>
      </div>
    </section>

    <h3>Building Profile</h3>
    <div class="widget-metric-grid">
      <article class="metric widget-metric-card">
        <span>Building Height</span>
        <strong>${Number.isFinite(buildingHeight) ? `${Math.round(buildingHeight)} m` : '-- m'}</strong>
      </article>
      <article class="metric widget-metric-card">
        <span>Estimated Floors</span>
        <strong>${Number.isFinite(estimatedFloors) ? `${estimatedFloors} floors` : '--'}</strong>
      </article>
      <article class="metric widget-metric-card">
        <span>Linked Zone</span>
        <strong>${zone?.name || 'Unmapped'}</strong>
      </article>
      <article class="metric widget-metric-card">
        <span>Zone Status</span>
        <strong>${zone?.status || 'moderate'}</strong>
      </article>
    </div>

    <h3>Key Metrics</h3>
    <div class="widget-metric-grid">
      <article class="metric widget-metric-card">
        <span>Co2 Level</span>
        <strong id="buildingMetricCo2">${Number.isFinite(co2) ? `${Math.round(co2)} ppm` : '-- ppm'}</strong>
      </article>
      <article class="metric widget-metric-card">
        <span>Temperature</span>
        <strong id="buildingMetricTemp">${Number.isFinite(temperature) ? `${temperature.toFixed(1)} °C` : '-- °C'}</strong>
      </article>
      <article class="metric widget-metric-card">
        <span>Humidity</span>
        <strong id="buildingMetricHumidity">${Number.isFinite(humidity) ? `${Math.round(humidity)} %` : '-- %'}</strong>
      </article>
      <article class="metric widget-metric-card">
        <span>Airflow</span>
        <strong id="buildingMetricAirflow">${Number.isFinite(airflow) ? `${Math.round(airflow)} %` : '-- %'}</strong>
      </article>
      <article class="metric widget-metric-card">
        <span>Heat Index</span>
        <strong id="buildingMetricHeat">${Number.isFinite(heatIndex) ? `${heatIndex.toFixed(1)} °C` : '-- °C'}</strong>
      </article>
      <article class="metric widget-metric-card">
        <span>Crowd Density</span>
        <strong id="buildingMetricCrowd">${Number.isFinite(crowdDensity) ? `${crowdLevel(crowdDensity)} · ${Math.round(crowdDensity)}%` : '--'}</strong>
      </article>
    </div>

    <article class="impact-alert">
      ⚠ This zone is experiencing a heat + emission spike due to crowd concentration, temperature, humidity, and airflow constraints.
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

    <h3>Cool Spots</h3>
    <div class="recommendation-list">
      ${renderSpotRecommendations(recommendedSpots, zone?.id)}
    </div>

    <h3>Risk Actions</h3>
    <div class="recommendation-list">
      ${renderActionRecommendations(recommendedActions)}
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

function averageAirflow() {
  const zones = state.snapshot?.zones || [];
  if (!zones.length) return NaN;
  return zones.reduce((sum, zone) => sum + Number(zone.airflow || 0), 0) / zones.length;
}

function averageHeatIndex() {
  const zones = state.snapshot?.zones || [];
  if (!zones.length) return NaN;
  return zones.reduce((sum, zone) => sum + heatIndexForZone(zone), 0) / zones.length;
}

function renderMetrics() {
  // Metrics are rendered inside the left widget.
}

function crowdLevel(value) {
  if (value >= 70) return 'HIGH';
  if (value >= 35) return 'MODERATE';
  return 'LOW';
}

function buildRecommendedSpots(excludedZoneId = null, limit = 3) {
  const zones = state.snapshot?.zones || [];
  return [...zones]
    .filter((zone) => zone.id !== excludedZoneId)
    .sort((a, b) => coolSpotScore(b) - coolSpotScore(a))
    .slice(0, limit)
    .map((zone) => ({
      zoneId: zone.id,
      zoneName: zone.name,
      status: zone.status,
      temperature: Number(zone.temperature),
      crowdDensity: Number(zone.crowdDensity),
      airflow: Number(zone.airflow),
      risk: Number(zone.risk),
      reason: coolSpotReason(zone),
    }));
}

function coolSpotScore(zone) {
  const temperature = Number(zone?.temperature) || 0;
  const crowdDensity = Number(zone?.crowdDensity) || 0;
  const airflow = Number(zone?.airflow) || 0;
  const risk = Number(zone?.risk) || 0;
  const safeBonus = zone?.status === 'safe' ? 10 : zone?.status === 'moderate' ? 4 : 0;
  return (36 - temperature) * 2 + airflow * 0.3 + (100 - crowdDensity) * 0.2 + (1 - risk) * 28 + safeBonus;
}

function coolSpotReason(zone) {
  if (zone?.status === 'safe') return 'Best for temporary relocation and recovery from nearby risk zones.';
  if ((Number(zone?.temperature) || 0) < 29 && (Number(zone?.airflow) || 0) > 50) return 'Cooler airflow makes it a good comfort fallback.';
  return 'Lower stress area with better conditions than active hotspots.';
}

function renderSpotRecommendations(spots = [], currentZoneId = null) {
  if (!spots.length) {
    return '<article class="box recommendation-card"><strong>No cool spots found</strong><p>AI is still calibrating the safest relocation areas.</p></article>';
  }

  return spots.map((spot, index) => `
    <article class="box recommendation-card spot-card ${spot.zoneId === currentZoneId ? 'spot-card-current' : ''}">
      <div class="recommendation-heading">
        <strong>${index + 1}. ${spot.zoneName}</strong>
        <span class="status-pill ${spot.status || 'moderate'}">${spot.status || 'moderate'}</span>
      </div>
      <p>${spot.reason || 'Recommended by the AI model as a cooler fallback point.'}</p>
      <div class="recommendation-meta">${Number.isFinite(Number(spot.temperature)) ? `${Number(spot.temperature).toFixed(1)} °C` : '-- °C'} · ${Number.isFinite(Number(spot.crowdDensity)) ? `${Math.round(Number(spot.crowdDensity))}% crowd` : '-- crowd'} · ${Number.isFinite(Number(spot.airflow)) ? `${Math.round(Number(spot.airflow))}% airflow` : '-- airflow'}</div>
    </article>
  `).join('');
}

function renderActionRecommendations(actions = []) {
  if (!actions.length) {
    return '<article class="box recommendation-card"><strong>No active actions</strong><p>The model is monitoring only right now.</p></article>';
  }

  return actions.map((action) => `
    <article class="box recommendation-card action-card">
      <div class="recommendation-heading">
        <strong>${action.label || 'Recommended action'}</strong>
        <span class="recommendation-pill">${action.expectedDelta?.etaMin ? `${action.expectedDelta.etaMin} min` : 'Ready'}</span>
      </div>
      <p>${action.score ? `Priority score ${action.score.toFixed(2)}.` : 'Suggested response for nearby risk areas.'}</p>
      <div class="recommendation-meta">${action.expectedDelta ? `ΔCO₂ ${formatSigned(action.expectedDelta.co2Delta)} ppm · ΔTemp ${formatSigned(action.expectedDelta.tempDelta, 1)} °C · ΔRisk ${formatSigned(action.expectedDelta.riskDelta, 2)}` : 'Available once the AI finishes evaluating the hotspot.'}</div>
    </article>
  `).join('');
}
