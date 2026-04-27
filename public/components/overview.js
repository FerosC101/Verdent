import {
  averageAirflow,
  averageCrowdDensity,
  averageHeatIndex,
  buildRecommendedSpots,
  crowdLevel,
  formatSigned,
  heatIndexForZone,
  resolveImpactForZone,
  selectedBuilding,
  selectedZone,
  setMetricText,
  state,
} from '../app-shared.js';
import { renderActionRecommendations, renderSpotRecommendations } from './recommendations.js';

function stripEmojiText(value = '') {
  return String(value)
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function campusMetricStatus(metricKey, value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 'moderate';

  if (metricKey === 'co2') {
    if (numeric < 800) return 'safe';
    if (numeric < 1100) return 'moderate';
    return 'critical';
  }

  if (metricKey === 'temp') {
    if (numeric < 29) return 'safe';
    if (numeric < 32) return 'moderate';
    return 'critical';
  }

  if (metricKey === 'humidity') {
    if (numeric >= 45 && numeric <= 60) return 'safe';
    if (numeric >= 35 && numeric <= 70) return 'moderate';
    return 'critical';
  }

  if (metricKey === 'airflow') {
    if (numeric >= 50) return 'safe';
    if (numeric >= 35) return 'moderate';
    return 'critical';
  }

  if (metricKey === 'heat') {
    if (numeric < 31) return 'safe';
    if (numeric < 34) return 'moderate';
    return 'critical';
  }

  if (metricKey === 'crowd') {
    if (numeric < 35) return 'safe';
    if (numeric < 70) return 'moderate';
    return 'critical';
  }

  return 'moderate';
}

function statusLabel(status) {
  if (status === 'safe') return 'Safe';
  if (status === 'critical') return 'High';
  return 'Moderate';
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
  const campus = state.snapshot?.campus || {};
  const avgCrowd = averageCrowdDensity();
  const co2 = Number(campus.avgCo2);
  const temp = Number(campus.avgTemperature);
  const humidity = Number(campus.avgHumidity);
  const airflow = Number(campus.avgAirflow ?? averageAirflow());
  const heatIndex = averageHeatIndex();
  const decision = state.snapshot?.ai?.latestDecision;
  const recommendedSpots = decision?.recommendedSpots || buildRecommendedSpots();
  const recommendedActions = decision?.recommendedActions || [];
  const co2Status = campusMetricStatus('co2', co2);
  const tempStatus = campusMetricStatus('temp', temp);
  const humidityStatus = campusMetricStatus('humidity', humidity);
  const airflowStatus = campusMetricStatus('airflow', airflow);
  const heatStatus = campusMetricStatus('heat', heatIndex);
  const crowdStatus = campusMetricStatus('crowd', avgCrowd);

  return `
    <div class="widget-header">
      <h2>Campus Overview</h2>
      <p class="widget-subtitle" id="campusLiveTime">${new Date().toLocaleTimeString()} · Live Monitoring</p>
    </div>

    <h3>Live Campus Status</h3>
    <div class="widget-metric-grid">
      <article class="metric widget-metric-card">
        <div class="metric-label-row"><span>Co2 Level</span><span class="status-pill ${co2Status} campus-metric-pill">${statusLabel(co2Status)}</span></div>
        <strong id="campusMetricCo2">${Number.isFinite(co2) ? `${Math.round(co2)} ppm` : '-- ppm'}</strong>
      </article>
      <article class="metric widget-metric-card">
        <div class="metric-label-row"><span>Temperature</span><span class="status-pill ${tempStatus} campus-metric-pill">${statusLabel(tempStatus)}</span></div>
        <strong id="campusMetricTemp">${Number.isFinite(temp) ? `${temp.toFixed(1)} °C` : '-- °C'}</strong>
      </article>
      <article class="metric widget-metric-card">
        <div class="metric-label-row"><span>Humidity</span><span class="status-pill ${humidityStatus} campus-metric-pill">${statusLabel(humidityStatus)}</span></div>
        <strong id="campusMetricHumidity">${Number.isFinite(humidity) ? `${Math.round(humidity)} %` : '-- %'}</strong>
      </article>
      <article class="metric widget-metric-card">
        <div class="metric-label-row"><span>Airflow</span><span class="status-pill ${airflowStatus} campus-metric-pill">${statusLabel(airflowStatus)}</span></div>
        <strong id="campusMetricAirflow">${Number.isFinite(airflow) ? `${Math.round(airflow)} %` : '-- %'}</strong>
      </article>
      <article class="metric widget-metric-card">
        <div class="metric-label-row"><span>Heat Index</span><span class="status-pill ${heatStatus} campus-metric-pill">${statusLabel(heatStatus)}</span></div>
        <strong id="campusMetricHeat">${Number.isFinite(heatIndex) ? `${heatIndex.toFixed(1)} °C` : '-- °C'}</strong>
      </article>
      <article class="metric widget-metric-card">
        <div class="metric-label-row"><span>Crowd Density</span><span class="status-pill ${crowdStatus} campus-metric-pill">${statusLabel(crowdStatus)}</span></div>
        <strong id="campusMetricCrowd">${Number.isFinite(avgCrowd) ? `${crowdLevel(avgCrowd)} · ${Math.round(avgCrowd)}%` : '--'}</strong>
      </article>
    </div>

    <h3>Cool Spots</h3>
    <div class="recommendation-list recommendation-list-spots">
      ${renderSpotRecommendations(recommendedSpots)}
    </div>

    <div class="section-title-row">
      <h3>Risk Actions</h3>
      <button class="section-toggle-btn" data-ui-action="toggle-risk-actions" aria-expanded="${String(!state.riskActionsCollapsed)}">${state.riskActionsCollapsed ? 'Show' : 'Hide'}</button>
    </div>
    ${state.riskActionsCollapsed
    ? '<p class="section-collapsed-note">Hidden to keep the map and key stats more visible.</p>'
    : `<div class="recommendation-list">${renderActionRecommendations(recommendedActions)}</div>`}

    <div class="widget-btn-row widget-btn-row-single">
      <a href="/report.html" class="btn widget-cta-btn">View Full Report</a>
    </div>
  `;
}

function aiInsightsWidgetMarkup() {
  const decision = state.snapshot?.ai?.latestDecision;
  const confidence = state.snapshot?.ai?.confidence ?? 0;
  const selectedAction = stripEmojiText(decision?.recommendedActions?.[0]?.label || 'No active intervention selected.');

  return `
    <div class="widget-header widget-header-split">
      <div>
        <h2>AI Insights</h2>
        <p class="widget-subtitle">Live recommendation engine</p>
      </div>
      <button class="section-toggle-btn" data-ui-action="toggle-ai-widget" aria-label="Hide AI insights widget">Hide</button>
    </div>

    <article class="box">
      <div><strong>Root Cause:</strong> ${decision?.rootCause || 'AI model is calibrating current campus conditions.'}</div>
      <div style="margin-top:6px;"><strong>Selected Action:</strong> ${selectedAction}</div>
      <div style="margin-top:6px;"><strong>Confidence:</strong> ${confidence.toFixed(1)}%</div>
      <p style="margin:8px 0 0;color:#aed5ef;">${decision?.insight || 'High crowd density detected in a key zone. Ventilation corridor adjusted automatically.'}</p>
    </article>

    <div class="widget-btn-row widget-btn-row-single">
      <a href="/simulate.html" class="btn widget-cta-btn">Simulate Rush Hour</a>
    </div>
  `;
}

function buildingStatusWidgetMarkup() {
  const zone = selectedZone();
  const building = selectedBuilding();
  const recommendedSpots = buildRecommendedSpots(zone?.id, 2);

  const co2 = Number(zone?.co2);
  const temperature = Number(zone?.temperature);
  const crowdDensity = Number(zone?.crowdDensity);
  const airflow = Number(zone?.airflow);

  const airQualityState = Number.isFinite(co2)
    ? co2 >= 1200
      ? 'Poor'
      : co2 >= 900
        ? 'Fair'
        : 'Good'
    : '--';
  const airQualityTone = airQualityState === 'Poor' ? 'danger' : airQualityState === 'Fair' ? 'warn' : 'safe';

  const temperatureState = Number.isFinite(temperature)
    ? temperature >= 34
      ? 'Very hot'
      : temperature >= 30
        ? 'Warm'
        : 'Comfortable'
    : '--';
  const temperatureTone = temperatureState === 'Very hot' ? 'danger' : temperatureState === 'Warm' ? 'warn' : 'safe';

  const crowdState = Number.isFinite(crowdDensity)
    ? crowdDensity >= 80
      ? 'Packed'
      : crowdDensity >= 50
        ? 'Busy'
        : 'Open'
    : '--';
  const crowdTone = crowdState === 'Packed' ? 'danger' : crowdState === 'Busy' ? 'warn' : 'safe';

  const airflowState = Number.isFinite(airflow)
    ? airflow < 30
      ? 'Low'
      : airflow < 50
        ? 'Moderate'
        : 'Good'
    : '--';
  const airflowTone = airflowState === 'Low' ? 'danger' : airflowState === 'Moderate' ? 'warn' : 'safe';

  const destinationA = recommendedSpots[0]?.zoneName;
  const destinationB = recommendedSpots[1]?.zoneName;
  const destinationLabel = destinationA && destinationB
    ? `${destinationA} or ${destinationB}`
    : destinationA || destinationB || 'a nearby safe zone';

  return `
    <article class="building-status-widget" aria-live="polite">
      <div class="building-status-header">
        <div class="building-status-icon">⚠</div>
        <div>
          <h3>${building?.properties?.name || zone?.name || 'Building'} — avoid now</h3>
          <p>Live campus safety update · ${new Date().toLocaleTimeString()}</p>
        </div>
        <button class="section-toggle-btn" data-ui-action="toggle-ai-widget" aria-label="Hide building widget">Hide</button>
      </div>

      <div class="building-status-metrics">
        <article class="building-status-metric">
          <span class="building-status-metric-label">Air quality</span>
          <strong class="tone-${airQualityTone}">${airQualityState}</strong>
        </article>
        <article class="building-status-metric">
          <span class="building-status-metric-label">Temperature</span>
          <strong class="tone-${temperatureTone}">${temperatureState}</strong>
        </article>
        <article class="building-status-metric">
          <span class="building-status-metric-label">Crowd</span>
          <strong class="tone-${crowdTone}">${crowdState}</strong>
        </article>
        <article class="building-status-metric">
          <span class="building-status-metric-label">Airflow</span>
          <strong class="tone-${airflowTone}">${airflowState}</strong>
        </article>
      </div>

      <div class="building-status-guidance impact-alert">
        <span class="building-status-guidance-icon">⚠</span>
        <div>
          <strong>Head to ${destinationLabel}</strong>
          <p>Cooler, less crowded, better air right now</p>
        </div>
      </div>
    </article>
  `;
}

function buildingOverviewMarkup() {
  const zone = selectedZone();
  const building = selectedBuilding();
  const decision = state.snapshot?.ai?.latestDecision;
  const impact = resolveImpactForZone(zone, decision);

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

    <div class="section-title-row">
      <h3>Impact Analysis</h3>
      <button class="section-toggle-btn" data-ui-action="toggle-building-impact" aria-expanded="${String(!state.buildingImpactCollapsed)}">${state.buildingImpactCollapsed ? 'Show' : 'Hide'}</button>
    </div>
    ${state.buildingImpactCollapsed
    ? '<p class="section-collapsed-note">Hidden to reduce panel density.</p>'
    : `<div class="impact-change-grid">
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
    </table>`}
  `;
}

export { aiInsightsWidgetMarkup, buildingOverviewMarkup, buildingStatusWidgetMarkup, campusOverviewMarkup, updateBuildingMetricValues, updateCampusMetricValues };
