import { GeoCell, SocialHourlySummary } from '../types';
import { robustAnomalyScore } from './anomalyEngine';

export const OBSERVATION_HISTORY_STORAGE_KEY = 'earthsignal_observation_history_v1';
const RETENTION_DAYS = 45;
const MAX_POINTS = 10_000;

export interface ObservationSnapshot {
  version: 1;
  cellId: string;
  capturedAt: string;
  hourBucket: string;
  overallScore: number | null;
  weatherScore: number | null;
  earthquakeScore: number | null;
  socialScore: number | null;
  socialPostCount: number | null;
  cloudCoverHigh: number | null;
  pressureChange24h: number | null;
  temperature: number | null;
}

export interface SocialBaselineResult {
  anomalyScore: number | null;
  sampleCount: number;
  median: number | null;
  mad: number | null;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function isSnapshot(value: unknown): value is ObservationSnapshot {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ObservationSnapshot>;
  return item.version === 1
    && typeof item.cellId === 'string'
    && typeof item.capturedAt === 'string'
    && typeof item.hourBucket === 'string'
    && Number.isFinite(Date.parse(item.capturedAt));
}

export function parseObservationHistory(raw: string | null): ObservationSnapshot[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSnapshot).slice(-MAX_POINTS);
  } catch {
    return [];
  }
}

export function loadObservationHistory(): ObservationSnapshot[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    return parseObservationHistory(localStorage.getItem(OBSERVATION_HISTORY_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function saveObservationHistory(history: ObservationSnapshot[]): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    localStorage.setItem(OBSERVATION_HISTORY_STORAGE_KEY, JSON.stringify(history.slice(-MAX_POINTS)));
    return true;
  } catch {
    return false;
  }
}

export function createObservationSnapshots(
  cells: GeoCell[],
  capturedAt = new Date(),
  options: { socialLive?: boolean } = {}
): ObservationSnapshot[] {
  const hour = new Date(capturedAt);
  hour.setMinutes(0, 0, 0);
  const hourBucket = hour.toISOString();
  return cells.map(cell => ({
    version: 1,
    cellId: cell.id,
    capturedAt: capturedAt.toISOString(),
    hourBucket,
    overallScore: cell.currentScore.overallScore,
    weatherScore: cell.currentScore.weatherScore,
    earthquakeScore: cell.currentScore.earthquakeActivityScore,
    socialScore: cell.currentScore.socialScore,
    socialPostCount: options.socialLive ? (cell.socialSummary?.totalPosts || 0) : null,
    cloudCoverHigh: !cell.weather.isStale && Number.isFinite(cell.weather.cloudCoverHigh) ? cell.weather.cloudCoverHigh : null,
    pressureChange24h: !cell.weather.isStale && Number.isFinite(cell.weather.pressureChange24h) ? cell.weather.pressureChange24h! : null,
    temperature: !cell.weather.isStale && Number.isFinite(cell.weather.temperature) ? cell.weather.temperature : null,
  }));
}

export function mergeObservationSnapshots(
  history: ObservationSnapshot[],
  incoming: ObservationSnapshot[],
  now = new Date()
): ObservationSnapshot[] {
  const cutoff = now.getTime() - RETENTION_DAYS * 24 * 60 * 60_000;
  const merged = new Map<string, ObservationSnapshot>();
  for (const snapshot of [...history, ...incoming]) {
    const timestamp = Date.parse(snapshot.capturedAt);
    if (!Number.isFinite(timestamp) || timestamp < cutoff) continue;
    merged.set(`${snapshot.cellId}:${snapshot.hourBucket}`, snapshot);
  }
  return [...merged.values()]
    .sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt))
    .slice(-MAX_POINTS);
}

function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/**
 * 現在と同じ3時間帯の別日スナップショットを最大30日分使う。
 * アプリを開いた頻度の偏りを避けるため、1日につき最新1標本だけを採用する。
 */
export function deriveSocialBaseline(
  cellId: string,
  currentPostCount: number,
  history: ObservationSnapshot[],
  now = new Date()
): SocialBaselineResult {
  const currentBand = Math.floor(now.getHours() / 3);
  const today = localDayKey(now);
  const byDay = new Map<string, ObservationSnapshot>();

  for (const snapshot of history) {
    if (snapshot.cellId !== cellId) continue;
    const capturedAt = new Date(snapshot.capturedAt);
    if (!Number.isFinite(capturedAt.getTime())) continue;
    if (localDayKey(capturedAt) === today || Math.floor(capturedAt.getHours() / 3) !== currentBand) continue;
    if (now.getTime() - capturedAt.getTime() > 30 * 24 * 60 * 60_000) continue;
    const day = localDayKey(capturedAt);
    const previous = byDay.get(day);
    if (!previous || Date.parse(previous.capturedAt) < capturedAt.getTime()) byDay.set(day, snapshot);
  }

  const values = [...byDay.values()]
    .sort((a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt))
    .slice(0, 30)
    .map(snapshot => snapshot.socialPostCount)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (values.length < 7) {
    return { anomalyScore: null, sampleCount: values.length, median: null, mad: null };
  }

  const center = median(values);
  const mad = Math.max(1, median(values.map(value => Math.abs(value - center))));
  return {
    anomalyScore: robustAnomalyScore(currentPostCount, center, mad, 'up'),
    sampleCount: values.length,
    median: Math.round(center * 10) / 10,
    mad: Math.round(mad * 10) / 10,
  };
}

export function applySocialBaseline(
  summary: SocialHourlySummary,
  baseline: SocialBaselineResult
): SocialHourlySummary {
  if (baseline.anomalyScore === null) {
    return {
      ...summary,
      anomalyScore: null,
      notice: `SNS異常度を計算するには同時間帯の別日履歴が7日分必要です（現在 ${baseline.sampleCount}/7日）。`,
    };
  }
  return {
    ...summary,
    anomalyScore: baseline.anomalyScore,
    notice: `同じ3時間帯の別日${baseline.sampleCount}日分と比較（中央値 ${baseline.median}件、MAD ${baseline.mad}件）。投稿増加は地震発生確率ではありません。`,
  };
}
