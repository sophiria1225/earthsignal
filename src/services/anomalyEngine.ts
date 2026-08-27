/**
 * EarthSignal - Robust Anomaly Score Engine (v2.0)
 * Uses only available observations and real baselines; missing categories remain unscored.
 * Uses Median, MAD, Robust Z-score, Logistic 0-100 scaling, and Quality Coefficients
 */

import { CellScore, Observation, ScoreContributor } from '../types';

export const CURRENT_OBSERVATION_WINDOW_MS = 24 * 60 * 60_000;

/** 現在の異常度に採用できる、直近24時間の確定済み端末観測だけを返す。 */
export function filterCurrentObservations(
  observations: Observation[],
  now = Date.now()
): Observation[] {
  return observations.filter(observation => {
    const observedAt = Date.parse(observation.observedAt);
    return observation.status === 'finalized'
      && Number.isFinite(observedAt)
      && observedAt >= now - CURRENT_OBSERVATION_WINDOW_MS
      && observedAt <= now + 5 * 60_000;
  });
}

export interface BaselineStats {
  median: number;
  mad: number; // Median Absolute Deviation
  sampleCount: number;
}

export interface FeatureInput {
  name: string;
  displayName: string;
  category: 'earthquake' | 'weather' | 'social' | 'animal_audio' | 'other_audio' | 'citizen_report';
  currentValue: number;
  baseline: BaselineStats;
  weight: number;
  direction?: 'up' | 'down' | 'both';
  unit?: string;
}

/**
 * 14.2 ロバストZスコア (v2.0)
 * z_r = 0.6745 * (x - median) / (MAD + epsilon)
 */
export function calculateRobustZ(
  value: number,
  median: number,
  mad: number,
  direction: 'up' | 'down' | 'both' = 'both',
  eps = 1e-6
): number | null {
  const safeMad = Math.max(mad, eps);
  let z = (0.6745 * (value - median)) / safeMad;

  if (direction === 'up') z = Math.max(0, z);
  if (direction === 'down') z = Math.max(0, -z);
  if (direction === 'both') z = Math.abs(z);

  return z;
}

/**
 * 14.3 0〜100へのロジスティック変換 (v2.0)
 * A(z) = 100 / (1 + exp(-1.15 * (z - 2.0)))
 */
export function robustAnomalyScore(
  current: number,
  median: number,
  mad: number,
  direction: 'up' | 'down' | 'both' = 'both'
): number {
  const z = calculateRobustZ(current, median, mad, direction);
  if (z === null) return 0;
  const score = 100 / (1 + Math.exp(-1.15 * (z - 2.0)));
  return Math.round(Math.min(100, Math.max(0, score)) * 10) / 10;
}

/**
 * 品質係数 (0.0〜1.0)
 * 実際に確認できる鮮度・標本充足度・採用カテゴリ範囲だけで構成する。
 */
export function calculateQualityScore(params: {
  sampleCount: number;
  targetSamples?: number;
  sourceAvailability?: number;
  minutesSinceUpdate?: number;
  isHighWindOrRain?: boolean;
}): number {
  const {
    sampleCount,
    targetSamples = 30,
    sourceAvailability = 0,
    minutesSinceUpdate = 999,
    isHighWindOrRain = false,
  } = params;

  // 鮮度 (0..1)
  const freshness = Math.max(0.2, 1.0 - (minutesSinceUpdate / 180));
  // 標本充足度 q_sample = min(1, sqrt(n / n_target))
  const sampleAdequacy = Math.min(1.0, Math.sqrt(Math.max(0, sampleCount) / targetSamples));
  const weatherPenalty = isHighWindOrRain ? 0.75 : 1.0;

  const value =
    0.40 * freshness * weatherPenalty +
    0.40 * sampleAdequacy +
    0.20 * Math.max(0, Math.min(1, sourceAvailability));

  return Math.max(0.05, Math.min(1.0, Math.round(value * 100) / 100));
}

/**
 * 14.7 総合観測異常度の計算 (v2.0)
 * 重み: 公式地震 0.30, 気象 0.20, SNS 0.20, ユーザー観測 0.15, 動物音響 0.15
 */
