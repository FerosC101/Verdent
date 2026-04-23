# Verdent — Smart Campus Monitoring Dashboard

Verdent is a real-time campus monitoring dashboard with live zone analytics, clickable buildings, AI insights, and a 2D/3D map experience.

## What it does

- Streams live/simulated campus telemetry over WebSocket
- Shows zone health (`safe`, `moderate`, `critical`)
- Supports map filters (temperature, humidity, airflow, heat index, simulation index, crowd, CO2)
- Lets users click buildings/zones for focused metrics and impact analysis
- Includes a 3D campus model experience and digital twin preview card

## Tech stack

- Node.js + Express + `ws`
- Vanilla JavaScript frontend
- Leaflet + MapLibre/Mapbox map rendering
- Three.js + GLTFLoader for GLB assets

## Project structure

- `server/index.js` — API + WebSocket server
- `server/engine.js` — simulation + risk/decision logic
- `server/utils.js` — shared utility helpers
- `public/index.html` — main UI shell
- `public/app.js` — map logic, rendering, interactions
- `public/styles.css` — dashboard styles
- `public/data/zones.geojson` — zone polygons
- `public/data/buildings.geojson` — building polygons
- `public/models/*.glb` — 3D model assets

## Quick start

```bash
npm install
npm run dev
```

Open: `http://localhost:3000`

## Current map behavior

- **2D tab**: interactive campus map with clickable buildings/zones
- **3D tab**: 3D campus model view with rotation controls
- **Building panel**: digital twin preview uses `public/models/building.glb`

## API endpoints

- `GET /api/health`
- `GET /api/state`
- `POST /api/scenario`
- `POST /api/autopilot`
- `POST /api/rush-hour`
- `POST /api/manual-action`

## Data/model replacement notes

1. Replace zones: `public/data/zones.geojson`
2. Replace buildings: `public/data/buildings.geojson`
3. Keep zone IDs aligned with engine zone IDs
4. Replace 3D assets in `public/models/`:
   - `building.glb` for building twin preview
   - `bsu-model.glb` / `bsu model.glb` for campus model scenes

## Notes

- If GLB fails to load, hard-refresh the browser and check file names under `public/models/`.
- If 3D map style/token fails, fallback viewer logic is used where available.
