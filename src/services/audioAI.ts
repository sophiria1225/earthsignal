/**
 * EarthSignal - Audio Signal Processing Pipeline
 * Implements Section 13 of Requirements Document v1.0
 * Browser Web Audio API recording + signal-quality heuristics + privacy protection
 */

import { AudioAnalysis, AudioLabel } from '../types';
import { createLocalId } from './id';

export interface AudioQualityMetrics {
  durationMs: number;
  rmsDb: number;
  clippingRatio: number;
  silenceRatio: number;
  speechRatio: number;
  qualityScore: number;
}

/**
 * 録音されたAudioBufferの音響品質および会話比率を計算する
 */
export function analyzeAudioBuffer(audioBuffer: AudioBuffer): AudioQualityMetrics {
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const length = channelData.length;
  const durationMs = Math.round((length / sampleRate) * 1000);

  let sumSquares = 0;
  let clippingSamples = 0;
  let silenceSamples = 0;
  const silenceThreshold = 0.01;
  const clippingThreshold = 0.98;

  // 会話周波数帯 (300Hz - 3400Hz) のエネルギーを概算推定するための簡易ゼロ交差率 / 振幅変動
  let zeroCrossings = 0;
  let prevSample = 0;

  for (let i = 0; i < length; i++) {
    const sample = channelData[i];
    const absSample = Math.abs(sample);

    sumSquares += sample * sample;

    if (absSample >= clippingThreshold) {
      clippingSamples++;
    }
    if (absSample < silenceThreshold) {
      silenceSamples++;
    }

    if ((sample >= 0 && prevSample < 0) || (sample < 0 && prevSample >= 0)) {
      zeroCrossings++;
    }
    prevSample = sample;
  }

  const rms = Math.sqrt(sumSquares / length);
  const rmsDb = rms > 0 ? Math.round(20 * Math.log10(rms) * 10) / 10 : -100;
  const clippingRatio = Math.round((clippingSamples / length) * 1000) / 1000;
  const silenceRatio = Math.round((silenceSamples / length) * 1000) / 1000;

  // ゼロ交差率 (ZCR) と周波数成分から簡易会話検知比率を推定
  const zcr = zeroCrossings / length;
  // 会話音声はおおむね ZCR 0.04 〜 0.15 かつ適度な振幅を持つ
  let estimatedSpeechRatio = 0.0;
  if (zcr >= 0.03 && zcr <= 0.18 && rmsDb > -36 && rmsDb < -12) {
    estimatedSpeechRatio = Math.min(0.65, Math.max(0.05, (rms + 0.1) * (zcr * 4)));
  }
  const speechRatio = Math.round(estimatedSpeechRatio * 100) / 100;

  // 品質スコア計算: クリッピングや無音率が高いと低下
  let q = 1.0;
  if (clippingRatio > 0.05) q -= 0.3;
  if (silenceRatio > 0.6) q -= 0.4;
  if (rmsDb < -45) q -= 0.3;
  if (durationMs < 3000) q -= 0.4;
  const qualityScore = Math.max(0.1, Math.min(1.0, Math.round(q * 100) / 100));

  return {
    durationMs,
    rmsDb,
    clippingRatio,
    silenceRatio,
    speechRatio,
    qualityScore,
  };
}

/**
 * 端末内で算出できる信号品質指標を表示用ラベルへ変換する。
 * 動物種や音源の分類モデルではないため、犬・鳥などは利用者確認として別途記録する。
 */
export function classifyAudioFeatures(
  metrics: AudioQualityMetrics,
  observationId: string
): AudioAnalysis {
  const topLabels: AudioLabel[] = [];

  const isSpeech = metrics.speechRatio > 0.15;
  const isSilent = metrics.silenceRatio > 0.5;

  const levelScore = Math.max(0, Math.min(1, (metrics.rmsDb + 60) / 48));
  topLabels.push({
    label: 'Environmental sound level',
    displayName: metrics.rmsDb > -24 ? '大きめの環境音' : '通常〜小さめの環境音',
    meanScore: Math.round(levelScore * 100) / 100,
    maxScore: Math.round(levelScore * 100) / 100,
    frameRatio: 1 - metrics.silenceRatio,
  });

  if (isSpeech) {
    topLabels.push({
      label: 'Speech / Conversation',
      displayName: '人の会話・発話 (Speech)',
      meanScore: metrics.speechRatio,
      maxScore: metrics.speechRatio,
      frameRatio: metrics.speechRatio,
    });
  }

  if (isSilent) {
    topLabels.push({
      label: 'Silence',
      displayName: '無音区間が多い録音',
      meanScore: metrics.silenceRatio,
      maxScore: metrics.silenceRatio,
      frameRatio: metrics.silenceRatio,
    });
  }

  if (metrics.clippingRatio > 0.01) {
    topLabels.push({
      label: 'Clipping',
      displayName: '入力音量超過（クリッピング）',
      meanScore: metrics.clippingRatio,
      maxScore: metrics.clippingRatio,
      frameRatio: metrics.clippingRatio,
    });
  }

  topLabels.sort((a, b) => b.meanScore - a.meanScore);

  return {
    id: createLocalId('aud_an'),
    observationId,
    modelVersion: 'signal-quality-heuristic-v1',
    durationMs: metrics.durationMs,
    rmsDb: metrics.rmsDb,
    clippingRatio: metrics.clippingRatio,
    silenceRatio: metrics.silenceRatio,
    speechRatio: metrics.speechRatio,
    qualityScore: metrics.qualityScore,
    topLabels: topLabels.slice(0, 5),
    rawAudioDeleted: true, // プライバシー保護: 生音声は即時削除
    retentionHoursRemaining: 0,
    completedAt: new Date().toISOString(),
  };
}
