import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deriveSocialBaseline,
  mergeObservationSnapshots,
  ObservationSnapshot,
  parseObservationHistory,
} from './observationHistory';

function snapshot(dayOffset: number, socialPostCount: number): ObservationSnapshot {
  const capturedAt = new Date(2026, 7, 28 - dayOffset, 3, 10);
  const hourBucket = new Date(2026, 7, 28 - dayOffset, 3, 0).toISOString();
  return {
    version: 1,
    cellId: 'cell_tokyo_01',
    capturedAt: capturedAt.toISOString(),
    hourBucket,
    overallScore: 20,
    weatherScore: 20,
    earthquakeScore: null,
    socialScore: null,
    socialPostCount,
    cloudCoverHigh: 20,
    pressureChange24h: 0,
    temperature: 25,
  };
}

test('壊れた履歴JSONや別形式を安全に無視する', () => {
  assert.deepEqual(parseObservationHistory('{broken'), []);
  assert.deepEqual(parseObservationHistory(JSON.stringify([{ version: 0 }])), []);
  assert.deepEqual(parseObservationHistory(JSON.stringify([{ ...snapshot(1, 2), overallScore: 'high' }])), []);
});

test('同じ地域・時間バケットは最新値へ置き換える', () => {
  const oldPoint = snapshot(1, 2);
  const newPoint = { ...oldPoint, capturedAt: new Date(2026, 7, 27, 3, 50).toISOString(), socialPostCount: 5 };
  const merged = mergeObservationSnapshots([oldPoint], [newPoint], new Date(2026, 7, 28, 4));
  assert.equal(merged.length, 1);
  assert.equal(merged[0].socialPostCount, 5);
});

test('SNS履歴が7日未満なら異常度を出さない', () => {
  const result = deriveSocialBaseline(
    'cell_tokyo_01',
    10,
    Array.from({ length: 6 }, (_, index) => snapshot(index + 1, 2)),
    new Date(2026, 7, 28, 3, 30)
  );
  assert.equal(result.anomalyScore, null);
  assert.equal(result.sampleCount, 6);
});

test('SNS履歴が7日あれば実測値から異常度を算出する', () => {
  const result = deriveSocialBaseline(
    'cell_tokyo_01',
    12,
    Array.from({ length: 7 }, (_, index) => snapshot(index + 1, 2)),
    new Date(2026, 7, 28, 3, 30)
  );
  assert.equal(result.sampleCount, 7);
  assert.equal(result.median, 2);
  assert.ok(result.anomalyScore !== null && result.anomalyScore > 90);
});

test('端末タイムゾーンに依存せず日本時間の同時間帯を比較する', () => {
  const now = new Date('2026-08-28T00:30:00.000Z'); // 日本時間 09:30
  const history = Array.from({ length: 7 }, (_, index) => ({
    ...snapshot(index + 1, 2),
    capturedAt: new Date(now.getTime() - (index + 1) * 24 * 60 * 60_000).toISOString(),
  }));
  const result = deriveSocialBaseline('cell_tokyo_01', 8, history, now);
  assert.equal(result.sampleCount, 7);
});
