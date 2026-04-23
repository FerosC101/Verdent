import { avg, clamp, delta, normalize, randomBetween } from './utils.js';

const ACTION_LIBRARY = {
  reroutePedestrians: {
    id: 'reroutePedestrians',
    label: '🚶 Redirect 35% of pedestrians',
    expected: { co2Drop: 80, tempDrop: 1.1, timeMin: 10 },
  },
  openVentilationCorridor: {
    id: 'openVentilationCorridor',
    label: '🌬 Open ventilation corridor',
    expected: { co2Drop: 120, tempDrop: 0.8, timeMin: 8 },
  },
  deployShadeSimulation: {
    id: 'deployShadeSimulation',
    label: '🌳 Deploy temporary shade simulation',
    expected: { co2Drop: 35, tempDrop: 1.8, timeMin: 12 },
  },
  staggerEntry: {
    id: 'staggerEntry',
    label: '🕒 Stagger zone entry window',
    expected: { co2Drop: 70, tempDrop: 0.9, timeMin: 15 },
  },
};

export class EnvironmentalAutopilotEngine {
  constructor() {
    this.autopilot = true;
    this.scenario = {
      crowd: 50,
      heatwave: 20,
      pathBlock: false,
    };

    this.zones = [
      this.createZone('zoneA', 'Engineering Block', 1.15),
      this.createZone('zoneB', 'Library Commons', 1.0),
      this.createZone('zoneC', 'Central Cafeteria', 1.35),
      this.createZone('zoneD', 'Innovation Hub', 1.1),
      this.createZone('zoneE', 'Student Plaza', 1.28),
      this.createZone('zoneF', 'Sports Complex', 1.4),
    ];

    this.history = [];
    this.actionStats = Object.values(ACTION_LIBRARY).reduce((acc, action) => {
      acc[action.id] = { count: 0, rewardSum: 0, successRate: 0 };
      return acc;
    }, {});

    this.logs = [];
    this.latestDecision = null;
    this.lastImpact = null;

    for (let i = 0; i < 20; i += 1) {
      this.simulateSensors();
      this.pushHistory();
    }
  }

  createZone(id, name, sensitivity) {
    return {
      id,
      name,
      sensitivity,
      co2: randomBetween(680, 900),
      temperature: randomBetween(24, 28),
      humidity: randomBetween(44, 56),
      crowdDensity: randomBetween(35, 65),
      airflow: randomBetween(45, 76),
      risk: 0,
      status: 'safe',
    };
  }

  setAutopilot(enabled) {
    this.autopilot = Boolean(enabled);
    this.log(`Autopilot switched ${this.autopilot ? 'ON' : 'OFF'}.`);
  }

  setScenario(partial) {
    this.scenario = {
      ...this.scenario,
      ...partial,
      crowd: clamp(Number(partial.crowd ?? this.scenario.crowd), 0, 100),
      heatwave: clamp(Number(partial.heatwave ?? this.scenario.heatwave), 0, 100),
      pathBlock: Boolean(partial.pathBlock ?? this.scenario.pathBlock),
    };
    this.log(
      `Scenario updated (crowd ${this.scenario.crowd}%, heatwave ${this.scenario.heatwave}%, path block ${this.scenario.pathBlock ? 'ON' : 'OFF'}).`
    );
  }

  triggerRushHour() {
    this.setScenario({ crowd: 90, pathBlock: true });
    this.log('Rush hour simulation injected.');
  }

  manualAction(actionId) {
    if (!ACTION_LIBRARY[actionId]) return;
    const target = this.mostCriticalZone();
    if (!target) return;

    this.executeAction(target.id, actionId, 'manual');
    this.log(`Manual intervention executed: ${ACTION_LIBRARY[actionId].label}`);
  }

  step() {
    this.simulateSensors();

    const decision = this.analyzeAndRecommend();
    this.latestDecision = decision;

    if (this.autopilot && decision?.selectedActionId && decision.zoneId) {
      this.executeAction(decision.zoneId, decision.selectedActionId, 'autopilot');
    }

    this.pushHistory();
    this.updateOptimizationScore();
    this.updateConfidence();

    return this.snapshot();
  }

