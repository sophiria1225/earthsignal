import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateDailyNearbyEarthquakeCounts,
  calculateDistanceKm,
  calculateRobustAnomalyScore,
} from './anomalyEngine';
import { fetchP2PEarthquakesFromSource, formatTsunamiStatus, normalizeP2PTimestamp } from './externalFeeds';

const center = { latitude: 35.6812, longitude: 139.7671 };

test('地域間距離を概ね正しく計算する', () => {
  const tokyoToChiba = calculateDistanceKm(center, { latitude: 35.6074, longitude: 140.1065 });
  assert.ok(tokyoToChiba > 25 && tokyoToChiba < 40);
});

test('P2P地震情報のJST時刻を曖昧さのないISO UTCへ変換する', () => {
  assert.equal(normalizeP2PTimestamp('2026/08/27 23:49:00'), '2026-08-27T14:49:00.000Z');
  assert.equal(normalizeP2PTimestamp('2026/08/27 23:51:42.293'), '2026-08-27T14:51:42.293Z');
  assert.equal(normalizeP2PTimestamp('invalid'), null);
});

test('P2P津波区分を利用者向け日本語へ変換する', () => {
  assert.equal(formatTsunamiStatus('major_warning'), '大津波警報');
  assert.equal(formatTsunamiStatus('checking'), '津波の影響を調査中');
});

test('P2Pの同一地震に対する複数文書を新しい詳細報へ統合する', async () => {
  const originalFetch = globalThis.fetch;
  const base = {
    code: 551,
    earthquake: {
      time: '2026/08/27 04:26:00',
      hypocenter: { depth: 10, latitude: 32.5, longitude: 130.5, magnitude: 3.8, name: '熊本県天草・芦北地方' },
      domesticTsunami: 'None',
    },
  };
  globalThis.fetch = async () => new Response(JSON.stringify([
    { ...base, id: 'destination', time: '2026/08/27 04:28:34.838', issue: { type: 'Destination' }, earthquake: { ...base.earthquake, maxScale: -1 } },
    { ...base, id: 'detail', time: '2026/08/27 04:30:17.908', issue: { type: 'DetailScale' }, earthquake: { ...base.earthquake, maxScale: 30 } },
  ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  try {
    const result = await fetchP2PEarthquakesFromSource(10);
    assert.equal(result.earthquakes.length, 1);
    assert.equal(result.earthquakes[0].id, 'detail');
    assert.equal(result.earthquakes[0].maxIntensity, '3');
    assert.equal(result.earthquakes[0].updatedAt, '2026-08-26T19:30:17.908Z');
  } finally {
    globalThis.fetch = originalFetch;
  }
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

test('利用者確認済みの低い環境音は3件以上で専用カテゴリへ入る', () => {
  const audioReports = Array.from({ length: 3 }, (_, index) => ({
    id: `sound-${index}`,
    type: 'audio',
    status: 'finalized',
    observedAt: new Date(Date.now() - index * 60_000).toISOString(),
    audioAnalysis: { qualityScore: 0.8 },
    userConfirmation: { confirmedLabels: ['地鳴りのような低い音'], differenceFromNormal: 4 },
  })) as any[];
  const score = calculateRobustAnomalyScore({
    id: 'cell_tokyo_01', name: '東京', center,
    weather: { fetchedAt: '', isStale: true, windSpeed: 0, precipitation: 0 },
    currentScore: {} as any,
  }, audioReports, [], null);
  assert.ok(score.otherAudioScore !== null && score.otherAudioScore > 50);
});

test('SNSベースラインの別日数を総合品質の標本数へ引き継ぐ', () => {
  const score = calculateRobustAnomalyScore({
    id: 'cell_tokyo_01', name: '東京', center,
    weather: { fetchedAt: '', isStale: true, windSpeed: 0, precipitation: 0 },
    currentScore: {} as any,
  }, [], [], 65, 9);
  assert.equal(score.socialScore, 65);
  assert.equal(score.sampleCount, 9);
});
