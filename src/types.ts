/**
 * EarthSignal - Type Definitions
 * Based on Requirements Document v2.0 (Complete Free Architecture)
 */

export type DataCategory = 'OFFICIAL' | 'OBSERVED' | 'DERIVED' | 'HYPOTHESIS';

// 1. 地震データ (P2P地震情報 / JMA / USGS)
export interface Earthquake {
  id: string;
  occurredAt: string; // ISO UTC
  hypocenterName: string;
  latitude: number;
  longitude: number;
  depthKm: number | null;
  magnitude: number | null;
  magnitudeType?: string;
  maxIntensity: string | null; // "1", "2", "3", "4", "5弱", "5強", "6弱", "6強", "7"
  tsunamiStatus: 'none' | 'checking' | 'non_effective' | 'watch' | 'warning' | 'major_warning';
  source: 'p2pquake' | 'jma' | 'usgs';
  sourceEventId?: string;
  revision: number;
  updatedAt: string;
}

// 2. 気象データ (Open-Meteo)
export interface WeatherObservation {
  cellId: string;
  observedAt: string;
  cloudCoverTotal: number; // 0 - 100%
  cloudCoverLow: number;   // 0 - 100%
  cloudCoverMid: number;   // 0 - 100%
  cloudCoverHigh: number;  // 0 - 100%
  pressureMsl: number;     // hPa (海面気圧)
  surfacePressure: number; // hPa (地上気圧)
  pressureChange24h?: number; // 24h気圧変化
  relativeHumidity: number;// 0 - 100%
  precipitation: number;   // mm
  windSpeed: number;       // m/s
  windDirection: number;   // degrees
  temperature: number;     // ℃
  weatherCode: number;     // WMO code
  fetchedAt: string;
  isStale?: boolean;
}

// 3. SNS集合知レイヤー (v2.0: Bluesky, Mastodon, YouTube, Misskey)
export type SocialCategory =
  | 'cloud'
  | 'animal'
  | 'sound'
  | 'shaking'
  | 'water'
  | 'device'
  | 'official_reaction'
  | 'unrelated'
  | 'unknown';

export type SocialSourceType = 'bluesky' | 'mastodon' | 'youtube' | 'misskey';
export type AnalysisMode = 'rules' | 'embedding' | 'llm' | 'rules_only_quota';

export interface SocialDerivedPost {
  id: string;
  source: SocialSourceType;
  sourceIdHash: string;
  sourceUrl: string;
  postedAt: string;
  fetchedAt: string;
  category: SocialCategory;
  subject?: string;
  behavior?: string;
  h3Cell: string;
  placeName?: string;
  placeConfidence: number; // 0 - 1
  informationQuality: number; // 0 - 1
  isPostEventReaction: boolean; // 地震発生後の反応か (発生前窓から除外)
  isDuplicate: boolean;
  duplicateGroup?: string;
  analysisMode: AnalysisMode;
  temporaryExcerpt?: string; // 24h以内消去用
}

export interface SocialHourlySummary {
  cellId: string;
  window: '1h' | '6h' | '24h';
  totalPosts: number;
  uniqueActorEstimate: number;
  locationExplicitRatio: number; // 地域明示率
  qualityScore: number; // 平均情報品質 0-1
  anomalyScore: number; // 0 - 100
  categories: Record<SocialCategory, number>;
  sources: Record<SocialSourceType, number>;
  analysisModes: Record<AnalysisMode, number>;
  globalTopicSpike: boolean; // 全国的な話題急増フラグ
  notice: string;
}

// 4. 音響AI分析 (YAMNet系)
export interface AudioLabel {
  label: string;
  displayName: string;
  meanScore: number; // 0.0 - 1.0
  maxScore: number;  // 0.0 - 1.0
  frameRatio: number;// 0.0 - 1.0
}

export interface AudioAnalysis {
  id: string;
  observationId: string;
  modelVersion: string; // "yamnet-v1"
  durationMs: number;
  rmsDb: number;
  clippingRatio: number;
  silenceRatio: number;
  speechRatio: number; // 会話候補比率 (高い場合は公衆公開無効)
  qualityScore: number; // 0.0 - 1.0
  topLabels: AudioLabel[];
  rawAudioDeleted: boolean; // 生音声は即時破棄
  retentionHoursRemaining?: number;
  completedAt: string;
}

// 5. 雲写真分析 (EXIF位置情報除去・気象雲形)
export interface CloudAnalysis {
  id: string;
  observationId: string;
  modelVersion: string; // "cloud-vit-v1"
  skyCoverageRatio: number; // 0.0 - 1.0
  detectedCloudTypes: {
    type: 'cirrus' | 'altocumulus' | 'stratocumulus' | 'lenticular' | 'contrail' | 'cumulonimbus' | 'unknown';
    displayName: string;
    description: string;
    confidence: number;
  }[];
  qualityScore: number; // 0.0 - 1.0
  exifStripped: boolean; // EXIF GPS完全除去
  captureDirection?: string;
  captureElevationAngle?: number;
}