  simulateSensors() {
    const crowdScenario = this.scenario.crowd / 100;
    const heatScenario = this.scenario.heatwave / 100;
    const pathPenalty = this.scenario.pathBlock ? 0.14 : 0;

    this.zones.forEach((zone) => {
      zone.crowdDensity = clamp(
        zone.crowdDensity + randomBetween(-4, 6) + 23 * crowdScenario * zone.sensitivity,
        10,
        100
      );

      zone.airflow = clamp(
        85 - zone.crowdDensity * 0.56 - heatScenario * 18 - pathPenalty * 100 + randomBetween(-3, 4),
        8,
        95
      );

      zone.co2 = clamp(
        zone.co2 + randomBetween(-22, 30) + zone.crowdDensity * 1.6 - zone.airflow * 0.95 + heatScenario * 16,
        430,
        2200
      );

      zone.temperature = clamp(
        zone.temperature + randomBetween(-0.3, 0.55) + heatScenario * 0.5 + zone.crowdDensity * 0.012 - zone.airflow * 0.004,
        16,
        45
      );

      zone.humidity = clamp(
        zone.humidity + randomBetween(-1.8, 2.5) + heatScenario * 0.8 - zone.airflow * 0.01,
        25,
        90
      );

      zone.risk = this.computeRisk(zone);
      zone.status = this.riskLabel(zone.risk);
    });
  }

  computeRisk(zone) {
    const co2Risk = normalize(zone.co2, 650, 1500);
    const tempRisk = normalize(zone.temperature, 22, 35);
    const humRisk = normalize(zone.humidity, 38, 75);
    const crowdRisk = normalize(zone.crowdDensity, 30, 95);
    const airflowRisk = 1 - normalize(zone.airflow, 20, 88);
    return clamp(co2Risk * 0.34 + tempRisk * 0.26 + humRisk * 0.12 + crowdRisk * 0.18 + airflowRisk * 0.1, 0, 1);
  }

  riskLabel(risk) {
    if (risk >= 0.74) return 'critical';
    if (risk >= 0.45) return 'moderate';
    return 'safe';
  }

  analyzeAndRecommend() {
    const target = this.mostCriticalZone();
    if (!target || target.risk < 0.38) {
      return {
        zoneId: null,
        zoneName: 'Campus-wide',
        insight: 'All monitored zones are in acceptable environmental balance.',
        rootCause: 'No active hotspot requiring intervention.',
        recommendedActions: Object.values(ACTION_LIBRARY).slice(0, 2).map((a) => ({
          ...a,
          expectedDelta: this.projectImpact(target, a.id),
          score: 0,
        })),
        selectedActionId: null,
        explanation: 'Monitoring only: no autonomous action required this cycle.',
      };
    }

    const rootCause = this.deriveRootCause(target);

    const candidates = this.buildCandidateSet(target);
    const scored = candidates
      .map((actionId) => ({
        ...ACTION_LIBRARY[actionId],
        expectedDelta: this.projectImpact(target, actionId),
        score: this.scoreAction(actionId, target),
      }))
      .sort((a, b) => b.score - a.score);

    const selected = scored[0];

    return {
      zoneId: target.id,
      zoneName: target.name,
      insight: `Zone ${target.name} is at ${Math.round(target.risk * 100)}% risk with CO₂ ${Math.round(target.co2)} ppm and temperature ${target.temperature.toFixed(1)}°C.`,
      rootCause,
      recommendedActions: scored.slice(0, 3),
      selectedActionId: selected?.id ?? null,
      explanation: selected
        ? `Based on density-airflow coupling and recent outcomes, ${selected.label} provides the fastest weighted risk reduction.`
        : 'No action selected.',
    };
  }

  deriveRootCause(zone) {
    const signals = [];
    if (zone.crowdDensity > 75) signals.push('crowd concentration');
    if (zone.airflow < 30) signals.push('airflow blockage');
    if (zone.co2 > 1000) signals.push('emission accumulation');
    if (zone.temperature > 31) signals.push('heat buildup');
    if (!signals.length) signals.push('multi-factor drift');
    return `This zone shows a ${signals.join(' + ')} pattern.`;
  }

