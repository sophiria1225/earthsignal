import React, { useState } from 'react';
import { useDialogAccessibility } from '../hooks/useDialogAccessibility';
import { GeoCell, Observation, CitizenReportData } from '../types';
import { 
  X, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  HelpCircle, 
  Sparkles,
  VolumeX,
  Volume2,
  Bird,
  Cloud,
  Radio,
  Sliders,
  EyeOff
} from 'lucide-react';

interface Props {
  cell: GeoCell;
  onClose: () => void;
  onSubmitObservation: (obs: Observation) => void;
}

export const CitizenReportModal: React.FC<Props> = ({ cell, onClose, onSubmitObservation }) => {
  const dialogRef = useDialogAccessibility(onClose);
  const [category, setCategory] = useState<CitizenReportData['category']>('animal_active');
  const [intensity, setIntensity] = useState(3);
  const [differenceFromNormal, setDifferenceFromNormal] = useState(3);
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'aggregate_only' | 'anonymous_public'>('aggregate_only');
  const [isCompleted, setIsCompleted] = useState(false);

  const categories: { key: CitizenReportData['category']; label: string; desc: string }[] = [
    { key: 'animal_active', label: '動物が普段より多く鳴いている', desc: '犬の連続遠吠え、猫の鳴き声等の増加' },
    { key: 'animal_quiet', label: '動物や虫が急に静かになった', desc: '普段聞こえる鳴き声の突発的途絶' },
    { key: 'bird_flock', label: '鳥の群れ・飛び方が普段と違う', desc: 'カラス等の集団飛来や方向の偏り' },
    { key: 'cloud_shape', label: '雲の形・空の様子が気になった', desc: '帯状・波状等の特異な雲模様' },
    { key: 'low_rumble_sound', label: '地鳴り・低い音のように感じた', desc: '耳鳴りや遠くの重低音のような感覚' },
    { key: 'micro_tremor', label: '微弱な揺れ・振動を感じた', desc: '地震計検知未満の感覚的微小振動' },
    { key: 'electronic_anomaly', label: '電子機器や通信の異常', desc: 'ラジオのノイズやGPS精度の乱れ' },
    { key: 'other', label: 'その他の違和感・観測', desc: '海水・井戸水・植物等の変化' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const reportData: CitizenReportData = {
      category,
      intensity,
      differenceFromNormal,
      durationMinutes,
      description: description.trim(),
    };

    const newObservation: Observation = {
      id: `obs_rep_${Date.now()}`,
      type: 'citizen_report',
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
      citizenReport: reportData,
      userConfirmation: {
        confirmedLabels: [categories.find((c) => c.key === category)?.label || '市民報告'],
        aiResultCorrect: 'yes',
      },
    };

    onSubmitObservation(newObservation);
    setIsCompleted(true);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <div id="citizen-report-modal" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="citizen-report-title" tabIndex={-1} className="bg-white dark:bg-slate-800 w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col outline-none">
        
        {/* ヘッダー */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 id="citizen-report-title" className="font-bold text-slate-900 dark:text-white text-base">
                市民観測レポートの投稿 (第6.7章)
              </h3>
              <span className="text-xs text-slate-500">
                観測セル: {cell.name}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="市民観測レポートを閉じる"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* フォーム */}
        {!isCompleted ? (
          <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1 text-slate-700 dark:text-slate-300 text-xs">
            
            {/* カテゴリ選択 */}
            <div className="space-y-2">
              <label className="block font-bold text-slate-900 dark:text-white text-xs">
                報告する現象カテゴリ:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {categories.map((c) => {
                  const isSelected = category === c.key;
                  return (
                    <button
                      type="button"
                      key={c.key}
                      onClick={() => setCategory(c.key)}
                      aria-pressed={isSelected}
                      className={`p-3 rounded-xl border cursor-pointer transition-all text-left ${
                        isSelected
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200 shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="font-semibold block mb-0.5">{c.label}</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight block">
                        {c.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-400">
                ※すべての選択肢について、地震との因果関係は科学的に未確認です。
              </p>
            </div>

            {/* スライダー (普段との違い 1-5, 強さ 1-5) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between font-bold">
                  <span>普段との違い (1〜5):</span>
                  <span className="text-emerald-600 dark:text-emerald-400 text-sm">Lv {differenceFromNormal}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={differenceFromNormal}
                  onChange={(e) => setDifferenceFromNormal(Number(e.target.value))}
                  className="w-full accent-emerald-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>わずかな違い</span>
                  <span>極めて珍しい</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between font-bold">
                  <span>現象の強さ (1〜5):</span>
                  <span className="text-emerald-600 dark:text-emerald-400 text-sm">Lv {intensity}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={intensity}
                  onChange={(e) => setIntensity(Number(e.target.value))}
                  className="w-full accent-emerald-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>微弱</span>
                  <span>非常に顕著</span>
                </div>
              </div>
            </div>

            {/* 継続時間 */}
            <div>
              <label className="block font-bold text-slate-900 dark:text-white mb-1">
                継続時間（おおよそ）:
              </label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none"
              >
                <option value={5}>数分間 (1〜5分)</option>
                <option value={15}>15分程度</option>
                <option value={60}>1時間程度</option>
                <option value={180}>数時間継続</option>
                <option value={720}>半日以上</option>
              </select>
            </div>

            {/* 自由記述 */}
            <div>
              <label className="block font-bold text-slate-900 dark:text-white mb-1">
                状況の詳細・メモ (任意):
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="例: 午前10時頃、ベランダから見るとカラスが一斉に西へ騒がしく飛び交っていた 等"
                rows={3}
                maxLength={500}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <span className="text-[10px] text-slate-400 block mt-1">
                ※個人を特定できる住所や人名は記入しないでください（{description.length}/500文字）。
              </span>
            </div>

            {/* 公開範囲 */}
            <div className="space-y-1">
              <label className="block font-bold text-slate-900 dark:text-white">公開範囲:</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="visibility"
                    checked={visibility === 'aggregate_only'}
                    onChange={() => setVisibility('aggregate_only')}
                    className="accent-emerald-600"
                  />
                  <span>匿名統計集計のみ (推奨)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="visibility"
                    checked={visibility === 'anonymous_public'}
                    onChange={() => setVisibility('anonymous_public')}
                    className="accent-emerald-600"
                  />
                  <span>匿名タイムラインに公開</span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-md transition-all text-xs sm:text-sm"
            >
              市民レポートを確定・送信
            </button>
          </form>
        ) : (
          <div className="p-8 text-center space-y-3">
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto animate-bounce" />
            <h4 className="font-bold text-slate-900 dark:text-white text-base">
              市民レポートの送信が完了しました
            </h4>
            <p className="text-xs text-slate-500">
              平常時との差の統計スコアおよび事後検証データとして活用されます。
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
