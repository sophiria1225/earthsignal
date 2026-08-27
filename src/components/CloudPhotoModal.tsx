import React, { useState, useRef } from 'react';
import { useDialogAccessibility } from '../hooks/useDialogAccessibility';
import { GeoCell, Observation, CloudAnalysis } from '../types';
import { analyzeCloudImage } from '../services/cloudAI';
import { 
  X, 
  Camera, 
  UploadCloud, 
  CheckCircle, 
  AlertCircle, 
  ShieldCheck, 
  Compass, 
  Sparkles,
  Info
} from 'lucide-react';

interface Props {
  cell: GeoCell;
  onClose: () => void;
  onSubmitObservation: (obs: Observation) => void;
}

export const CloudPhotoModal: React.FC<Props> = ({ cell, onClose, onSubmitObservation }) => {
  const dialogRef = useDialogAccessibility(onClose);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [userShapeHint, setUserShapeHint] = useState<string>('other');
  const [direction, setDirection] = useState('南西');
  const [elevation, setElevation] = useState(40);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<CloudAnalysis | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setIsAnalyzing(true);

    try {
      const obsId = `obs_cld_${Date.now()}`;
      const result = await analyzeCloudImage(selectedFile, obsId, userShapeHint, direction, elevation);
      setAnalysisResult(result);
    } catch (err) {
      console.error('Cloud analysis failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFinalize = () => {
    if (!analysisResult) return;

    const newObservation: Observation = {
      id: analysisResult.observationId,
      type: 'cloud_photo',
      observedAt: new Date().toISOString(),
      cellId: cell.id,
      cellName: cell.name,
      locationApprox: {
        latitude: cell.center.latitude,
        longitude: cell.center.longitude,
      },
      visibility: 'aggregate_only',
      status: 'finalized',
      createdAt: new Date().toISOString(),
      cloudAnalysis: analysisResult,
      userConfirmation: {
        confirmedLabels: [analysisResult.detectedCloudTypes[0]?.displayName || '雲観測'],
        aiResultCorrect: 'unknown',
      },
    };

    onSubmitObservation(newObservation);
    setIsCompleted(true);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <div id="cloud-photo-modal" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="cloud-photo-title" tabIndex={-1} className="bg-white dark:bg-slate-800 w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col outline-none">
        
        {/* ヘッダー */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 id="cloud-photo-title" className="font-bold text-slate-900 dark:text-white text-base">
                雲写真の撮影・解析
              </h3>
              <span className="text-xs text-slate-500">
                観測対象セル: {cell.name}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="雲写真の記録を閉じる"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-slate-700 dark:text-slate-300">
          
          {!isCompleted ? (
            <>
              {/* 写真選択エリア */}
              {!previewUrl ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label="解析する雲の写真を選択"
                  className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-cyan-500 dark:hover:border-cyan-400 rounded-2xl p-8 text-center cursor-pointer bg-slate-50 dark:bg-slate-900/40 transition-colors space-y-3"
                >
                  <div className="w-14 h-14 mx-auto rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                    <UploadCloud className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-slate-800 dark:text-slate-200 block">
                      雲の写真をアップロード
                    </span>
                    <span className="text-xs text-slate-500 block mt-1">
                      クリックまたはドラッグ＆ドロップ (JPEG, PNG)
                    </span>
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative rounded-xl overflow-hidden max-h-56 bg-black flex items-center justify-center">
                    <img src={previewUrl} alt="Cloud Preview" className="max-h-56 object-contain" />
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setPreviewUrl(null);
                        setAnalysisResult(null);
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80"
                      aria-label="選択した写真を取り消す"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>✓ 元写真とEXIFは送信・保存せず、端末内で画素だけを解析します。</span>
                  </div>
                </div>
              )}

              {/* 撮影メタデータ設定 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    気になる形状 (自己判断):
                  </label>
                  <select
                    value={userShapeHint}
                    onChange={(e) => setUserShapeHint(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none"
                  >
                    <option value="altocumulus">波状雲・うろこ雲</option>
                    <option value="cirrus">すじ状・放射状の雲</option>
                    <option value="lenticular">レンズ状・静止雲</option>
                    <option value="contrail">飛行機雲・直線状</option>
                    <option value="other">その他・判断不能</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    見えた方角:
                  </label>
                  <select
                    value={direction}
                    onChange={(e) => setDirection(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none"
                  >
                    <option value="北">北 (North)</option>
                    <option value="北東">北東</option>
                    <option value="東">東</option>
                    <option value="南東">南東</option>
                    <option value="南">南</option>
                    <option value="南西">南西</option>
                    <option value="西">西</option>
                    <option value="北西">北西</option>
                    <option value="天頂">天頂 (真上)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                    仰角 (目安):
                  </label>
                  <select
                    value={elevation}
                    onChange={(e) => setElevation(Number(e.target.value))}
                    className="w-full p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none"
                  >
                    <option value={20}>低空 (約20度)</option>
                    <option value={45}>中高度 (約45度)</option>
                    <option value={75}>高空・頭上 (約75度)</option>
                  </select>
                </div>
              </div>

              {/* 解析ボタン */}
              {previewUrl && !analysisResult && (
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-xs sm:text-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  {isAnalyzing ? '画像解析中...' : '空占有率を解析し選択内容を記録'}
                </button>
              )}

              {/* 端末内解析結果表示 */}
              {analysisResult && (
                <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-700 dark:text-cyan-400 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" />
                      端末内画像解析・利用者入力
                    </span>
                    <span className="text-[11px] text-slate-500">
                      空占有率: {Math.round(analysisResult.skyCoverageRatio * 100)}%
                    </span>
                  </div>

                  <div className="space-y-2">
                    {analysisResult.detectedCloudTypes.map((c, i) => (
                      <div key={i} className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 text-xs space-y-1">
                        <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                          <span>{c.displayName}</span>
                          <span className="text-cyan-600 dark:text-cyan-400">
                            {c.confidence > 0 ? '利用者が選択' : '自動判定なし'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                          {c.description}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-1.5">
                    <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      ※科学的に「地震雲」と呼ばれる雲は存在せず、気象条件（大気の波・ジェット気流等）による形状候補を表示しています。
                    </span>
                  </div>

                  <button
                    onClick={handleFinalize}
                    className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2.5 rounded-xl shadow-md transition-all text-xs sm:text-sm"
                  >
                    この雲写真を観測データとして登録
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="py-8 text-center space-y-3">
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto animate-bounce" />
              <h4 className="font-bold text-slate-900 dark:text-white text-base">
                雲写真の登録が完了しました
              </h4>
              <p className="text-xs text-slate-500">
                位置セルと紐付けられた匿名観測データとして集計されます。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
