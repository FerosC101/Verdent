const refs = {
  crowd: document.getElementById('crowd'),
  crowdValue: document.getElementById('crowdValue'),
  heatwave: document.getElementById('heatwave'),
  heatwaveText: document.getElementById('heatwaveText'),
  rushHour: document.getElementById('rushHour'),
  zoneResponses: document.getElementById('zoneResponses'),
  zoneSummaryGrid: document.getElementById('zoneSummaryGrid'),
  
  // Zone details
  zoneDetailName: document.getElementById('zoneDetailName'),
  zoneDetailStatus: document.getElementById('zoneDetailStatus'),
  zoneAlertBox: document.getElementById('zoneAlertBox'),
  zoneAlertMessage: document.getElementById('zoneAlertMessage'),
  metricCo2: document.getElementById('metricCo2'),
  metricTemp: document.getElementById('metricTemp'),
  metricHumidity: document.getElementById('metricHumidity'),
  metricCrowd: document.getElementById('metricCrowd'),
  co2Fill: document.getElementById('co2Fill'),
  tempFill: document.getElementById('tempFill'),
  humidityFill: document.getElementById('humidityFill'),
  crowdFill: document.getElementById('crowdFill'),
  
  // Path buttons
  pathsGrid: document.getElementById('pathsGrid'),
  
  // Expected impact
  expectedCo2: document.getElementById('expectedCo2'),
  expectedTemp: document.getElementById('expectedTemp'),
  blockedCount: document.getElementById('blockedCount'),
  
  // Impact analysis
  impactAnalysisSection: document.getElementById('impactAnalysisSection'),
  impactCo2Change: document.getElementById('impactCo2Change'),
  impactTempChange: document.getElementById('impactTempChange'),
  impactCo2Before: document.getElementById('impactCo2Before'),
  impactCo2After: document.getElementById('impactCo2After'),
  impactTempBefore: document.getElementById('impactTempBefore'),
  impactTempAfter: document.getElementById('impactTempAfter'),
  impactCrowdBefore: document.getElementById('impactCrowdBefore'),
  impactCrowdAfter: document.getElementById('impactCrowdAfter'),
  successMessage: document.getElementById('successMessage'),
};

const state = { snapshot: null, ws: null, selectedZone: null, blockedPaths: new Set() };

bindControls();
connectSocket();

function bindControls() {
  refs.crowd.addEventListener('input', () => {
    refs.crowdValue.textContent = `${refs.crowd.value}%`;
    sendScenario();
  });

  refs.heatwave.addEventListener('change', () => {
    refs.heatwaveText.textContent = refs.heatwave.checked ? 'Active' : 'Inactive';
    sendScenario();
    updateExpectedImpact();
  });

  // Path button listeners
  refs.pathsGrid.addEventListener('click', (e) => {
    if (e.target.classList.contains('path-btn')) {
      const path = e.target.dataset.path;
      if (state.blockedPaths.has(path)) {
        state.blockedPaths.delete(path);
        e.target.classList.remove('active');
      } else {
        state.blockedPaths.add(path);
        e.target.classList.add('active');
      }
      refs.blockedCount.textContent = state.blockedPaths.size;
      sendScenario();
      updateExpectedImpact();
    }
  });

  refs.rushHour.addEventListener('click', () => send({ type: 'trigger-rush-hour' }));
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
      heatwave: refs.heatwave.checked,
      pathBlock: Array.from(state.blockedPaths),
    },
  });
}

function updateExpectedImpact() {
  if (!state.snapshot) return;
  
  let co2Change = refs.heatwave.checked ? '+80%' : '+20%';
  let tempChange = refs.heatwave.checked ? '+5°C' : '+2°C';
  
  refs.expectedCo2.textContent = co2Change;
  refs.expectedTemp.textContent = tempChange;
}

function getStatusColor(status) {
  return status === 'safe' ? 'safe' : status === 'moderate' ? 'moderate' : 'critical';
}

function renderZoneList(zones) {
  refs.zoneResponses.innerHTML = zones
    .map((zone, idx) => `
      <li class="zone-item" data-index="${idx}">
        <strong>${zone.name}</strong> · 
        <span class="status-badge">${zone.status.toUpperCase()}</span> · 
        CO₂ ${zone.co2} ppm · Temp ${zone.temperature.toFixed(1)}°C
      </li>
    `)
    .join('');
  
  // Add click listeners to zone items
  document.querySelectorAll('.zone-item').forEach(item => {
    item.addEventListener('click', () => selectZone(parseInt(item.dataset.index)));
  });
}

