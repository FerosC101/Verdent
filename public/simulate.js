const refs = {
  crowd: document.getElementById('crowd'),
  heatwave: document.getElementById('heatwave'),
  pathBlock: document.getElementById('pathBlock'),
  crowdValue: document.getElementById('crowdValue'),
  heatwaveValue: document.getElementById('heatwaveValue'),
  rushHour: document.getElementById('rushHour'),
  zoneResponses: document.getElementById('zoneResponses'),
  impactTable: document.getElementById('impactTable').querySelector('tbody'),
};

const state = { snapshot: null, ws: null };

bindControls();
connectSocket();

function bindControls() {
  refs.crowd.addEventListener('input', () => {
    refs.crowdValue.textContent = `${refs.crowd.value}%`;
    sendScenario();
  });

  refs.heatwave.addEventListener('input', () => {
    refs.heatwaveValue.textContent = `${refs.heatwave.value}%`;
    sendScenario();
  });

  refs.pathBlock.addEventListener('change', sendScenario);
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
      heatwave: Number(refs.heatwave.value),
      pathBlock: refs.pathBlock.checked,
    },
  });
}

function render() {
  if (!state.snapshot) return;

  const { scenario, zones, impact } = state.snapshot;

  refs.crowd.value = scenario.crowd;
  refs.heatwave.value = scenario.heatwave;
  refs.pathBlock.checked = scenario.pathBlock;
  refs.crowdValue.textContent = `${scenario.crowd}%`;
  refs.heatwaveValue.textContent = `${scenario.heatwave}%`;

  refs.zoneResponses.innerHTML = zones
    .map((zone) => `<li><strong>${zone.name}</strong> · ${zone.status.toUpperCase()} · CO₂ ${zone.co2} ppm · Temp ${zone.temperature.toFixed(1)}°C · Crowd ${zone.crowdDensity}%</li>`)
    .join('');

  if (!impact) return;

  refs.impactTable.innerHTML = `
    <tr><td>CO₂</td><td>${impact.before.co2} ppm</td><td>${impact.after.co2} ppm</td></tr>
    <tr><td>Temp</td><td>${impact.before.temperature}°C</td><td>${impact.after.temperature}°C</td></tr>
    <tr><td>Crowd</td><td>${impact.before.crowdDensity}%</td><td>${impact.after.crowdDensity}%</td></tr>
    <tr><td>Humidity</td><td>${impact.before.humidity ?? '--'}%</td><td>${impact.after.humidity ?? '--'}%</td></tr>
  `;
}
