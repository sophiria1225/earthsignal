import React, { useState, useRef, useEffect } from 'react';
import { GeoCell, Observation, AudioAnalysis } from '../types';
import { analyzeAudioBuffer, classifyAudioFeatures } from '../services/audioAI';
import { 
  X, 
  Mic, 
  Square, 
  Play, 
  Trash2, 
  CheckCircle, 
  AlertTriangle, 
  ShieldCheck, 
  Volume2, 
  Clock, 
  Radio,
  Lock,
  Sparkles
} from 'lucide-react';

interface Props {
  cell: GeoCell;
  onClose: () => void;
  onSubmitObservation: (obs: Observation) => void;
}

export const AudioRecorderModal: React.FC<Props> = ({ cell, onClose, onSubmitObservation }) => {
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'analyzing' | 'confirming' | 'completed'>('idle');
  const [recordedSeconds, setRecordedSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<AudioAnalysis | null>(null);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [userComment, setUserComment] = useState('');
  const [visibility, setVisibility] = useState<'aggregate_only' | 'anonymous_public'>('aggregate_only');
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // 録音開始
  const startRecording = async () => {
    try {
      setAnalysisError(null);
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setRecordingState('analyzing');
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Web Audio API でデコードして解析
        try {
          const arrayBuffer = await audioBlob.arrayBuffer();
          const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
          const metrics = analyzeAudioBuffer(decodedBuffer);
          
          const obsId = `obs_aud_${Date.now()}`;
          const analysis = classifyAudioFeatures(metrics, obsId);
          setAnalysisResult(analysis);
          setSelectedLabels([]);

          // 会話比率が高い場合はプライバシー保護のため匿名集計のみに強制
          if (analysis.speechRatio > 0.15) {
            setVisibility('aggregate_only');
          }

          setRecordingState('confirming');
          audioChunksRef.current = [];
          if (audioCtx.state !== 'closed') await audioCtx.close();
        } catch (err) {
          console.error('Audio decode error:', err);
          audioChunksRef.current = [];
          setAnalysisResult(null);
          setAnalysisError('このブラウザでは録音データを解析できませんでした。別のブラウザで再度お試しください。');
          setRecordingState('idle');
        }
      };

      mediaRecorder.start(100);
      setRecordingState('recording');
      setRecordedSeconds(0);

      // タイマー (10秒で自動停止)
      timerIntervalRef.current = setInterval(() => {
        setRecordedSeconds((prev) => {
          if (prev >= 9) {
            stopRecording();
            return 10;
          }
          return prev + 1;
        });
      }, 1000);

      // 音量レベルメーター更新
      const updateLevel = () => {
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((p, c) => p + c, 0) / dataArray.length;
          setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        }
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

    } catch (err: any) {
      alert(`マイクへのアクセスが許可されていません: ${err.message}`);
    }
  };

  // 録音停止
  const stopRecording = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
  };

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  // 投稿の確定
  const handleFinalize = () => {
    if (!analysisResult) return;

    const newObservation: Observation = {
      id: analysisResult.observationId,
      type: 'audio',
      observedAt: new Date().toISOString(),
      cellId: cell.id,
      cellName: cell.name,
      locationApprox: {
        latitude: cell.center.latitude,
        longitude: cell.center.longitude,
      },
      visibility,
      status: 'finalized',
      createdAt: new Date().toISOString(),
      audioAnalysis: analysisResult,
      userConfirmation: {
        confirmedLabels: selectedLabels,
        aiResultCorrect: 'unknown',
        userNotes: userComment,
      },
    };

    onSubmitObservation(newObservation);
    setRecordingState('completed');
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <div id="audio-recorder-modal" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden my-auto">
        
        {/* ヘッダー */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                10秒音響観測
              </h3>
              <span className="text-xs text-slate-500">
                観測対象セル: {cell.name}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ボディ */}
        <div className="p-6 space-y-6">
          
          {/* 1. 録音前画面 (Idle) */}
          {recordingState === 'idle' && (
            <div className="space-y-5 text-center">
              <div className="w-20 h-20 mx-auto rounded-full bg-indigo-50 dark:bg-indigo-950/50 border-2 border-dashed border-indigo-300 dark:border-indigo-700 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Mic className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 dark:text-white text-base">
                  周囲の環境音を10秒間録音します
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                  端末内で音量・無音率・クリッピング・会話らしさを解析し、聞こえた音の種類は利用者が確認します。文字起こしは行いません。
                </p>
              </div>

              {analysisError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
                  {analysisError}
                </div>
              )}

              {/* プライバシー保護規約の明記 */}
              <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800 text-left text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  プライバシー保護 (第13.5章 / 第22章)
                </div>
                <ul className="list-disc list-inside text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                  <li><strong>生音声はサーバーへ送信・保存せず</strong>、端末内解析後にアプリから参照を破棄します。</li>
                  <li>会話比率が高い音声は公衆公開を自動ブロックし、匿名集計のみに限定されます。</li>
                  <li>公開位置は精密座標ではなく、地域セル（約5〜10km圏）の中心へ丸められます。</li>
                </ul>
              </div>

              <button
                onClick={startRecording}
                className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-indigo-500/20 active:scale-95 transition-all text-sm flex items-center justify-center gap-2"
              >
                <Mic className="w-4 h-4" />
                マイク録音を開始 (10秒)
              </button>
            </div>
          )}

          {/* 2. 録音中画面 (Recording) */}
          {recordingState === 'recording' && (
            <div className="space-y-6 text-center py-4">
              <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
                <div className="w-20 h-20 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-500/30">
                  <span className="text-2xl font-bold font-mono">{10 - recordedSeconds}s</span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 dark:text-white text-base flex items-center justify-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  録音中... ({recordedSeconds} / 10秒)
                </h4>
                <p className="text-xs text-slate-500">マイクの近くで周囲の音を記録しています</p>
              </div>

              {/* リアルタイム音量レベルメーター */}
              <div className="max-w-xs mx-auto space-y-1">
                <div className="h-3 w-full bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500 rounded-full transition-all duration-75"
                    style={{ width: `${audioLevel}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>静穏</span>
                  <span>入力レベル: {audioLevel}%</span>
                  <span>大音量</span>
                </div>
              </div>

              <button
                onClick={stopRecording}
                className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-semibold px-4 py-2 rounded-xl transition-colors inline-flex items-center gap-1.5"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                今すぐ停止して解析
              </button>
            </div>
          )}

          {/* 3. 解析中画面 (Analyzing) */}
          {recordingState === 'analyzing' && (
            <div className="space-y-4 text-center py-8">
              <div className="w-12 h-12 mx-auto border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 dark:text-white text-base">
                  端末内で音響品質を解析中...
                </h4>
                <p className="text-xs text-slate-500">
                  音量・無音率・クリッピング・ゼロ交差率から品質指標を計算しています
                </p>
              </div>
            </div>
          )}

          {/* 4. 解析結果確認画面 (Confirming) */}
          {recordingState === 'confirming' && analysisResult && (
            <div className="space-y-5">
              
              {/* 端末内信号解析結果 */}
              <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                    <Sparkles className="w-4 h-4" />
                    端末内の信号品質解析
                  </span>
                  <span className="text-[11px] text-slate-500">
                    録音品質: {(analysisResult.qualityScore * 100).toFixed(0)}%
                  </span>
                </div>

                <div className="space-y-1.5">
                  {analysisResult.topLabels.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{item.displayName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-indigo-600 h-full rounded-full"
                            style={{ width: `${Math.round(item.meanScore * 100)}%` }}
                          />
                        </div>
                        <span className="font-bold text-slate-600 dark:text-slate-300 w-10 text-right" title="信号中の該当比率または正規化レベル">
                          {(item.meanScore * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 会話検知時のプライバシー保護アラート */}
                {analysisResult.speechRatio > 0.15 && (
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>会話成分が検知されたため、プライバシー保護として<strong>公衆公開は自動無効化（匿名集計のみ）</strong>されます。</span>
                  </div>
                )}
              </div>

              {/* 利用者による確認選択 (FR-044) */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  実際に聞こえた音を選択してください (利用者の確認):
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {['犬の鳴き声', '猫の鳴き声', '野鳥のさえずり', 'カラス', '虫・カエルの声', '地鳴りのような低い音', '風切り音', '環境音・交通ノイズ', '特に聞こえなかった'].map((label) => {
                    const isSelected = selectedLabels.includes(label);
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedLabels(selectedLabels.filter((l) => l !== label));
                          } else {
                            setSelectedLabels([...selectedLabels, label]);
                          }
                        }}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 font-semibold'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 任意メモ */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  補足メモ (任意・非公開):
                </label>
                <input
                  type="text"
                  value={userComment}
                  onChange={(e) => setUserComment(e.target.value)}
                  placeholder="例: 近所の犬が遠吠えしていた 等"
                  className="w-full text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              {/* 生音声破棄通知 */}
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>✓ 生音声データはメモリから破棄されました（品質指標と利用者が確認したラベルのみ保存）。</span>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setRecordingState('idle')}
                  className="w-1/3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 py-2.5 rounded-xl text-xs font-semibold hover:bg-slate-200"
                >
                  再録音
                </button>
                <button
                  onClick={handleFinalize}
                  disabled={selectedLabels.length === 0}
                  className="w-2/3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20"
                >
                  観測を確定・送信
                </button>
              </div>
            </div>
          )}

          {/* 5. 完了画面 (Completed) */}
          {recordingState === 'completed' && (
            <div className="py-8 text-center space-y-3">
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto animate-bounce" />
              <h4 className="font-bold text-slate-900 dark:text-white text-base">
                観測データの送信が完了しました
              </h4>
              <p className="text-xs text-slate-500">
                地域セルの観測異常度統計に反映されます。ご協力ありがとうございました。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
