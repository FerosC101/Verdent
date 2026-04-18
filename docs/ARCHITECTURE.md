# Environmental Autopilot - Architecture Diagram Notes

## Runtime Layers

1. **Sensor Layer**
   - Real or simulated IoT feeds: CO₂, temperature, humidity, crowd, airflow

2. **Ingestion/Normalization Layer**
   - Every 3 seconds, each zone is updated and normalized into risk vectors

3. **AI Reasoning Layer**
   - Risk scoring
   - Root-cause derivation
   - Candidate action scoring
   - Explainable recommendation text

4. **Autonomous Control Layer**
   - Applies best action when autopilot is ON
   - Allows operator override for manual action testing

5. **Evaluation + Learning Layer**
   - Captures before/after deltas
   - Updates action reward statistics
   - Increases/decreases confidence over time

6. **Prediction Layer**
   - 2-hour projection with 15-min intervals
   - Flags potential critical windows

7. **Experience Layer**
   - Full map, liquid widgets, impact visualizations, logs, scoring

## Event Loop

- `simulateSensors()`
- `analyzeAndRecommend()`
- `executeAction()` (if autopilot and action selected)
- `pushHistory()`
- `forecast()`
- broadcast snapshot via WebSocket

## Design Intent

From passive monitoring to active environmental autonomy:

- sensing → understanding → action → measurable result → adaptation