// 6. 観測投稿 (User Observation)
export type ObservationType = 'audio' | 'cloud_photo' | 'citizen_report';
export type ObservationVisibility = 'private' | 'aggregate_only' | 'anonymous_public';

export interface UserConfirmation {
  confirmedLabels: string[];
  aiResultCorrect: 'yes' | 'partially' | 'no' | 'unknown';
  userNotes?: string;
}

export interface CitizenReportData {
  category: 'animal_active' | 'animal_quiet' | 'bird_flock' | 'cloud_shape' | 'low_rumble_sound' | 'micro_tremor' | 'electronic_anomaly' | 'other';
  intensity: number; // 1 - 5
  differenceFromNormal: number; // 1 - 5
  durationMinutes?: number;
  description?: string;
}

export interface Observation {
  id: string;
  userId?: string;
  type: ObservationType;
  observedAt: string;
  cellId: string;
  cellName: string;
  locationApprox: {
    latitude: number;
    longitude: number;
  };
  visibility: ObservationVisibility;
  status: 'processing' | 'ready' | 'finalized' | 'deleted';
  audioAnalysis?: AudioAnalysis;
  cloudAnalysis?: CloudAnalysis;
  citizenReport?: CitizenReportData;
  userConfirmation?: UserConfirmation;
  createdAt: string;
}

// 7. 地理セル (H3風メッシュ)
export interface GeoCell {
  id: string;
  h3Index?: string;
  name: string;
  region: string;
  prefecture: string;
  center: {
    latitude: number;
    longitude: number;
  };
  svgCoordinates: { x: number; y: number };
  currentScore: CellScore;
  weather: WeatherObservation;
  socialSummary?: SocialHourlySummary;
  recentObservationsCount: number;
}

// 8. 観測異常度スコア (CellScore - MADロバスト統計)
export interface ScoreContributor {
  featureName: string;
  displayName: string;
  changeRate: string; // e.g. "+85%"
  zScore: number;
  contribution: number; // 0 - 100
  note?: string;
}

export interface CellScore {
  scoreAt: string;
  scoreVersion: string; // "score-v2-robust"
  status: 'available' | 'insufficient' | 'stale';
  overallScore: number | null; // 0 - 100 (null if insufficient)
  qualityScore: number; // 0.0 - 1.0
  sampleCount: number;
  earthquakeActivityScore: number | null;
  weatherScore: number | null;
  socialScore: number | null; // SNS集合知スコア (v2.0)
  animalAudioScore: number | null;
  otherAudioScore: number | null;
  citizenReportScore: number | null;
  contributors: ScoreContributor[];
  confounders: string[]; // 交絡要因
  explanationText: string; // 科学的注記付き根拠
}

// 9. 事後検証 (Post-Event Evaluation)
export interface PostEventEvaluation {
  id: string;
  earthquake: Earthquake;
  analysisWindow: '24h' | '72h';
  evaluatedAt: string;
  cellId: string;
  cellName: string;
  distanceFromEpicenterKm: number;
  metrics: {
    featureName: string;
    displayName: string;
    preEventValue: number;
    controlMedian: number;
    changePercentage: number;
    confidenceInterval95: [number, number]; // [min, max]
    isStatisticallySignificant: boolean;
  }[];
  verdict: 'no_clear_deviation' | 'mild_anomaly_weather_confounded' | 'significant_deviation_unverified_causality' | 'insufficient_data';
  verdictSummary: string;
  scientificNotes: string;
}

// 10. 無料枠ガード & キルスイッチ (v2.0 Free Tier Guard & Kill Switches)
export interface ResourceUsage {
  resourceKey: string;
  name: string;
  used: number;
  softLimit: number;
  hardLimit: number;
  unit: string;
  state: 'normal' | 'soft_limit_exceeded' | 'stopped_for_today';
  fallbackDescription: string;
}

export interface DataSourceHealth {
  sourceName: string;
  displayName: string;
  enabled: boolean;
  priority: number;
  dailyCallsUsed: number;
  dailyCallsLimit: number;
  lastSuccessAt: string;
  lastErrorAt?: string;
  lastErrorCode?: string;
  latencyMs: number;
  status: 'ok' | 'degraded' | 'paused_budget' | 'disabled';
}

export interface KillSwitchSettings {
  bluesky: boolean;
  mastodon: boolean;
  misskey: boolean;
  youtube: boolean;
  workersAi: boolean;
  userReports: boolean;
  p2pQuake: boolean;
  openMeteo: boolean;
}

export interface FreeTierStatus {
  dateUtc: string;
  systemOverallState: 'normal' | 'degraded' | 'minimal_collection' | 'read_only';
  resources: ResourceUsage[];
  sources: DataSourceHealth[];
  killSwitches: KillSwitchSettings;
}

// 11. 研究エクスポート設定
export interface ExportRequest {
  datasetVersion: string;
  cellIds: string[];
  dateFrom: string;
  dateTo: string;
  format: 'json' | 'csv' | 'parquet';
  includeAudioFeatures: boolean;
  includeWeather: boolean;
  includeEarthquakes: boolean;
  includeSocialDerived: boolean;
  anonymizeCoordinates: boolean; // 必ずセル中心へ丸める
}

