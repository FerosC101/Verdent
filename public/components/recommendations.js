import { formatSigned } from '../app-shared.js';

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

export { renderActionRecommendations, renderSpotRecommendations };
