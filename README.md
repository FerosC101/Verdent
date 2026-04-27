# Environmental Autopilot (Full Project)

AI-driven smart campus platform that continuously senses, predicts, decides, acts, and learns.

## 1) System Architecture Overview

```text
IoT Sensors / Simulated Streams
        ↓
Real-time Processing + Zone Normalization
        ↓
AI Decision Engine (rules + adaptive scoring)
        ↓
Autopilot Actuation (automatic interventions)
        ↓
Impact Measurement (before/after)
        ↓
Learning Loop (action reward updates)
        ↓
Predictive Analytics (2-hour risk forecast)
        ↓
Liquid Dashboard UI (map + widgets)
```

## 2) Key Components and Modules

### Backend
- `server/index.js`
  - HTTP APIs and WebSocket server
  - Tick loop (`3s`) for closed-loop updates
- `server/engine.js`
  - Sensor simulation
  - Zone risk scoring and status classification
  - AI recommendations and explainability
  - Autopilot execution and manual actions
  - Forecast generation and optimization score
- `server/utils.js`
  - Numeric helpers

### Frontend
- `public/index.html`
  - Full map + liquid widget interface with 2D/3D switch
- `public/styles.css`
  - Glassmorphism + neon system visuals
- `public/app.js`
  - Real-time render layer via WebSocket
  - Scenario simulation controls
  - Zone intelligence interactions
  - Impact/prediction/score visualizations
- `public/data/zones.geojson`
  - Zone boundaries (replace with exact campus polygons)
- `public/data/buildings.geojson`
  - Building footprints + heights for 3D extrusion

## 3) User Flow and Interaction Design

1. Open dashboard: **Live Campus Status** is shown.
2. See zone health on full map (`critical/moderate/safe`).
3. Click zone for **Zone Intelligence View**.
4. Inspect **AI Decision Panel** with rationale + recommended actions.
5. Enable/disable **Autopilot**.
6. Run **Scenario Simulation** (crowd/heatwave/path block).
7. Observe **Before vs After** impact updates.
8. Trigger **Predict Next 2 Hours** for proactive risk planning.
9. Watch **Learning Confidence + Optimization Score** evolve.

## 4) AI Decision Logic (Explainable)

1. Compute zone risk from weighted variables:
   - CO₂, temperature, humidity, crowd density, airflow
2. Select hottest zone as intervention target.
3. Derive root cause:
   - crowd concentration, airflow blockage, emission accumulation, heat buildup
4. Score candidate actions using:
   - projected impact utility
   - historical reward (learning)
   - exploration bonus for underused actions
5. Pick best action:
   - auto-execute if autopilot is ON
   - keep manual run controls available
6. Measure deltas and update reward model.

## 5) Sample Data Flow

```json
{
  "zones": [{ "id": "zoneC", "co2": 1260, "temperature": 33.1, "crowdDensity": 84 }],
  "decision": {
    "zoneName": "Central Cafeteria",
    "rootCause": "crowd concentration + airflow blockage",
    "selectedAction": "openVentilationCorridor"
  },
  "impact": {
    "before": { "co2": 1260, "temperature": 33.1 },
    "after": { "co2": 1134, "temperature": 32.2 }
  }
}
```

## 6) Feature Breakdown

- ✅ Full map + widget liquid screen design
- ✅ 2D + 3D campus map modes
- ✅ Real-time IoT signal simulation per zone
- ✅ AI explainability for each intervention
- ✅ Autonomous closed-loop mode (Autopilot)
- ✅ Scenario simulation controls
- ✅ Before/after impact table
- ✅ 2-hour prediction with risk warnings
- ✅ Learning/adaptation through action rewards
- ✅ Campus optimization scoring

## 7) Suggested Tech Stack (Current + Next)

### Implemented in this project
- Node.js + Express + WebSocket (`ws`)
- Vanilla JS + Leaflet (2D) + MapLibre GL (3D) + Canvas + CSS glassmorphism

### Scale-up recommendation
- Frontend: React + TypeScript + ECharts
- Backend: FastAPI/Node with Redis streams
- Storage: TimescaleDB/InfluxDB for historical telemetry
- IoT: MQTT ingestion gateway

## 8) Optional UI Wireframe Layout (Implemented)

- **Top bar**: status + autopilot toggle + prediction trigger
- **Left panel**: scenario controls + zone intelligence + decision panel
- **Center**: full interactive campus map + live KPI cards
- **Right panel**: before/after impact + forecast + risk list + optimization score + event stream

---

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## API Endpoints (Optional control)

- `GET /api/health`
- `GET /api/state`
- `POST /api/scenario`
- `POST /api/autopilot`
- `POST /api/rush-hour`
- `POST /api/manual-action`

## Replace with your exact campus map data

1. Export your campus zones to GeoJSON and overwrite:
  - `public/data/zones.geojson`
2. Export building footprints (with optional `height` property) and overwrite:
  - `public/data/buildings.geojson`
3. Keep `zoneId` in `zones.geojson` aligned with engine zones:
  - `zoneA`, `zoneB`, `zoneC`, `zoneD`, `zoneE`, `zoneF`

Once replaced, both 2D and 3D views update automatically without code changes.