export function computeCellScore(
  features: FeatureInput[],
  weatherInfo: { windSpeed: number; precipitation: number; minutesSinceUpdate: number },
  uniqueUserCount: number,
  socialAnomalyScore?: number | null
): CellScore {
  const isBadWeather = weatherInfo.windSpeed >= 6.0 || weatherInfo.precipitation >= 2.0;
  const confounders: string[] = [];

  if (weatherInfo.windSpeed >= 6.0) {
    confounders.push(`強風(${weatherInfo.windSpeed}m/s)による音響品質補正適用中`);
  }
  if (weatherInfo.precipitation >= 2.0) {
    confounders.push(`降雨(${weatherInfo.precipitation}mm)による環境音分離`);
  }
  if (uniqueUserCount < 3) {
    confounders.push(`市民観測は${uniqueUserCount}件のため、3件に達するまで市民観測スコアへ採用しません`);
  }

  const categoryScores: Record<string, { totalScoreWeight: number; totalWeight: number; count: number }> = {
    earthquake: { totalScoreWeight: 0, totalWeight: 0, count: 0 },
    weather: { totalScoreWeight: 0, totalWeight: 0, count: 0 },
    social: { totalScoreWeight: 0, totalWeight: 0, count: 0 },
    animal_audio: { totalScoreWeight: 0, totalWeight: 0, count: 0 },
    other_audio: { totalScoreWeight: 0, totalWeight: 0, count: 0 },
    citizen_report: { totalScoreWeight: 0, totalWeight: 0, count: 0 },
  };

  const contributors: ScoreContributor[] = [];
  // 同じ日の気象値を特徴量ごとに重複加算せず、利用したベースラインの最大標本数を示す。
  let totalSampleCount = 0;

  for (const f of features) {
    totalSampleCount = Math.max(totalSampleCount, f.baseline.sampleCount);
    const z = calculateRobustZ(f.currentValue, f.baseline.median, f.baseline.mad, f.direction || 'both');
    if (z === null) continue;

    const itemScore = robustAnomalyScore(f.currentValue, f.baseline.median, f.baseline.mad, f.direction || 'both');
    const cat = categoryScores[f.category];
    if (cat) {
      cat.totalScoreWeight += itemScore * f.weight;
      cat.totalWeight += f.weight;
      cat.count++;
    }

    const ratioDiff = f.baseline.median > 0
      ? ((f.currentValue - f.baseline.median) / f.baseline.median) * 100
      : 0;
    const sign = ratioDiff >= 0 ? '+' : '';
    const changeRate = `${sign}${Math.round(ratioDiff)}%`;

    contributors.push({
      featureName: f.name,
      displayName: f.displayName,
      changeRate,
      zScore: Math.round(z * 100) / 100,
      contribution: itemScore,
      note: `平常中央値: ${f.baseline.median}${f.unit || ''} → 現在値: ${f.currentValue}${f.unit || ''}`
    });
  }

  const getCatScore = (catKey: string): number | null => {
    const c = categoryScores[catKey];
    if (!c || c.totalWeight === 0) return null;
    return Math.round((c.totalScoreWeight / c.totalWeight) * 10) / 10;
  };

  const eqScore = getCatScore('earthquake');
  const wxScore = getCatScore('weather');
  const socialScore = socialAnomalyScore != null ? socialAnomalyScore : getCatScore('social');
  const animalScore = getCatScore('animal_audio');
  const otherAudioScore = getCatScore('other_audio');
  const citizenScore = getCatScore('citizen_report');

  // v2.0 14.7 総合重み配分
  const categoryWeights = [
    { key: 'earthquake', score: eqScore, weight: 0.30 },
    { key: 'weather', score: wxScore, weight: 0.20 },
    { key: 'social', score: socialScore, weight: 0.20 },
    { key: 'citizen_report', score: citizenScore, weight: 0.15 },
    { key: 'animal_audio', score: animalScore, weight: 0.15 },
  ];

  const usable = categoryWeights.filter(c => c.score !== null);
  const weightSum = usable.reduce((s, c) => s + c.weight, 0);
  // 気象が未取得でも、現在値を持つSNS・市民観測まで「古い」と扱わない。
  const effectiveMinutesSinceUpdate = wxScore === null ? 0 : weatherInfo.minutesSinceUpdate;
  const quality = calculateQualityScore({
    sampleCount: totalSampleCount,
    targetSamples: 30,
    sourceAvailability: weightSum,
    minutesSinceUpdate: effectiveMinutesSinceUpdate,
    isHighWindOrRain: isBadWeather,
  });

  let overallScore: number | null = null;
  let status: 'available' | 'insufficient' | 'stale' = 'available';

  if (weightSum < 0.20 || quality < 0.20) {
    status = 'insufficient';
  } else {
    const weightedSum = usable.reduce((s, c) => s + Number(c.score) * c.weight, 0);
    overallScore = Math.round((weightedSum / weightSum) * 10) / 10;
    if (wxScore !== null && weatherInfo.minutesSinceUpdate > 90) {
      status = 'stale';
    }
  }

  // 科学的根拠の自然文フォーマット (14.8)
  let explanationText = '';
  if (status === 'insufficient') {
    explanationText = 'この地域は有効観測標本数またはデータ品質が基準値を満たしていないため、統計的異常度は「データ不足」として計算を控えています。';
  } else {
    const topDeviations = [...contributors].sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore)).slice(0, 2);
    const devSummaries = topDeviations.map(d => `${d.displayName}が対応する実測ベースライン中央値比 ${d.changeRate} (z=${d.zScore})`);
    
    explanationText = `この地域では、${devSummaries.length > 0 ? devSummaries.join('、') : '各指標が平常範囲で推移'}しており、平常時からの統計的な珍しさは ${overallScore} / 100 (品質: ${quality}) です。${
      confounders.length > 0 ? `※${confounders.join('。')}。` : ''
    } ※この値は平常時データとの統計的な差異（珍しさ）を示すものであり、地震発生確率や危険度ではありません。`;
  }

  return {
    scoreAt: new Date().toISOString(),
    scoreVersion: 'score-v3-live-baseline',
    status,
    overallScore,
    qualityScore: quality,
    sampleCount: totalSampleCount,
    earthquakeActivityScore: eqScore,
    weatherScore: wxScore,
    socialScore: socialScore,
    animalAudioScore: animalScore,
    otherAudioScore: otherAudioScore,
    citizenReportScore: citizenScore,
    contributors: contributors.sort((a, b) => b.contribution - a.contribution),
    confounders,
    explanationText,
  };
}

