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
  leafletHeatZones: {},
  leafletHeatLabels: {},
  leafletBuildings: null,
  leafletLabels: [],
  map3d: null,
  map3dReady: false,
  modelViewer3d: null,
  modelViewer3dFrame: null,
  buildingTwinPreview: null,
  indexPulseTimer: null,
  indexCellTemplates: null,
  indexGeoJSON: null,
  indexBandCache: null,
  leftWidgetViewKey: null,
  lastSelectionAt: 0,
  aiWidgetHidden: true,
  riskActionsCollapsed: true,
};

const CAMPUS_MODEL_URL = '/models/bsu-model.glb';
const MAPBOX_DARK_STYLE = 'mapbox://styles/mapbox/dark-v11';
const MAPBOX_FALLBACK_DELAY_MS = 3500;

const CAMPUS_CENTER = [13.7844, 121.0745];
const BSU_CAMPUS_BOUNDARY_LATLNG = [
  [13.785302, 121.073318],
  [13.784389, 121.073391],
  [13.784376, 121.073272],
  [13.783969, 121.073315],
  [13.783921, 121.073755],
  [13.783413, 121.073759],
  [13.782941, 121.074479],
  [13.783669, 121.075164],
  [13.784441, 121.075079],
  [13.784405, 121.074262],
  [13.785388, 121.074164],
];

const FALLBACK_ZONES = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { zoneId: 'zoneA', name: 'Engineering Block' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[121.0738, 13.7845], [121.0743, 13.7848], [121.0748, 13.7845], [121.0743, 13.7842], [121.0738, 13.7845]]],
      },
    },
    {
      type: 'Feature',
      properties: { zoneId: 'zoneB', name: 'Library Commons' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[121.0745, 13.7849], [121.0750, 13.7852], [121.0755, 13.7849], [121.0750, 13.7846], [121.0745, 13.7849]]],
      },
    },
    {
      type: 'Feature',
      properties: { zoneId: 'zoneC', name: 'Central Cafeteria' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[121.0753, 13.7846], [121.0758, 13.7849], [121.0763, 13.7846], [121.0758, 13.7843], [121.0753, 13.7846]]],
      },
    },
    {
      type: 'Feature',
      properties: { zoneId: 'zoneD', name: 'Innovation Hub' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[121.0739, 13.7839], [121.0744, 13.7842], [121.0749, 13.7839], [121.0744, 13.7836], [121.0739, 13.7839]]],
      },
    },
    {
      type: 'Feature',
      properties: { zoneId: 'zoneE', name: 'Student Plaza' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[121.0748, 13.7842], [121.0753, 13.7845], [121.0758, 13.7842], [121.0753, 13.7839], [121.0748, 13.7842]]],
      },
    },
    {
      type: 'Feature',
      properties: { zoneId: 'zoneF', name: 'Sports Complex' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[121.0758, 13.7839], [121.0764, 13.7842], [121.0769, 13.7839], [121.0764, 13.7836], [121.0758, 13.7839]]],
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
    avgAirflow: 44,
    avgRisk: 0.58,
  },
  zones: [
    { id: 'zoneA', name: 'Engineering Block', co2: 1260, temperature: 33.6, humidity: 70, airflow: 26, crowdDensity: 84, risk: 0.79, status: 'critical' },
    { id: 'zoneB', name: 'Library Commons', co2: 960, temperature: 30.3, humidity: 62, airflow: 39, crowdDensity: 58, risk: 0.54, status: 'moderate' },
    { id: 'zoneC', name: 'Central Cafeteria', co2: 1420, temperature: 34.8, humidity: 72, airflow: 21, crowdDensity: 92, risk: 0.86, status: 'critical' },
    { id: 'zoneD', name: 'Innovation Hub', co2: 820, temperature: 28.6, humidity: 57, airflow: 47, crowdDensity: 44, risk: 0.42, status: 'moderate' },
    { id: 'zoneE', name: 'Student Plaza', co2: 760, temperature: 27.4, humidity: 54, airflow: 54, crowdDensity: 33, risk: 0.29, status: 'safe' },
    { id: 'zoneF', name: 'Sports Complex', co2: 690, temperature: 26.8, humidity: 51, airflow: 59, crowdDensity: 26, risk: 0.21, status: 'safe' },
  ],
  ai: {
    confidence: 84.2,
    latestDecision: {
      rootCause: 'Localized heat + crowd concentration around high-traffic corridors.',
      insight: 'Model recommends ventilation-first mitigation while preserving circulation throughput.',
      recommendedSpots: [
        { zoneId: 'zoneE', zoneName: 'Student Plaza', status: 'safe', temperature: 27.4, crowdDensity: 33, airflow: 54, risk: 0.29, reason: 'Best for temporary relocation and recovery from nearby risk zones.' },
        { zoneId: 'zoneF', zoneName: 'Sports Complex', status: 'safe', temperature: 26.8, crowdDensity: 26, airflow: 59, risk: 0.21, reason: 'Best for temporary relocation and recovery from nearby risk zones.' },
      ],
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
  aiWidgetContent: document.getElementById('aiWidgetContent'),
  aiInsightsWidget: document.getElementById('aiInsightsWidget'),
  aiWidgetShowBtn: document.getElementById('aiWidgetShowBtn'),
};

function selectedZone() {
  if (!state.selectedZoneId) return null;
  return state.snapshot?.zones?.find((zone) => zone.id === state.selectedZoneId) || null;
}

function buildingFeatures() {
  return state.mapData.buildings?.features || [];
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

function heatIndexForZone(zone) {
  if (!zone) return NaN;
  return Number(zone.temperature || 0) + (Number(zone.humidity || 0) - 50) * 0.06 - Number(zone.airflow || 0) * 0.03;
}

function averageHeatIndex() {
  const zones = state.snapshot?.zones || [];
  if (!zones.length) return NaN;
  return zones.reduce((sum, zone) => sum + heatIndexForZone(zone), 0) / zones.length;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatSigned(value, precision = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '0';
  return numeric > 0 ? `+${numeric.toFixed(precision)}` : numeric.toFixed(precision);
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

function setMetricText(elementId, value) {
  const node = document.getElementById(elementId);
  if (!node) return;
  node.textContent = value;
}

export {
  CAMPUS_CENTER,
  CAMPUS_MODEL_URL,
  BSU_CAMPUS_BOUNDARY_LATLNG,
  FALLBACK_BUILDINGS,
  FALLBACK_ZONES,
  MAPBOX_DARK_STYLE,
  MAPBOX_FALLBACK_DELAY_MS,
  MOCK_SNAPSHOT,
  averageAirflow,
  averageCrowdDensity,
  averageHeatIndex,
  buildRecommendedSpots,
  clamp,
  coolSpotReason,
  coolSpotScore,
  crowdLevel,
  formatSigned,
  heatIndexForZone,
  highestRiskZone,
  refs,
  resolveImpactForZone,
  selectedBuilding,
  selectedZone,
  setMetricText,
  state,
};