  buildCandidateSet(zone) {
    const set = new Set(['reroutePedestrians', 'openVentilationCorridor', 'staggerEntry']);
    if (zone.temperature > 30) set.add('deployShadeSimulation');
    return [...set];
  }

  scoreAction(actionId, zone) {
    const stats = this.actionStats[actionId];
    const historical = stats.count === 0 ? 0.15 : stats.rewardSum / stats.count;
    const exp = this.projectImpact(zone, actionId);
    const utility = Math.max(0, -exp.co2Delta) * 0.006 + Math.max(0, -exp.tempDelta) * 0.45 + Math.max(0, -exp.riskDelta) * 2.2;
    const explorationBonus = stats.count === 0 ? 0.12 : 0;
    return historical + utility + explorationBonus;
  }

  projectImpact(zone, actionId) {
    switch (actionId) {
      case 'openVentilationCorridor':
        return {
          co2Delta: -120,
          tempDelta: -0.9,
          humidityDelta: -1.2,
          riskDelta: -0.16,
          etaMin: 8,
        };
      case 'reroutePedestrians':
        return {
          co2Delta: -85,
          tempDelta: -1.0,
          humidityDelta: -0.5,
          riskDelta: -0.13,
          etaMin: 10,
        };
      case 'deployShadeSimulation':
        return {
          co2Delta: -30,
          tempDelta: -1.8,
          humidityDelta: 0.7,
          riskDelta: -0.12,
          etaMin: 12,
        };
      default:
        return {
          co2Delta: -70,
          tempDelta: -0.7,
          humidityDelta: -0.8,
          riskDelta: -0.1,
          etaMin: 15,
        };
    }
  }

  executeAction(zoneId, actionId, mode = 'autopilot') {
    const zone = this.zones.find((z) => z.id === zoneId);
    if (!zone || !ACTION_LIBRARY[actionId]) return;

    const beforeZone = { ...zone };
    const beforeCampus = this.aggregate();

    if (actionId === 'openVentilationCorridor') {
      zone.airflow = clamp(zone.airflow + randomBetween(10, 18), 8, 95);
      zone.co2 = clamp(zone.co2 - randomBetween(90, 140), 430, 2200);
      zone.temperature = clamp(zone.temperature - randomBetween(0.6, 1.1), 16, 45);
      zone.humidity = clamp(zone.humidity - randomBetween(0.8, 1.9), 25, 90);
    } else if (actionId === 'reroutePedestrians') {
      zone.crowdDensity = clamp(zone.crowdDensity - randomBetween(16, 30), 10, 100);
      zone.co2 = clamp(zone.co2 - randomBetween(75, 110), 430, 2200);
      zone.temperature = clamp(zone.temperature - randomBetween(0.7, 1.2), 16, 45);
    } else if (actionId === 'deployShadeSimulation') {
      zone.temperature = clamp(zone.temperature - randomBetween(1.2, 2.0), 16, 45);
      zone.co2 = clamp(zone.co2 - randomBetween(20, 50), 430, 2200);
      zone.humidity = clamp(zone.humidity + randomBetween(0.5, 1.4), 25, 90);
    } else if (actionId === 'staggerEntry') {
      zone.crowdDensity = clamp(zone.crowdDensity - randomBetween(10, 20), 10, 100);
      zone.co2 = clamp(zone.co2 - randomBetween(60, 95), 430, 2200);
      zone.temperature = clamp(zone.temperature - randomBetween(0.4, 0.9), 16, 45);
      zone.humidity = clamp(zone.humidity - randomBetween(0.3, 1.2), 25, 90);
    }

    zone.risk = this.computeRisk(zone);
    zone.status = this.riskLabel(zone.risk);

    const afterCampus = this.aggregate();

    const reward = (beforeZone.risk - zone.risk) * 1.8 + (beforeZone.co2 - zone.co2) / 500 + (beforeZone.temperature - zone.temperature) / 6;
    const stats = this.actionStats[actionId];
    stats.count += 1;
    stats.rewardSum += reward;
    stats.successRate = clamp((stats.successRate * (stats.count - 1) + (reward > 0 ? 1 : 0)) / stats.count, 0, 1);

    this.lastImpact = {
      zoneId,
      zoneName: zone.name,
      mode,
      actionId,
      actionLabel: ACTION_LIBRARY[actionId].label,
      before: {
        co2: Math.round(beforeZone.co2),
        temperature: Number(beforeZone.temperature.toFixed(1)),
        crowdDensity: Math.round(beforeZone.crowdDensity),
      },
      after: {
        co2: Math.round(zone.co2),
        temperature: Number(zone.temperature.toFixed(1)),
        crowdDensity: Math.round(zone.crowdDensity),
      },
      delta: {
        co2: delta(beforeZone.co2, zone.co2),
        temperature: delta(beforeZone.temperature, zone.temperature),
        crowdDensity: delta(beforeZone.crowdDensity, zone.crowdDensity),
      },
      campusDelta: {
        co2: delta(beforeCampus.avgCo2, afterCampus.avgCo2),
        temperature: delta(beforeCampus.avgTemperature, afterCampus.avgTemperature),
        humidity: delta(beforeCampus.avgHumidity, afterCampus.avgHumidity),
      },
    };

    this.log(`${mode === 'autopilot' ? 'Autopilot' : 'Operator'} applied ${ACTION_LIBRARY[actionId].label} in ${zone.name}.`);
  }

