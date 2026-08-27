import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyAudioFeatures } from './audioAI';

test('未導入の動物分類結果を生成しない', () => {
  const analysis = classifyAudioFeatures({
    durationMs: 10_000,
    rmsDb: -20,
    clippingRatio: 0,
    silenceRatio: 0.1,
    speechRatio: 0.02,
    qualityScore: 0.9,
  }, 'observation-1');
  assert.equal(analysis.modelVersion, 'signal-quality-heuristic-v1');
  assert.equal(analysis.topLabels.some(label => /Dog|Bird|Crow/.test(label.label)), false);
  assert.equal(analysis.rawAudioDeleted, true);
});
