/**
 * EarthSignal - Robust Anomaly Score Engine (v2.0)
 * Implements Section 14 of Requirements Document v2.0 (Complete Free Edition)
 * Uses Median, MAD, Robust Z-score, Logistic 0-100 scaling, and Quality Coefficients
 */

import { CellScore, ScoreContributor } from '../types';

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
 * 14.6 品質係数 (0.0〜1.0)
 * value = 0.20*freshness + 0.25*sampleAdequacy + 0.20*sourceAvailability + 0.20*geoConfidence + 0.15*classifierConfidence
 */
export function calculateQualityScore(params: {
  sampleCount: number;
  targetSamples?: number;
  sourceAvailability?: number;
  minutesSinceUpdate?: number;
  isHighWindOrRain?: boolean;
  uniqueContributors?: number;
  geoConfidence?: number;
  classifierConfidence?: number;
}): number {
  const {
    sampleCount,
    targetSamples = 30,
    sourceAvailability = 0.95,
    minutesSinceUpdate = 5,
    isHighWindOrRain = false,
    uniqueContributors = 3,
    geoConfidence = 0.85,
    classifierConfidence = 0.88,
  } = params;

  // 鮮度 (0..1)
  const freshness = Math.max(0.2, 1.0 - (minutesSinceUpdate / 180));
  // 標本充足度 q_sample = min(1, sqrt(n / n_target))
  const sampleAdequacy = Math.min(1.0, Math.sqrt(Math.max(0, sampleCount) / targetSamples));
  const weatherPenalty = isHighWindOrRain ? 0.75 : 1.0;

  const value =
    0.20 * freshness * weatherPenalty +
    0.25 * sampleAdequacy +
    0.20 * sourceAvailability +
    0.20 * geoConfidence +
    0.15 * classifierConfidence;

  // 投稿者多様性による補正
  const diversityMult = Math.min(1.0, 0.4 + (uniqueContributors * 0.15));

  return Math.max(0.05, Math.min(1.0, Math.round(value * diversityMult * 100) / 100));
}

/**
 * 14.7 総合観測異常度の計算 (v2.0)
 * 重み: 公式地震 0.30, 気象 0.20, SNS 0.20, ユーザー観測 0.15, 動物音響 0.15
 */
export function computeCellScore(
  features: FeatureInput[],
  weatherInfo: { windSpeed: number; precipitation: number; minutesSinceUpdate: number },
  uniqueUserCount: number,
  socialAnomalyScore?: number
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
    confounders.push(`観測標本数(${uniqueUserCount}件)が少数のため多様性係数を抑制`);
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
  let totalSampleCount = 0;

  for (const f of features) {
    totalSampleCount += f.baseline.sampleCount;
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
  const socialScore = socialAnomalyScore !== undefined ? socialAnomalyScore : getCatScore('social');
  const animalScore = getCatScore('animal_audio');
  const otherAudioScore = getCatScore('other_audio');
  const citizenScore = getCatScore('citizen_report');

  const quality = calculateQualityScore({
    sampleCount: totalSampleCount,
    targetSamples: 30,
    minutesSinceUpdate: weatherInfo.minutesSinceUpdate,
    isHighWindOrRain: isBadWeather,
    uniqueContributors: uniqueUserCount,
  });

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

  let overallScore: number | null = null;
  let status: 'available' | 'insufficient' | 'stale' = 'available';

  if (weightSum < 0.50 || quality < 0.20) {
    status = 'insufficient';
  } else {
    const weightedSum = usable.reduce((s, c) => s + Number(c.score) * c.weight * quality, 0);
    overallScore = Math.round((weightedSum / (weightSum * quality)) * 10) / 10;
    if (weatherInfo.minutesSinceUpdate > 90) {
      status = 'stale';
    }
  }

  // 科学的根拠の自然文フォーマット (14.8)
  let explanationText = '';
  if (status === 'insufficient') {
    explanationText = 'この地域は有効観測標本数またはデータ品質が基準値を満たしていないため、統計的異常度は「データ不足」として計算を控えています。';
  } else {
    const topDeviations = [...contributors].sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore)).slice(0, 2);
    const devSummaries = topDeviations.map(d => `${d.displayName}が過去30日同時間帯中央値比 ${d.changeRate} (z=${d.zScore})`);
    
    explanationText = `この地域では、${devSummaries.length > 0 ? devSummaries.join('、') : '各指標が平常範囲で推移'}しており、平常時からの統計的な珍しさは ${overallScore} / 100 (品質: ${quality}) です。${
      confounders.length > 0 ? `※${confounders.join('。')}。` : ''
    } ※この値は平常時データとの統計的な差異（珍しさ）を示すものであり、地震発生確率や危険度ではありません。`;
  }

  return {
    scoreAt: new Date().toISOString(),
    scoreVersion: 'score-v2-robust',
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
  cell: { id: string; name: string; weather: any; currentScore: CellScore },
  cellObservations: any[],
  recentEarthquakes: any[],
  socialAnomalyScore?: number
): CellScore {
  const weather = cell.weather;
  const features: FeatureInput[] = [
    {
      name: 'cloud_cover_high',
      displayName: '上層雲量 (卷雲・巻積雲)',
      category: 'weather',
      currentValue: weather.cloudCoverHigh || 20,
      baseline: { median: 18, mad: 8, sampleCount: 28 },
      weight: 1.0,
      direction: 'both',
      unit: '%',
    },
    {
      name: 'sea_level_pressure_diff',
      displayName: '24時間気圧変動幅',
      category: 'weather',
      currentValue: Math.abs(weather.pressureChange24h || 2.1),
      baseline: { median: 2.0, mad: 1.2, sampleCount: 30 },
      weight: 0.9,
      direction: 'up',
      unit: 'hPa',
    },
    {
      name: 'animal_audio_anomaly',
      displayName: '動物音響・遠吠え頻度',
      category: 'animal_audio',
      currentValue: cellObservations.filter(o => o.type === 'audio').length * 2 + 15,
      baseline: { median: 12, mad: 4, sampleCount: 24 },
      weight: 1.2,
      direction: 'up',
      unit: '件/h',
    },
    {
      name: 'citizen_reports',
      displayName: '市民構造化レポート',
      category: 'citizen_report',
      currentValue: cellObservations.filter(o => o.type === 'citizen_report').length * 3 + 8,
      baseline: { median: 7, mad: 3, sampleCount: 20 },
      weight: 1.0,
      direction: 'up',
      unit: '件/h',
    },
    {
      name: 'micro_seismicity',
      displayName: '地域微小地震活動頻度',
      category: 'earthquake',
      currentValue: recentEarthquakes.filter(eq => eq.magnitude && eq.magnitude > 2.0).length > 0 ? 3 : 1,
      baseline: { median: 1, mad: 0.8, sampleCount: 30 },
      weight: 1.0,
      direction: 'up',
      unit: '回/週',
    },
  ];

  return computeCellScore(
    features,
    {
      windSpeed: weather.windSpeed || 2.5,
      precipitation: weather.precipitation || 0.0,
      minutesSinceUpdate: 5,
    },
    Math.max(3, cellObservations.length + 2),
    socialAnomalyScore
  );
}