  aggregate() {
    return {
      avgCo2: avg(this.zones.map((z) => z.co2)),
      avgTemperature: avg(this.zones.map((z) => z.temperature)),
      avgHumidity: avg(this.zones.map((z) => z.humidity)),
      avgAirflow: avg(this.zones.map((z) => z.airflow)),
      avgRisk: avg(this.zones.map((z) => z.risk)),
    };
  }

  pushHistory() {
    const now = new Date();
    const campus = this.aggregate();
    this.history.push({
      timestamp: now.toISOString(),
      co2: campus.avgCo2,
      temperature: campus.avgTemperature,
      humidity: campus.avgHumidity,
      risk: campus.avgRisk,
    });
    if (this.history.length > 120) this.history.shift();
  }

  mostCriticalZone() {
    return this.zones.reduce((worst, zone) => (zone.risk > (worst?.risk ?? -1) ? zone : worst), null);
  }

  updateConfidence() {
    const actions = Object.values(this.actionStats);
    const totalExecutions = actions.reduce((sum, s) => sum + s.count, 0);
    const avgReward = actions.reduce((sum, s) => sum + (s.count ? s.rewardSum / s.count : 0), 0) / actions.length;
    this.confidence = clamp(58 + totalExecutions * 0.6 + avgReward * 35, 35, 99);
  }

  linearSlope(series, key) {
    const data = series.map((item) => item[key]);
    const n = data.length;
    if (n < 2) return 0;

    const xMean = (n - 1) / 2;
    const yMean = avg(data);
    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i += 1) {
      numerator += (i - xMean) * (data[i] - yMean);
      denominator += (i - xMean) ** 2;
    }

