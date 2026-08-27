import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateDailyNearbyEarthquakeCounts,
  calculateDistanceKm,
  calculateRobustAnomalyScore,
} from './anomalyEngine';
import { normalizeP2PTimestamp } from './externalFeeds';

const center = { latitude: 35.6812, longitude: 139.7671 };

test('地域間距離を概ね正しく計算する', () => {
  const tokyoToChiba = calculateDistanceKm(center, { latitude: 35.6074, longitude: 140.1065 });
  assert.ok(tokyoToChiba > 25 && tokyoToChiba < 40);
});

test('P2P地震情報のJST時刻を曖昧さのないISO UTCへ変換する', () => {
  assert.equal(normalizeP2PTimestamp('2026/08/27 23:49:00'), '2026-08-27T14:49:00.000Z');
  assert.equal(normalizeP2PTimestamp('invalid'), null);
});

test('周辺地震だけを24時間単位で集計する', () => {
  const now = Date.now();
  const counts = calculateDailyNearbyEarthquakeCounts(center, [
    { occurredAt: new Date(now - 2 * 60 * 60_000).toISOString(), latitude: 35.7, longitude: 139.8, magnitude: 3 },
    { occurredAt: new Date(now - 26 * 60 * 60_000).toISOString(), latitude: 35.7, longitude: 139.8, magnitude: 3 },
    { occurredAt: new Date(now - 2 * 60 * 60_000).toISOString(), latitude: 43.0, longitude: 141.0, magnitude: 4 },
  ], 3, 250);
  assert.deepEqual(counts, [1, 1, 0]);
});

test('実測ベースラインがなければ異常度を算出しない', () => {
  const score = calculateRobustAnomalyScore({
    id: 'cell_tokyo_01',
    name: '東京',
    center,
    weather: { fetchedAt: '', windSpeed: 0, precipitation: 0 },
    currentScore: {} as any,
  }, [], [], null);
  assert.equal(score.status, 'insufficient');
  assert.equal(score.overallScore, null);
});

test('30日同時間帯の気象ベースラインから実スコアを算出する', () => {
  const score = calculateRobustAnomalyScore({
    id: 'cell_tokyo_01',
    name: '東京',
    center,
    weather: {
      fetchedAt: new Date().toISOString(),
      windSpeed: 2,
      precipitation: 0,
      cloudCoverHigh: 80,
      pressureChange24h: -8,
      temperature: 35,
      baseline: {
        sampleCount: 30,
        cloudCoverHigh: { median: 30, mad: 10 },
        pressureChange24h: { median: 0, mad: 2 },
        temperature: { median: 27, mad: 2 },
      },
    },
    currentScore: {} as any,
  }, [], [], null);
  assert.equal(score.status, 'available');
  assert.equal(score.sampleCount, 30);
  assert.ok(score.weatherScore !== null && score.weatherScore > 50);
  assert.ok(score.contributors.every(item => item.note?.includes('平常中央値')));
});

test('取得失敗でstaleになった気象値を現在の異常度へ再利用しない', () => {
  const score = calculateRobustAnomalyScore({
    id: 'cell_tokyo_01',
    name: '東京',
    center,
    weather: {
      fetchedAt: new Date().toISOString(),
      isStale: true,
      windSpeed: 2,
      precipitation: 0,
      cloudCoverHigh: 100,
      pressureChange24h: -20,
      temperature: 40,
      baseline: {
        sampleCount: 30,
        cloudCoverHigh: { median: 30, mad: 10 },
        pressureChange24h: { median: 0, mad: 2 },
        temperature: { median: 27, mad: 2 },
      },
    },
    currentScore: {} as any,
  }, [], [], null);
  assert.equal(score.weatherScore, null);
  assert.equal(score.overallScore, null);
});

test('24時間を過ぎた市民観測を現在の異常度へ残さない', () => {
  const oldReports = Array.from({ length: 3 }, (_, index) => ({
    id: `old-${index}`,
    type: 'citizen_report',
    status: 'finalized',
    observedAt: new Date(Date.now() - 25 * 60 * 60_000).toISOString(),
    citizenReport: { differenceFromNormal: 5 },
  })) as any[];
  const score = calculateRobustAnomalyScore({
    id: 'cell_tokyo_01', name: '東京', center,
    weather: { fetchedAt: '', isStale: true, windSpeed: 0, precipitation: 0 },
    currentScore: {} as any,
  }, oldReports, [], null);
  assert.equal(score.citizenReportScore, null);
});

test('利用者確認済みの動物音は3件以上かつ直近24時間の場合だけ集計する', () => {
  const audioReports = Array.from({ length: 3 }, (_, index) => ({
    id: `audio-${index}`,
    type: 'audio',
    status: 'finalized',
    observedAt: new Date(Date.now() - index * 60_000).toISOString(),
    audioAnalysis: { qualityScore: 0.8 },
    userConfirmation: { confirmedLabels: ['犬の鳴き声'], differenceFromNormal: 4 },
  })) as any[];
  const score = calculateRobustAnomalyScore({
    id: 'cell_tokyo_01', name: '東京', center,
    weather: { fetchedAt: '', isStale: true, windSpeed: 0, precipitation: 0 },
    currentScore: {} as any,
  }, audioReports, [], null);
  assert.ok(score.animalAudioScore !== null && score.animalAudioScore > 50);
  assert.equal(score.overallScore, null, '単一の低ウェイト観測だけでは総合値を出さない');
});
