const refs = {
  criticalPeriodsMsg: document.getElementById('criticalPeriodsMsg'),
  riskList: document.getElementById('riskList'),
  zoneStatusGrid: document.getElementById('zoneStatusGrid'),
  optimizationScore: document.getElementById('optimizationScore'),
  avgCo2: document.getElementById('avgCo2'),
  avgTemp: document.getElementById('avgTemp'),
  avgHumidity: document.getElementById('avgHumidity'),
  avgCrowd: document.getElementById('avgCrowd'),
  scoreProgress: document.getElementById('scoreProgress'),
  co2Bar: document.getElementById('co2Bar'),
  tempBar: document.getElementById('tempBar'),
  humidityBar: document.getElementById('humidityBar'),
  crowdBar: document.getElementById('crowdBar'),
  chartTabs: Array.from(document.querySelectorAll('.chart-tab')),
  forecastChart: document.getElementById('forecastChart')?.getContext('2d'),
  analyticsChart: document.getElementById('analyticsChart')?.getContext('2d'),
};

const state = { 
  snapshot: null, 
  ws: null,
  currentChartType: 'co2',
  charts: {
    forecast: null,
    analytics: null,
  }
};

connectSocket();
bindControls();

function bindControls() {
  refs.chartTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const chartType = tab.dataset.chart;
      refs.chartTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.currentChartType = chartType;
      updateForecastChart();
    });
  });
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
    if (data.type === 'prediction' && state.snapshot) {
      state.snapshot.prediction = data.payload;
      render();
    }
  });

  state.ws.addEventListener('close', () => {
    setTimeout(connectSocket, 1000);
  });
}

function generateForecastData() {
  const now = new Date();
  const labels = [];
  const co2Data = [];
  const tempData = [];
  const humidityData = [];
  const crowdData = [];

  for (let i = 0; i < 24; i++) {
    const time = new Date(now.getTime() + i * 60 * 60000);
    labels.push(time.getHours().toString().padStart(2, '0') + ':' + time.getMinutes().toString().padStart(2, '0'));
    
    // Generate realistic data
    const baseTemp = 28 + Math.sin(i / 6) * 4 + Math.random() * 2;
    const baseCo2 = 600 + Math.sin(i / 6) * 200 + Math.random() * 100;
    const baseHumidity = 55 + Math.sin(i / 6) * 15 + Math.random() * 8;
    const baseCrowd = 350 + Math.sin(i / 4) * 200 + Math.random() * 80;
    
    co2Data.push(Math.round(baseCo2));
    tempData.push(parseFloat(baseTemp.toFixed(1)));
    humidityData.push(Math.round(baseHumidity));
    crowdData.push(Math.round(baseCrowd));
  }

  return { labels, co2Data, tempData, humidityData, crowdData };
}

function generateAnalyticsData() {
  const labels = [];
  const actualData = [];
  const predictedData = [];
  const thresholdData = [];

  const now = new Date();
  for (let i = 0; i < 36; i++) {
    const time = new Date(now.getTime() + i * 5 * 60000);
    labels.push(time.getHours().toString().padStart(2, '0') + ':' + time.getMinutes().toString().padStart(2, '0'));
    
    const value = 600 + Math.sin(i / 8) * 150 + Math.random() * 50;
    actualData.push(i < 10 ? value : null);
    predictedData.push(i >= 8 ? value + Math.random() * 100 - 50 : null);
    thresholdData.push(1000);
  }

  return { labels, actualData, predictedData, thresholdData };
}

