const refs = {
  scoreSustainability: document.getElementById('scoreSustainability'),
  scoreEmission: document.getElementById('scoreEmission'),
  scoreHeat: document.getElementById('scoreHeat'),
  scoreOverall: document.getElementById('scoreOverall'),
  systemFlow: document.getElementById('systemFlow'),
  riskList: document.getElementById('riskList'),
  eventLog: document.getElementById('eventLog'),
};

const state = { snapshot: null, ws: null };
connectSocket();

function connectSocket() {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  state.ws = new WebSocket(`${protocol}://${location.host}`);

  state.ws.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'snapshot') {
      state.snapshot = data.payload;
      render();
    }
    if (data.type === 'prediction' && state.snapshot) {
      state.snapshot.prediction = data.payload;
      render();
    }
  });

  state.ws.addEventListener('close', () => {
    setTimeout(connectSocket, 1000);
  });
}

function render() {
  if (!state.snapshot) return;

  const score = state.snapshot.score || {};
  refs.scoreSustainability.textContent = score.sustainability ?? '--';
  refs.scoreEmission.textContent = score.emissionTrend ?? '--';
  refs.scoreHeat.textContent = score.heatReduction ?? '--';
  refs.scoreOverall.textContent = score.overall ?? '--';
  refs.systemFlow.textContent = state.snapshot.flow || 'No current system flow available.';

  const risks = state.snapshot.prediction?.risks || [];
  refs.riskList.innerHTML = risks.length
    ? risks.map((r) => `<li><strong>${r.level.toUpperCase()}</strong> · ${r.message}</li>`).join('')
    : '<li>No critical forecast for the next 2 hours.</li>';

  const logs = state.snapshot.ai?.logs || [];
  refs.eventLog.innerHTML = logs.length
    ? logs.slice(0, 20).map((log) => `<li><strong>${log.time}</strong> — ${log.message}</li>`).join('')
    : '<li>No event logs available yet.</li>';
}
