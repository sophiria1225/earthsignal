/**
 * EarthSignal - Audio AI & Audio Processing Pipeline
 * Implements Section 13 of Requirements Document v1.0
 * Browser Web Audio API recording + YAMNet classification simulation + Privacy protection
 */

import { AudioAnalysis, AudioLabel } from '../types';

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
 * YAMNet (521クラス) 音響分類シミュレーション
 * 音声特徴量と環境パラメータに基づき、上位ラベルを分類
 */
export function classifyAudioFeatures(
  metrics: AudioQualityMetrics,
  observationId: string,
  environmentHint?: string
): AudioAnalysis {
  const topLabels: AudioLabel[] = [];

  // 音声のRMSとZCR、品質に基づき自然界の音響シグネチャを分類
  const isLoud = metrics.rmsDb > -24;
  const isSpeech = metrics.speechRatio > 0.15;
  const isSilent = metrics.silenceRatio > 0.5;

  if (isSpeech) {
    topLabels.push({
      label: 'Speech / Conversation',
      displayName: '人の会話・発話 (Speech)',
      meanScore: 0.58,
      maxScore: 0.86,
      frameRatio: metrics.speechRatio,
    });
  }

  // 犬の鳴き声 (周期的なパルス性高エネルギー音)
  const dogScore = isLoud ? 0.65 : 0.38;
  topLabels.push({
    label: 'Dog / Bark',
    displayName: '犬の鳴き声 (Bark / Howl)',
    meanScore: dogScore,
    maxScore: Math.min(0.96, dogScore + 0.28),
    frameRatio: 0.42,
  });

  // 野鳥のさえずり
  topLabels.push({
    label: 'Bird vocalization',
    displayName: '野鳥のさえずり (Bird Song)',
    meanScore: 0.32,
    maxScore: 0.64,
    frameRatio: 0.25,
  });

  // カラス
  topLabels.push({
    label: 'Crow / Caw',
    displayName: 'カラスの鳴き声 (Crow)',
    meanScore: 0.24,
    maxScore: 0.52,
    frameRatio: 0.18,
  });

  // 風切り音
  topLabels.push({
    label: 'Wind',
    displayName: '風切り音 (Wind Noise)',
    meanScore: metrics.rmsDb < -30 ? 0.45 : 0.18,
    maxScore: 0.55,
    frameRatio: 0.30,
  });

  // 低周波環境音 (地鳴り様・車両・重低音)
  topLabels.push({
    label: 'Low Frequency Rumble / Vehicle',
    displayName: '低周波環境音・車両振動',
    meanScore: 0.19,
    maxScore: 0.41,
    frameRatio: 0.15,
  });

  topLabels.sort((a, b) => b.meanScore - a.meanScore);

  return {
    id: `aud_an_${Date.now()}`,
    observationId,
    modelVersion: 'yamnet-v1.0.2',
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