    return denominator ? numerator / denominator : 0;
  }

  forecast(hours = 2) {
    const points = [];
    const window = this.history.slice(-20);
    const latest = window[window.length - 1] ?? this.aggregate();

    const co2Slope = this.linearSlope(window, 'co2') * 1.2;
    const tempSlope = this.linearSlope(window, 'temperature') * 1.15;
    const riskSlope = this.linearSlope(window, 'risk') * 1.05;

    const steps = Math.max(4, Math.floor((hours * 60) / 15));

    for (let i = 1; i <= steps; i += 1) {
      const t = i * 15;
      const crowdPressure = this.scenario.crowd / 100;
      const heatPressure = this.scenario.heatwave / 100;
      const pathPenalty = this.scenario.pathBlock ? 24 : 0;

      const projectedCo2 = clamp(
        latest.co2 + co2Slope * i + crowdPressure * 60 + heatPressure * 15 + pathPenalty,
        430,
        2200
      );

      const projectedTemp = clamp(latest.temperature + tempSlope * i + heatPressure * 1.8 + crowdPressure * 0.6, 16, 45);

      const projectedRisk = clamp(latest.risk + riskSlope * i + crowdPressure * 0.08 + (this.scenario.pathBlock ? 0.08 : 0), 0, 1);

      points.push({
        minute: t,
        co2: Number(projectedCo2.toFixed(1)),
        temperature: Number(projectedTemp.toFixed(2)),
        risk: Number(projectedRisk.toFixed(3)),
      });
    }

    const risks = points
      .filter((p) => p.co2 >= 1200 || p.temperature >= 32 || p.risk >= 0.72)
      .map((p) => ({
        minute: p.minute,
        level: p.risk >= 0.82 ? 'critical' : 'warning',
        message: `Projected hotspot risk at +${p.minute} min (CO₂ ${Math.round(p.co2)} ppm, ${p.temperature.toFixed(1)}°C).`,
      }));

    return { horizonHours: hours, points, risks };
  }

  updateOptimizationScore() {
    const current = this.aggregate();
    const last30 = this.history.slice(-30);
    const baselineCo2 = avg(last30.map((h) => h.co2)) || current.avgCo2;
    const baselineTemp = avg(last30.map((h) => h.temperature)) || current.avgTemperature;

    const co2Improvement = clamp((baselineCo2 - current.avgCo2) / 4, -20, 25);
    const tempImprovement = clamp((baselineTemp - current.avgTemperature) * 8, -20, 25);

    const sustainability = clamp(68 + co2Improvement + tempImprovement - current.avgRisk * 28, 0, 100);
    const emissionTrend = clamp(70 + co2Improvement * 1.1 - current.avgRisk * 18, 0, 100);
    const heatReduction = clamp(69 + tempImprovement * 1.2 - current.avgRisk * 14, 0, 100);

    this.optimizationScore = {
      sustainability: Number(sustainability.toFixed(1)),
      emissionTrend: Number(emissionTrend.toFixed(1)),
      heatReduction: Number(heatReduction.toFixed(1)),
      overall: Number(avg([sustainability, emissionTrend, heatReduction]).toFixed(1)),
    };
  }

  log(message) {
    this.logs.unshift({
      time: new Date().toLocaleTimeString(),
      message,
    });
    if (this.logs.length > 35) this.logs.pop();
  }

  snapshot() {
    const campus = this.aggregate();
    const prediction = this.forecast(2);

    return {
      timestamp: new Date().toISOString(),
      autopilot: this.autopilot,
      systemStatus: this.autopilot ? 'ACTIVE' : 'MANUAL',
      scenario: this.scenario,
      campus: {
        avgCo2: Number(campus.avgCo2.toFixed(1)),
        avgTemperature: Number(campus.avgTemperature.toFixed(2)),
        avgHumidity: Number(campus.avgHumidity.toFixed(1)),
        avgAirflow: Number(campus.avgAirflow.toFixed(1)),
        avgRisk: Number(campus.avgRisk.toFixed(3)),
      },
      zones: this.zones.map((z) => ({
        id: z.id,
        name: z.name,
        co2: Math.round(z.co2),
        temperature: Number(z.temperature.toFixed(1)),
        humidity: Math.round(z.humidity),
        crowdDensity: Math.round(z.crowdDensity),
        airflow: Math.round(z.airflow),
        risk: Number(z.risk.toFixed(3)),
        status: z.status,
      })),
      ai: {
        latestDecision: this.latestDecision,
        confidence: Number((this.confidence ?? 60).toFixed(1)),
        actionStats: this.actionStats,
        logs: this.logs,
      },
      impact: this.lastImpact,
      prediction,
      score: this.optimizationScore,
      flow: 'IoT Sensors → Data Processing → AI Analysis → Decision Engine → Action (Auto/Manual) → Impact Measurement → Learning Loop',
    };
  }
}
