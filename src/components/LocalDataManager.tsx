import React, { useState } from 'react';
import { Database, Download, Trash2 } from 'lucide-react';
import { Observation } from '../types';
import { ObservationSnapshot } from '../services/observationHistory';

interface Props {
  observations: Observation[];
  history: ObservationSnapshot[];
  onClearObservations: () => void;
  onClearHistory: () => void;
}

export const LocalDataManager: React.FC<Props> = ({
  observations,
  history,
  onClearObservations,
  onClearHistory,
}) => {
  const [confirmTarget, setConfirmTarget] = useState<'observations' | 'history' | null>(null);

  const exportData = () => {
    const payload = {
      format: 'earthsignal-local-export',
      version: 1,
      exportedAt: new Date().toISOString(),
      observations,
      history,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `earthsignal-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const confirmClear = (target: 'observations' | 'history') => {
    if (confirmTarget !== target) {
      setConfirmTarget(target);
      return;
    }
    if (target === 'observations') onClearObservations();
    else onClearHistory();
    setConfirmTarget(null);
  };

  return (
    <section className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4" aria-labelledby="local-data-title">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 id="local-data-title" className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-500" />
            この端末の観測データ
          </h3>
          <p className="text-xs text-slate-500 mt-1">サーバーではなく、このブラウザに保存されています。</p>
        </div>
        <button type="button" onClick={exportData} className="px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-xs font-semibold flex items-center justify-center gap-2 border border-indigo-200 dark:border-indigo-800">
          <Download className="w-4 h-4" /> JSONバックアップ
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 p-3 flex items-center justify-between gap-3">
          <div>
            <span className="text-[11px] text-slate-500 block">市民観測</span>
            <strong className="text-lg text-slate-900 dark:text-white">{observations.length}件</strong>
          </div>
          <button
            type="button"
            onClick={() => confirmClear('observations')}
            disabled={observations.length === 0}
            className="text-xs font-semibold text-rose-600 dark:text-rose-400 disabled:opacity-40 flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {confirmTarget === 'observations' ? 'もう一度押して削除' : '全件削除'}
          </button>
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 p-3 flex items-center justify-between gap-3">
          <div>
            <span className="text-[11px] text-slate-500 block">実測スナップショット</span>
            <strong className="text-lg text-slate-900 dark:text-white">{history.length}点</strong>
          </div>
          <button
            type="button"
            onClick={() => confirmClear('history')}
            disabled={history.length === 0}
            className="text-xs font-semibold text-rose-600 dark:text-rose-400 disabled:opacity-40 flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {confirmTarget === 'history' ? 'もう一度押して削除' : '履歴を削除'}
          </button>
        </div>
      </div>
      <p className="text-[11px] text-slate-400">バックアップには自由記述を含む場合があります。共有前に内容を確認してください。</p>
    </section>
  );
};
