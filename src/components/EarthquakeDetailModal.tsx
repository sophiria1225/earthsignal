import React from 'react';
import { useDialogAccessibility } from '../hooks/useDialogAccessibility';
import { Earthquake } from '../types';
import { X, Activity, AlertTriangle, ShieldCheck, MapPin, ExternalLink, Clock } from 'lucide-react';

interface Props {
  earthquake: Earthquake | null;
  onClose: () => void;
}

export const EarthquakeDetailModal: React.FC<Props> = ({ earthquake, onClose }) => {
  const dialogRef = useDialogAccessibility(onClose);
  if (!earthquake) return null;

  return (
    <div id="earthquake-detail-modal" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="earthquake-detail-title" tabIndex={-1} className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden my-auto outline-none">
        
        {/* ヘッダー */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 id="earthquake-detail-title" className="font-bold text-slate-900 dark:text-white text-base">
                公式地震情報 詳細
              </h3>
              <span className="text-xs text-slate-500">
                情報源: {earthquake.source === 'p2pquake' ? 'P2P地震情報 API v2' : earthquake.source}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="地震情報の詳細を閉じる"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 本文 */}
        <div className="p-6 space-y-5 text-slate-700 dark:text-slate-300 text-xs">
          
          {/* メイン情報 */}
          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-slate-500 block mb-0.5">発生日時 (JST)</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {new Date(earthquake.occurredAt).toLocaleString('ja-JP')}
                </span>
                <h4 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                  {earthquake.hypocenterName}
                </h4>
              </div>

              {earthquake.maxIntensity && (
                <div className="px-3.5 py-2 rounded-xl bg-red-500 text-white font-bold text-center">
                  <span className="text-[10px] block opacity-90">最大震度</span>
                  <span className="text-2xl leading-none">{earthquake.maxIntensity}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800">
              <div>
                <span className="text-slate-400 block text-[10px]">規模 (M)</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                  {earthquake.magnitude ? `M${earthquake.magnitude.toFixed(1)}` : '不明'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">震源の深さ</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                  {earthquake.depthKm !== null ? `約 ${earthquake.depthKm} km` : 'ごく浅い'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">津波の有無</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                  {earthquake.tsunamiStatus === 'none' ? 'なし' : earthquake.tsunamiStatus}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">改訂番号 (Rev)</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                  第 {earthquake.revision} 報
                </span>
              </div>
            </div>
          </div>

          {/* 震源座標 */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-indigo-500" />
              <span>震源座標: 北緯 {earthquake.latitude.toFixed(2)}° / 東経 {earthquake.longitude.toFixed(2)}°</span>
            </div>
            <span className="text-slate-400 text-[10px]">WGS84</span>
          </div>

          {/* 出典と科学的原則 */}
          <div className="space-y-2">
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-900 dark:text-blue-200 space-y-1">
              <span className="font-bold flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                公的データ出典について
              </span>
              <p className="text-[11px] leading-relaxed opacity-90">
                本情報はP2P地震情報プラットフォーム経由で取得された気象庁発表の公式地震データです。本アプリが独自に観測・改変したものではありません。
              </p>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-900 dark:text-amber-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>地震予知との混同防止:</strong> 現在の「事後検証」タブは、将来のケース・コントロール分析手順を示す設計サンプルです。実研究結果ではありません。
              </span>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={onClose}
              className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold px-4 py-2 rounded-xl"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
