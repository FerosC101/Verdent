import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { EnvironmentalAutopilotEngine } from './engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
const engine = new EnvironmentalAutopilotEngine();

const PORT = process.env.PORT || 3000;
const TICK_MS = 3000;

app.use(express.json());
app.use(express.static(publicDir));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'environmental-autopilot', ts: new Date().toISOString() });
});

app.get('/api/state', (_req, res) => {
  res.json(engine.snapshot());
});

app.post('/api/scenario', (req, res) => {
  engine.setScenario(req.body || {});
  res.json(engine.snapshot());
});

app.post('/api/autopilot', (req, res) => {
  engine.setAutopilot(Boolean(req.body?.enabled));
  res.json(engine.snapshot());
});

app.post('/api/rush-hour', (_req, res) => {
  engine.triggerRushHour();
  res.json(engine.snapshot());
});

app.post('/api/manual-action', (req, res) => {
  const actionId = req.body?.actionId;
  if (!actionId) return res.status(400).json({ error: 'actionId is required' });
  engine.manualAction(actionId);
  return res.json(engine.snapshot());
});

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'snapshot', payload: engine.snapshot() }));

  ws.on('message', (raw) => {
    try {
      const message = JSON.parse(raw.toString());
      if (message.type === 'set-autopilot') {
        engine.setAutopilot(Boolean(message.enabled));
      }

      if (message.type === 'set-scenario') {
        engine.setScenario(message.payload || {});
      }

      if (message.type === 'trigger-rush-hour') {
        engine.triggerRushHour();
      }

      if (message.type === 'manual-action') {
        engine.manualAction(message.actionId);
      }

      if (message.type === 'predict') {
        const payload = {
          type: 'prediction',
          payload: engine.forecast(Number(message.hours) || 2),
        };
        ws.send(JSON.stringify(payload));
      }
    } catch (error) {
      ws.send(JSON.stringify({ type: 'error', payload: { message: error.message } }));
    }
  });
});

setInterval(() => {
  const state = engine.step();
  const packet = JSON.stringify({ type: 'snapshot', payload: state });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(packet);
    }
  });
}, TICK_MS);

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Environmental Autopilot running on http://localhost:${PORT}`);
});