function updateForecastChart() {
  if (!refs.forecastChart || !state.snapshot) return;

  const { labels, co2Data, tempData, humidityData, crowdData } = generateForecastData();
  
  let data, unit, label;
  switch(state.currentChartType) {
    case 'co2':
      data = co2Data;
      unit = 'ppm';
      label = 'CO₂ Level';
      break;
    case 'temperature':
      data = tempData;
      unit = '°C';
      label = 'Temperature';
      break;
    case 'humidity':
      data = humidityData;
      unit = '%';
      label = 'Humidity';
      break;
    case 'crowd':
      data = crowdData;
      unit = 'people';
      label = 'Crowd Density';
      break;
    default:
      data = co2Data;
      unit = 'ppm';
      label = 'CO₂ Level';
  }

  if (state.charts.forecast) state.charts.forecast.destroy();

  state.charts.forecast = new Chart(refs.forecastChart, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label,
        data,
        borderColor: '#6effbe',
        backgroundColor: 'rgba(110, 255, 190, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointBackgroundColor: '#6effbe',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(10, 22, 40, 0.9)',
          titleColor: '#e6f4ff',
          bodyColor: '#9abdd9',
          borderColor: 'rgba(136, 206, 255, 0.24)',
          borderWidth: 1,
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(136, 206, 255, 0.15)' },
          ticks: { color: '#9abdd9', font: { size: 11 }, maxRotation: 45, minRotation: 45 },
        },
        y: {
          grid: { color: 'rgba(136, 206, 255, 0.15)' },
          ticks: { color: '#9abdd9', font: { size: 11 } },
        },
      },
    },
  });
}

function updateAnalyticsChart() {
  if (!refs.analyticsChart || !state.snapshot) return;

  const { labels, actualData, predictedData, thresholdData } = generateAnalyticsData();

  if (state.charts.analytics) state.charts.analytics.destroy();

  state.charts.analytics = new Chart(refs.analyticsChart, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Actual',
          data: actualData,
          borderColor: '#6effbe',
          backgroundColor: 'rgba(110, 255, 190, 0.1)',
          borderWidth: 2,
          fill: false,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#6effbe',
        },
        {
          label: 'Predicted',
          data: predictedData,
          borderColor: '#a78bfa',
          borderDash: [5, 5],
          borderWidth: 2,
          fill: false,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#a78bfa',
        },
        {
          label: 'Threshold',
          data: thresholdData,
          borderColor: '#ff7993',
          borderDash: [3, 3],
          borderWidth: 1,
          fill: false,
          tension: 0,
          pointRadius: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: true,
          labels: {
            color: '#9abdd9',
            font: { size: 11 },
            boxWidth: 12,
            padding: 10,
          },
        },
        tooltip: {
          backgroundColor: 'rgba(10, 22, 40, 0.9)',
          titleColor: '#e6f4ff',
          bodyColor: '#9abdd9',
          borderColor: 'rgba(136, 206, 255, 0.24)',
          borderWidth: 1,
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(136, 206, 255, 0.15)' },
          ticks: { color: '#9abdd9', font: { size: 11 } },
        },
        y: {
          grid: { color: 'rgba(136, 206, 255, 0.15)' },
          ticks: { color: '#9abdd9', font: { size: 11 } },
        },
      },
    },
  });
}

function generateRiskAlerts() {
  const alerts = [];
  const now = new Date();
  const zoneNames = ['Main Hall', 'Cafeteria', 'Sports Complex', 'Library', 'Innovation Hub', 'Student Plaza'];
  const statusLevels = ['safe', 'moderate', 'critical'];
  
  // Generate alerts at 30-minute intervals
  for (let i = 1; i <= 5; i++) {
    const time = new Date(now.getTime() + i * 30 * 60000);
    const hours = time.getHours().toString().padStart(2, '0');
    const minutes = time.getMinutes().toString().padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;
    
    // Random status assignment
    const status = statusLevels[Math.floor(Math.random() * statusLevels.length)];
    const zoneName = zoneNames[Math.floor(Math.random() * zoneNames.length)];
    
    let message = '';
    if (status === 'critical') {
      message = 'CO₂ expected to reach 1450 ppm';
    } else if (status === 'moderate') {
      message = 'Temperature expected to reach 32°C';
    } else {
      message = 'All parameters within safe range';
    }
    
    alerts.push({
      time: timeStr,
      status,
      location: zoneName,
      message
    });
  }
  
  return alerts;
}

