/**
 * EarthSignal - Type Definitions
 * Based on the EarthSignal observation and anomaly-analysis domain model.
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
  baseline?: {
    periodDays: number;
    sampleCount: number;
    cloudCoverHigh: { median: number; mad: number };
    pressureChange24h: { median: number; mad: number };
    temperature: { median: number; mad: number };
  };
}

// 3. SNS集合知レイヤー（現在の自動収集元: Bluesky / Mastodon）
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
  actorIdHash?: string; // 投稿者識別子の不可逆ハッシュ（投稿者数の推定専用）
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

export interface SocialFetchSourceStatus {
  source: SocialSourceType;
  ok: boolean;
  degraded?: boolean;
  fetched: number;
  error?: string;
}

export interface SocialFetchResponse {
  posts: SocialDerivedPost[];
  fetchedAt: string;
  isLive: boolean;
  sources: SocialFetchSourceStatus[];
  error?: string;
}

export interface BlueskyPublicProfilePost {
  uri: string;
  url: string;
  postedAt: string;
  excerpt: string;
  category: SocialCategory;
}

export interface BlueskyPublicProfileResponse {
  profile: {
    did: string;
    handle: string;
    displayName: string;
    description: string;
    avatar?: string;
    followersCount: number;
    followsCount: number;
    postsCount: number;
  };
  scannedCount: number;
  relevantPosts: BlueskyPublicProfilePost[];
  fetchedAt: string;
  notice: string;
}

export type RuntimeSourceKey = 'earthquake' | 'weather' | 'social';
export interface RuntimeDataSourceStatus {
  key: RuntimeSourceKey;
  label: string;
  state: 'loading' | 'live' | 'degraded';
  isCurrent: boolean;
  fetchedAt?: string;
  recordCount: number;
  detail: string;
  error?: string;
}

export interface SocialHourlySummary {
  cellId: string;
  window: '1h' | '6h' | '24h';
  totalPosts: number;
  uniqueActorEstimate: number;
  locationExplicitRatio: number; // 地域明示率
  qualityScore: number; // 平均情報品質 0-1
  anomalyScore: number | null; // 履歴ベースラインがある場合のみ 0 - 100
  baselineSampleCount: number; // 同時間帯比較に実際に採用した別日数
  animalAnomalyScore: number | null; // 動物カテゴリ投稿数の平常時からの差（地震発生確率ではない）
  animalBaselineSampleCount: number;
  animalBaselineMedian: number | null;
  animalBaselineMad: number | null;
  categories: Record<SocialCategory, number>;
  sources: Record<SocialSourceType, number>;
  analysisModes: Record<AnalysisMode, number>;
  globalTopicSpike: boolean; // 長期・全国履歴が整った後に使う話題急増フラグ（現在はfalse）
  notice: string;
}

// 4. 音声信号の品質解析（音源分類モデルは未導入）
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
  modelVersion: string;
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

// 5. 雲写真の端末内解析（保存結果に元画像・EXIFを含めない）
export interface CloudAnalysis {
  id: string;
  observationId: string;
  modelVersion: string;
  skyCoverageRatio: number; // 0.0 - 1.0
  detectedCloudTypes: {
    type: 'cirrus' | 'altocumulus' | 'stratocumulus' | 'lenticular' | 'contrail' | 'cumulonimbus' | 'unknown';
    displayName: string;
    description: string;
    confidence: number;
  }[];
  qualityScore: number; // 0.0 - 1.0
  exifStripped: boolean; // 保存結果にEXIF GPSを含まない
  captureDirection?: string;
  captureElevationAngle?: number;
}

// 6. 観測投稿 (User Observation)
export type ObservationType = 'audio' | 'cloud_photo' | 'citizen_report';
export type ObservationVisibility = 'private' | 'aggregate_only' | 'anonymous_public';

export interface UserConfirmation {
  confirmedLabels: string[];
  aiResultCorrect: 'yes' | 'partially' | 'no' | 'unknown';
  differenceFromNormal?: number; // 利用者自身の平常時と比べた1〜5段階評価
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
  scoreVersion: string; // 例: "score-v4-local-24h"
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

// 10. 研究エクスポート設定
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