/**
 * GeoCell, 観測データ, 地震データ, SNS集計からスコアを再計算する統合ヘルパー
 */
export function calculateRobustAnomalyScore(
  cell: { id: string; name: string; center: { latitude: number; longitude: number }; weather: any; currentScore: CellScore },
  cellObservations: Observation[],
  recentEarthquakes: any[],
  socialAnomalyScore?: number | null
): CellScore {
  const weather = cell.weather;
  const features: FeatureInput[] = [];
  const baseline = weather.baseline;

  if (!weather.isStale && baseline?.sampleCount >= 7) {
    features.push({
      name: 'cloud_cover_high',
      displayName: '上層雲量 (卷雲・巻積雲)',
      category: 'weather',
      currentValue: weather.cloudCoverHigh,
      baseline: { ...baseline.cloudCoverHigh, sampleCount: baseline.sampleCount },
      weight: 1.0,
      direction: 'both',
      unit: '%',
    }, {
      name: 'sea_level_pressure_diff',
      displayName: '24時間気圧変動幅',
      category: 'weather',
      currentValue: weather.pressureChange24h,
      baseline: { ...baseline.pressureChange24h, sampleCount: Math.max(0, baseline.sampleCount - 1) },
      weight: 0.9,
      direction: 'both',
      unit: 'hPa',
    }, {
      name: 'temperature_same_hour',
      displayName: '同時間帯気温',
      category: 'weather',
      currentValue: weather.temperature,
      baseline: { ...baseline.temperature, sampleCount: baseline.sampleCount },
      weight: 0.6,
      direction: 'both',
      unit: '℃',
    });
  }

  const currentObservations = filterCurrentObservations(cellObservations);
  const reports = currentObservations.filter(o => o.type === 'citizen_report' && o.citizenReport);
  if (reports.length >= 3) {
    const meanDifference = reports.reduce((sum, observation) =>
      sum + Number(observation.citizenReport.differenceFromNormal || 1), 0) / reports.length;
    features.push({
      name: 'citizen_reports',
      displayName: '市民レポートの「普段との差」自己評価',
      category: 'citizen_report',
      currentValue: Math.round(meanDifference * 10) / 10,
      baseline: { median: 1, mad: 0.75, sampleCount: reports.length },
      weight: 1.0,
      direction: 'up',
      unit: '/5',
    });
  }

  const animalLabels = ['犬の鳴き声', '猫の鳴き声', '野鳥のさえずり', 'カラス', '虫・カエルの声'];
  const animalAudio = currentObservations.filter(observation => observation.type === 'audio'
    && observation.audioAnalysis
    && observation.audioAnalysis.qualityScore >= 0.4
    && observation.userConfirmation?.differenceFromNormal !== undefined
    && observation.userConfirmation.confirmedLabels.some(label => animalLabels.includes(label)));
  if (animalAudio.length >= 3) {
    const meanDifference = animalAudio.reduce((sum, observation) =>
      sum + Number(observation.userConfirmation?.differenceFromNormal || 1), 0) / animalAudio.length;
    features.push({
      name: 'confirmed_animal_audio',
      displayName: '利用者確認済み動物音の「普段との差」',
      category: 'animal_audio',
      currentValue: Math.round(meanDifference * 10) / 10,
      baseline: { median: 1, mad: 0.75, sampleCount: animalAudio.length },
      weight: 1.0,
      direction: 'up',
      unit: '/5',
    });
  }

  const cloudPhotos = currentObservations.filter(observation => observation.type === 'cloud_photo'
    && observation.cloudAnalysis
    && observation.cloudAnalysis.qualityScore >= 0.5
    && observation.userConfirmation?.differenceFromNormal !== undefined);
  if (cloudPhotos.length >= 3) {
    const meanDifference = cloudPhotos.reduce((sum, observation) =>
      sum + Number(observation.userConfirmation?.differenceFromNormal || 1), 0) / cloudPhotos.length;
    features.push({
      name: 'confirmed_cloud_photo',
      displayName: '雲写真の「普段との差」自己評価',
      category: 'citizen_report',
      currentValue: Math.round(meanDifference * 10) / 10,
      baseline: { median: 1, mad: 0.75, sampleCount: cloudPhotos.length },
      weight: 0.8,
      direction: 'up',
      unit: '/5',
    });
  }

  const dailyNearbyCounts = calculateDailyNearbyEarthquakeCounts(
    cell.center,
    recentEarthquakes,
    7,
    250
  );
  const validEarthquakeTimes = recentEarthquakes
    .map(earthquake => Date.parse(earthquake.occurredAt))
    .filter(Number.isFinite);
  const hasSevenDayEarthquakeCoverage = validEarthquakeTimes.length > 0
    && Math.min(...validEarthquakeTimes) <= Date.now() - 6 * 24 * 60 * 60_000;
  if (dailyNearbyCounts.length >= 4 && hasSevenDayEarthquakeCoverage) {
    const currentCount = dailyNearbyCounts[0];
    const history = dailyNearbyCounts.slice(1);
    const historyMedian = median(history);
    const historyMad = Math.max(0.5, median(history.map(value => Math.abs(value - historyMedian))));
    features.push({
      name: 'micro_seismicity',
      displayName: '周辺250kmの地震情報件数',
      category: 'earthquake',
      currentValue: currentCount,
      baseline: { median: historyMedian, mad: historyMad, sampleCount: history.length },
      weight: 1.0,
      direction: 'up',
      unit: '件/日',
    });
  }

  const fetchedAtMs = Date.parse(weather.fetchedAt || '');
  const minutesSinceUpdate = !weather.isStale && Number.isFinite(fetchedAtMs)
    ? Math.max(0, (Date.now() - fetchedAtMs) / 60_000)
    : 999;

  return computeCellScore(
    features,
    {
      windSpeed: weather.isStale ? 0 : weather.windSpeed || 0,
      precipitation: weather.isStale ? 0 : weather.precipitation || 0,
      minutesSinceUpdate,
    },
    reports.length + animalAudio.length + cloudPhotos.length,
    socialAnomalyScore
  );
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

export function calculateDistanceKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
): number {
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
}

export function calculateDailyNearbyEarthquakeCounts(
  center: { latitude: number; longitude: number },
  earthquakes: Array<{ occurredAt: string; latitude: number; longitude: number; magnitude: number | null }>,
  days = 7,
  radiusKm = 250
): number[] {
  const now = Date.now();
  const dayMs = 24 * 60 * 60_000;
  const counts = Array.from({ length: days }, () => 0);
  for (const earthquake of earthquakes) {
    const occurredAt = Date.parse(earthquake.occurredAt);
    if (!Number.isFinite(occurredAt) || earthquake.magnitude == null || earthquake.magnitude < 2) continue;
    const dayIndex = Math.floor((now - occurredAt) / dayMs);
    if (dayIndex < 0 || dayIndex >= days) continue;
    if (calculateDistanceKm(center, earthquake) <= radiusKm) counts[dayIndex] += 1;
  }
  return counts;
}
