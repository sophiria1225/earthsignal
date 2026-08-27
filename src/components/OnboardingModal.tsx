import React from 'react';
import { useDialogAccessibility } from '../hooks/useDialogAccessibility';
import { Shield, AlertTriangle, CheckCircle, Activity, Info, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const OnboardingModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const dialogRef = useDialogAccessibility(onClose, false, isOpen);
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div
        ref={dialogRef}
        id="onboarding-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        tabIndex={-1}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 text-slate-900 dark:text-white outline-none"
      >
        {/* Header Icon */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 dark:bg-indigo-400/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h2 id="onboarding-title" className="text-xl font-bold tracking-tight">EarthSignal へようこそ</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">利用開始前の重要なお知らせ（要件定義書 v2.0 第0章）</p>
          </div>
        </div>

        {/* 警告ボックス */}
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl p-4 space-y-2 text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2 font-bold text-sm text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>本アプリは地震を予知するアプリではありません</span>
          </div>
          <p className="leading-relaxed">
            現在、日時・場所・規模を事前に特定する科学的に確立された地震予知手法は存在しません。動物の異常行動、特殊な雲、気圧変化、SNS投稿についても、地震との再現可能な因果関係は確立していません。
          </p>
        </div>

        {/* 提供する機能の3つの柱 */}
        <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
          <p className="font-semibold text-slate-900 dark:text-white">EarthSignal が提供する機能：</p>
          <div className="space-y-2">
            <div className="flex items-start gap-2.5">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span><strong>公式地震情報の可視化:</strong> 気象庁・P2P地震情報 API v2 による公的速報の表示</span>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span><strong>平常時からの観測異常度:</strong> 利用可能な実測履歴が十分な項目だけをロバスト統計（MAD）で比較し、履歴不足は採点しません</span>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span><strong>事後検証 (Case-Control Analysis):</strong> 地震発生後に、発生前データと地震がなかった対照期間を統計比較して検証する市民科学基盤</span>
            </div>
          </div>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-[11px] text-slate-500 leading-relaxed border border-slate-200/60 dark:border-slate-700/60">
          ※防災行動や避難判断は、必ず気象庁や自治体の公式発表に従ってください。
        </div>

        {/* 同意ボタン */}
        <div className="pt-2">
          <button
            id="onboarding-accept-btn"
            onClick={onClose}
            className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-semibold py-3.5 px-6 rounded-2xl text-sm shadow-md shadow-indigo-500/20 active:scale-98 transition-all flex items-center justify-center gap-2"
          >
            <Shield className="w-4 h-4" />
            <span>上記を理解して利用を開始する</span>
          </button>
        </div>
      </div>
    </div>
  );
};
