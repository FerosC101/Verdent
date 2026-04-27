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

export { buildingOverviewMarkup, campusOverviewMarkup, updateBuildingMetricValues, updateCampusMetricValues };