function selectZone(idx) {
  if (!state.snapshot) return;
  
  const zones = state.snapshot.zones;
  const zone = zones[idx];
  state.selectedZone = idx;
  
  // Update active state
  document.querySelectorAll('.zone-item').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });
  
  // Update zone details
  refs.zoneDetailName.textContent = zone.name;
  const statusClass = getStatusColor(zone.status);
  refs.zoneDetailStatus.textContent = zone.status.toUpperCase();
  refs.zoneDetailStatus.className = `zone-status-badge ${statusClass}`;
  
  // Update alert
  const alertClass = getStatusColor(zone.status);
  refs.zoneAlertBox.className = `zone-alert ${alertClass}`;
  refs.zoneAlertMessage.textContent = 
    zone.status === 'critical' 
      ? `This zone is experiencing a heat + emission spike due to ${zone.crowdDensity}% crowd concentration.`
      : zone.status === 'moderate'
      ? `Moderate conditions detected. Crowd density at ${zone.crowdDensity}%.`
      : `Safe zone. All metrics within normal ranges.`;
  
  // Update metrics
  const maxCo2 = 1000;
  const maxTemp = 50;
  const maxHumidity = 100;
  const maxCrowd = 100;
  
  refs.metricCo2.textContent = zone.co2;
  refs.metricTemp.textContent = zone.temperature.toFixed(1);
  refs.metricHumidity.textContent = zone.humidity ?? '--';
  refs.metricCrowd.textContent = zone.crowdDensity;
  
  refs.co2Fill.style.width = `${(zone.co2 / maxCo2) * 100}%`;
  refs.tempFill.style.width = `${(zone.temperature / maxTemp) * 100}%`;
  refs.humidityFill.style.width = `${((zone.humidity ?? 50) / maxHumidity) * 100}%`;
  refs.crowdFill.style.width = `${(zone.crowdDensity / maxCrowd) * 100}%`;
}

function render() {
  if (!state.snapshot) return;

  const { scenario, zones, impact } = state.snapshot;

  refs.crowd.value = scenario.crowd;
  refs.crowdValue.textContent = `${scenario.crowd}%`;
  
  refs.heatwave.checked = scenario.heatwave;
  refs.heatwaveText.textContent = scenario.heatwave ? 'Active' : 'Inactive';

  // Render zone list
  renderZoneList(zones);
  
  // Select first zone by default
  if (state.selectedZone === null) {
    selectZone(0);
  } else if (state.selectedZone < zones.length) {
    selectZone(state.selectedZone);
  }

  updateExpectedImpact();

  // Show impact analysis if available
  if (impact) {
    refs.impactAnalysisSection.style.display = 'block';
    
    const co2Diff = impact.after.co2 - impact.before.co2;
    const tempDiff = impact.after.temperature - impact.before.temperature;
    
    const co2Arrow = co2Diff < 0 ? '↓' : '↑';
    const tempArrow = tempDiff < 0 ? '↓' : '↑';
    
    refs.impactCo2Change.textContent = `${co2Arrow} ${Math.abs(co2Diff).toFixed(0)} ppm`;
    refs.impactTempChange.textContent = `${tempArrow} ${Math.abs(tempDiff).toFixed(1)} °C`;
    
    refs.impactCo2Before.textContent = `${impact.before.co2} ppm`;
    refs.impactCo2After.textContent = `${impact.after.co2} ppm`;
    refs.impactTempBefore.textContent = `${impact.before.temperature}°C`;
    refs.impactTempAfter.textContent = `${impact.after.temperature}°C`;
    refs.impactCrowdBefore.textContent = impact.before.crowdDensity + '%';
    refs.impactCrowdAfter.textContent = impact.after.crowdDensity + '%';
    
    // Show success message
    refs.successMessage.innerHTML = `✓ Intervention successful! CO₂ levels reduced by ${Math.abs(co2Diff)} ppm`;
    refs.successMessage.classList.add('visible');
  } else {
    refs.impactAnalysisSection.style.display = 'none';
  }
}
