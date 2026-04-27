import { formatSigned } from '../app-shared.js';

function stripEmojiText(value = '') {
  return String(value)
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function crowdDescriptor(value) {
  const crowd = Number(value);
  if (!Number.isFinite(crowd)) return 'Unknown crowd';
  if (crowd >= 70) return 'Very crowded';
  if (crowd >= 40) return 'Moderately crowded';
  return 'Less crowded';
}

function renderSpotRecommendations(spots = [], currentZoneId = null) {
  if (!spots.length) {
    return '<article class="box recommendation-card"><strong>No cool spots found</strong><p>AI is still calibrating the safest relocation areas.</p></article>';
  }

  return spots.map((spot, index) => `
    <article class="box recommendation-card spot-card ${spot.zoneId === currentZoneId ? 'spot-card-current' : ''}">
      <div class="recommendation-heading">
        <strong>${spot.zoneName || `Cool Spot ${index + 1}`}</strong>
      </div>
      <div class="recommendation-meta">${Number.isFinite(Number(spot.temperature)) ? `${Number(spot.temperature).toFixed(1)} °C` : '-- °C'} · ${crowdDescriptor(spot.crowdDensity)}</div>
    </article>
  `).join('');
}

function renderActionRecommendations(actions = []) {
  if (!actions.length) {
    return '<article class="box recommendation-card"><strong>No active actions</strong><p>The model is monitoring only right now.</p></article>';
  }

  return actions.map((action) => {
    const cleanLabel = stripEmojiText(action.label || 'Recommended action');
    return `
    <article class="box recommendation-card action-card">
      <div class="recommendation-heading">
        <strong>${cleanLabel}</strong>
        <span class="recommendation-pill">${action.expectedDelta?.etaMin ? `${action.expectedDelta.etaMin} min` : 'Ready'}</span>
      </div>
      <p>${action.score ? `Priority score ${action.score.toFixed(2)}.` : 'Suggested response for nearby risk areas.'}</p>
      <div class="recommendation-meta">${action.expectedDelta ? `ΔCO₂ ${formatSigned(action.expectedDelta.co2Delta)} ppm · ΔTemp ${formatSigned(action.expectedDelta.tempDelta, 1)} °C · ΔRisk ${formatSigned(action.expectedDelta.riskDelta, 2)}` : 'Available once the AI finishes evaluating the hotspot.'}</div>
    </article>
  `;
  }).join('');
}

export { renderActionRecommendations, renderSpotRecommendations };
