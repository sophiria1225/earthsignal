import React from 'react';
import { AlertTriangle, ShieldCheck, Info } from 'lucide-react';

interface Props {
  compact?: boolean;
}

export const ScientificDisclaimer: React.FC<Props> = ({ compact = false }) => {
  if (compact) {
    return (
      <div id="scientific-disclaimer-compact" className="bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 px-3 py-2 rounded-lg text-xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>科学的免責事項:</strong> 本アプリは<strong>地震予知・警報アプリではありません</strong>。平常時データからの統計的観測異常度を可視化・事後検証する市民科学プラットフォームです。
          </span>
        </div>
      </div>
    );
  }

  return (
    <div id="scientific-disclaimer-full" className="bg-slate-900/5 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4 text-sm text-slate-700 dark:text-slate-300">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-amber-500/15 rounded-lg text-amber-600 shrink-0 mt-0.5">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              EarthSignalの運用原則と科学的前提 (第0章準拠)
            </h4>
            <span className="text-xs bg-blue-500/10 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded border border-blue-500/20">
              公式データ出典: P2P地震情報 / 気象庁 / Open-Meteo
            </span>
          </div>
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            現在、日時・場所・規模を事前に特定する科学的に確立された地震予知手法は存在しません。動物の異常行動や雲の形状と地震との再現可能な因果関係は証明されていません。
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
            <div className="bg-white/80 dark:bg-slate-900/60 p-2 rounded border border-slate-200/60 dark:border-slate-700/40">
              <span className="font-medium text-slate-900 dark:text-slate-200 block mb-0.5">1. 公式地震情報の可視化</span>
              気象庁由来の公的地震データ・震度を客観表示します。
            </div>
            <div className="bg-white/80 dark:bg-slate-900/60 p-2 rounded border border-slate-200/60 dark:border-slate-700/40">
              <span className="font-medium text-slate-900 dark:text-slate-200 block mb-0.5">2. 観測異常度の算出</span>
              過去の同地域・同時間帯からの「統計的な珍しさ」を0〜100で提示（※地震確率ではありません）。
            </div>
            <div className="bg-white/80 dark:bg-slate-900/60 p-2 rounded border border-slate-200/60 dark:border-slate-700/40">
              <span className="font-medium text-slate-900 dark:text-slate-200 block mb-0.5">3. 地震後の事後検証</span>
              地震発生前後の対照群比較を行い、想起バイアスや偽陽性を科学的に検証します。
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