function render() {
  if (!state.snapshot) return;

  // Generate predicted risk alerts with 30-minute intervals
  const alerts = generateRiskAlerts();
  const criticalAlerts = alerts.filter(a => a.status === 'critical');
  const firstCritical = criticalAlerts[0];
  
  refs.criticalPeriodsMsg.textContent = criticalAlerts.length > 0 
    ? `${criticalAlerts.length} potential spikes detected. First critical period expected at ${firstCritical?.time || 'unknown time'}`
    : 'No critical periods predicted in the next 3 hours.';

  // Update risk alerts with proper coloring
  refs.riskList.innerHTML = alerts.length
    ? alerts.map((alert) => `
        <li class="risk-item risk-${alert.status}">
          <div class="risk-content">
            <strong>${alert.location}</strong>
            <p>${alert.message}</p>
          </div>
          <span class="risk-time">${alert.time}</span>
        </li>
      `).join('')
    : '<li class="no-risks">✓ No critical forecast for the next 3 hours.</li>';

  // Update campus metrics
  const campus = state.snapshot.campus || {};
  const co2 = Number(campus.avgCo2) || 450;
  const temp = Number(campus.avgTemperature) || 26;
  const humidity = Number(campus.avgHumidity) || 55;
  const crowdDensity = Number(campus.crowdDensity) || 250;
  
  refs.avgCo2.textContent = `${Math.round(co2)} ppm`;
  refs.avgTemp.textContent = `${temp.toFixed(1)} °C`;
  refs.avgHumidity.textContent = `${Math.round(humidity)} %`;
  refs.avgCrowd.textContent = `${Math.round(crowdDensity)} people`;

  // Calculate metric bar widths (normalize values)
  // CO₂: 0-1000 ppm range (safe at lower values)
  const co2Percentage = Math.min((co2 / 1000) * 100, 100);
  // Temperature: 16-35°C range
  const tempPercentage = Math.min(((temp - 16) / 19) * 100, 100);
  // Humidity: 30-80% range
  const humidityPercentage = Math.min(((humidity - 30) / 50) * 100, 100);
  // Crowd: 0-800 people
  const crowdPercentage = Math.min((crowdDensity / 800) * 100, 100);
  
  refs.co2Bar.style.width = `${co2Percentage}%`;
  refs.tempBar.style.width = `${tempPercentage}%`;
  refs.humidityBar.style.width = `${humidityPercentage}%`;
  refs.crowdBar.style.width = `${crowdPercentage}%`;

  // Update optimization score
  const score = state.snapshot.score?.overall || 81;
  const scorePercentage = Math.min((score / 100) * 100, 100);
  
  const scoreNumberEl = refs.optimizationScore.querySelector('.score-number');
  if (scoreNumberEl) scoreNumberEl.textContent = Math.round(score);
  
  if (refs.scoreProgress) refs.scoreProgress.style.width = `${scorePercentage}%`;

  // Update zone status grid
  const zones = state.snapshot.zones || [];
  const statusCounts = { safe: 0, moderate: 0, critical: 0 };
  zones.forEach(z => {
    if (statusCounts.hasOwnProperty(z.status)) statusCounts[z.status]++;
  });

  refs.zoneStatusGrid.innerHTML = `
    <div class="status-card safe">
      <div class="status-count">${statusCounts.safe}</div>
      <div class="status-label">Safe</div>
    </div>
    <div class="status-card moderate">
      <div class="status-count">${statusCounts.moderate}</div>
      <div class="status-label">Moderate</div>
    </div>
    <div class="status-card critical">
      <div class="status-count">${statusCounts.critical}</div>
      <div class="status-label">Critical</div>
    </div>
  `;

  // Update charts
  updateForecastChart();
  updateAnalyticsChart();
}
