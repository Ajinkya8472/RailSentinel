import trains from './trains.json';
import incidents from './incidents.json';
import risks from './risk.json';
import useTrainStore from '../store/trainStore';
import useIncidentStore from '../store/incidentStore';
import useRiskStore from '../store/riskStore';
import useCrowdStore from '../store/crowdStore';
import useUiStore from '../store/uiStore';

const now = new Date().toISOString();

const CROWD_FORECASTS = [
  {
    id: 'CRD-NDLS-P4',
    stationName: 'New Delhi',
    platformId: '4',
    crowdDensityPct: 92,
    breachProbability: 0.87,
    confidenceBand: 'high',
    horizon: '22 min',
    generatedAt: now,
  },
  {
    id: 'CRD-PRYJ-P2',
    stationName: 'Prayagraj Jn',
    platformId: '2',
    crowdDensityPct: 84,
    breachProbability: 0.72,
    confidenceBand: 'high',
    horizon: '30 min',
    generatedAt: now,
  },
  {
    id: 'CRD-CNB-P6',
    stationName: 'Kanpur Central',
    platformId: '6',
    crowdDensityPct: 68,
    breachProbability: 0.41,
    confidenceBand: 'medium',
    horizon: '18 min',
    generatedAt: now,
  },
  {
    id: 'CRD-MMCT-P1',
    stationName: 'Mumbai Central',
    platformId: '1',
    crowdDensityPct: 55,
    breachProbability: 0.24,
    confidenceBand: 'medium',
    horizon: '35 min',
    generatedAt: now,
  },
];

function enrichTrain(train, index) {
  const delay = Number(train.delayMinutes ?? 0);
  const efficiency = Math.max(48, Math.min(96, 88 - Math.max(0, delay / 4) - (index % 3) * 4));

  return {
    ...train,
    number: train.trainNumber ?? train.number,
    routeName: train.routeId?.replace('RTE-', '').replaceAll('-', ' -> ') ?? train.routeName,
    operatorName: 'Indian Railways',
    serviceType: train.name?.includes('Rajdhani') ? 'premium' : 'express',
    delay,
    energyConsumption: 820 + index * 46 + Math.max(0, delay * 7),
    energyEfficiency: Math.round(efficiency),
    energyAnomaly: train.healthStatus === 'fault' || delay >= 90,
    lastUpdatedAt: now,
  };
}

// src/mock/bootstrapDemoData.js
// Update this specific parsing function to maintain backend parameter alignment:

function enrichIncident(incident) {
  const text = `${incident.title} ${incident.description}`;
  const isCrowd = /medical|crowd|waterlogging/i.test(text);
  const isSchedule = /signal|track circuit|point|halt|delay/i.test(text);

  return {
    ...incident,
    // 💡 THE FIX: Retain original explicit status indicators for backend endpoint sync
    status: incident.status, 
    type: isCrowd ? 'crowd' : isSchedule ? 'schedule' : 'incident',
    category: isCrowd ? 'crowd' : isSchedule ? 'schedule' : 'operations',
    locationName: incident.locationName ?? 'North Central Zone',
    lastUpdatedAt: incident.updatedAt ?? incident.createdAt ?? now,
  };
}

function enrichRisk(risk, index) {
  const sourceDomains = Array.isArray(risk.sourceDomains) ? risk.sourceDomains : [];
  const category = sourceDomains.includes('energy')
    ? 'energy'
    : sourceDomains.includes('schedule')
      ? 'schedule'
      : sourceDomains.includes('crowd')
        ? 'crowd'
        : 'compound';

  return {
    ...risk,
    name: risk.title ?? `Compound ${category} risk`,
    title: risk.title ?? `Compound ${category} risk`,
    category,
    source: sourceDomains.join(', ') || 'risk-core',
    severityScore: risk.severityScore ?? risk.score ?? 0,
    severityBand: risk.severityBand ?? risk.level ?? 'unknown',
    computedAt: risk.computedAt ?? new Date(Date.now() - index * 30000).toISOString(),
  };
}

export function bootstrapDemoData() {
  const trainStore = useTrainStore.getState();
  const incidentStore = useIncidentStore.getState();
  const riskStore = useRiskStore.getState();
  const crowdStore = useCrowdStore.getState();
  const uiStore = useUiStore.getState();

  if (trainStore.trainIds.length === 0) {
    trainStore.setTrains(trains.map(enrichTrain));
    trainStore.selectTrain(trains[1]?.id ?? null);
  }

  if (incidentStore.incidentIds.length === 0) {
    incidentStore.setIncidents(incidents.map(enrichIncident));
    incidentStore.selectIncident(incidents[0]?.id ?? null);
  }

  if (riskStore.riskScoreIds.length === 0) {
    riskStore.setRiskScores(risks.map(enrichRisk));
    riskStore.selectRiskScore(risks[0]?.id ?? null);
  }

  if (crowdStore.crowdForecastIds.length === 0) {
    crowdStore.setCrowdForecasts(CROWD_FORECASTS);
    crowdStore.selectCrowdForecast(CROWD_FORECASTS[0]?.id ?? null);
  }

  uiStore.setStatusMessage('Demo command room running with simulated live operations.');
}
