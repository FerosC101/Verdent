import { EnvironmentalAutopilotEngine } from '../server/engine.js';

const TICK_MS = 3000;

function getEngineState() {
  if (!globalThis.__verdentRuntime) {
    globalThis.__verdentRuntime = {
      engine: new EnvironmentalAutopilotEngine(),
      lastTickMs: Date.now(),
    };
  }
  return globalThis.__verdentRuntime;
}

function advanceEngineByElapsed(runtime) {
  const now = Date.now();
  const elapsed = now - runtime.lastTickMs;
  const steps = Math.max(1, Math.floor(elapsed / TICK_MS));

  for (let i = 0; i < steps; i += 1) {
    runtime.engine.step();
  }

  runtime.lastTickMs = now;
}

function sendJson(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export default function handler(req, res) {
  const runtime = getEngineState();
  advanceEngineByElapsed(runtime);

  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const method = req.method || 'GET';

  if (pathname === '/api/health' && method === 'GET') {
    return sendJson(res, 200, {
      ok: true,
      service: 'environmental-autopilot',
      runtime: 'vercel-serverless',
      ts: new Date().toISOString(),
    });
  }

  if (pathname === '/api/state' && method === 'GET') {
    return sendJson(res, 200, runtime.engine.snapshot());
  }

  if (pathname === '/api/scenario' && method === 'POST') {
    runtime.engine.setScenario(req.body || {});
    return sendJson(res, 200, runtime.engine.snapshot());
  }

  if (pathname === '/api/autopilot' && method === 'POST') {
    runtime.engine.setAutopilot(Boolean(req.body?.enabled));
    return sendJson(res, 200, runtime.engine.snapshot());
  }

  if (pathname === '/api/rush-hour' && method === 'POST') {
    runtime.engine.triggerRushHour();
    return sendJson(res, 200, runtime.engine.snapshot());
  }

  if (pathname === '/api/manual-action' && method === 'POST') {
    const actionId = req.body?.actionId;
    if (!actionId) {
      return sendJson(res, 400, { error: 'actionId is required' });
    }

    runtime.engine.manualAction(actionId);
    return sendJson(res, 200, runtime.engine.snapshot());
  }

  return sendJson(res, 404, { error: 'Not found' });
}
