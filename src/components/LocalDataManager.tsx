import React, { useRef, useState } from 'react';
import { AlertTriangle, Database, Download, Trash2, Upload } from 'lucide-react';
import { Observation } from '../types';
import { ObservationSnapshot, parseObservationHistory } from '../services/observationHistory';
import { parseObservations } from '../services/observationStore';

interface Props {
  observations: Observation[];
  history: ObservationSnapshot[];
  storageWarning?: string | null;
  onClearObservations: () => void;
  onClearHistory: () => void;
  onRestore: (observations: Observation[], history: ObservationSnapshot[]) => void;
}

export const LocalDataManager: React.FC<Props> = ({
  observations,
  history,
  storageWarning,
  onClearObservations,
  onClearHistory,
  onRestore,
}) => {
  const [confirmTarget, setConfirmTarget] = useState<'observations' | 'history' | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const importData = async (file: File) => {
    setImportStatus(null);
    if (file.size > 5 * 1024 * 1024 || (file.type && !['application/json', 'text/json'].includes(file.type))) {
      setImportStatus('5MB以下のJSONバックアップを選択してください。');
      return;
    }
    try {
      const payload = JSON.parse(await file.text()) as Record<string, unknown>;
      if (payload.format !== 'earthsignal-local-export' || payload.version !== 1) {
        throw new Error('EarthSignal形式ではありません');
      }
      const restoredObservations = parseObservations(JSON.stringify(payload.observations));
      const restoredHistory = parseObservationHistory(JSON.stringify(payload.history));
      if (restoredObservations.length === 0 && restoredHistory.length === 0) {
        throw new Error('復元できる観測データがありません');
      }
      onRestore(restoredObservations, restoredHistory);
      setImportStatus(`市民観測${restoredObservations.length}件・履歴${restoredHistory.length}点を統合しました。`);
    } catch (error) {
      setImportStatus(error instanceof Error ? `復元できません: ${error.message}` : 'バックアップを復元できません。');
    }
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
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => fileInputRef.current?.click()} className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700">
            <Upload className="w-4 h-4" /> 復元
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importData(file);
              event.target.value = '';
            }}
          />
          <button type="button" onClick={exportData} className="px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-xs font-semibold flex items-center justify-center gap-2 border border-indigo-200 dark:border-indigo-800">
            <Download className="w-4 h-4" /> JSONバックアップ
          </button>
        </div>
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
      {storageWarning && (
        <p role="alert" className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl px-3 py-2 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{storageWarning}</span>
        </p>
      )}
      {importStatus && <p role="status" className="text-xs text-indigo-600 dark:text-indigo-400">{importStatus}</p>}
      <p className="text-[11px] text-slate-400">バックアップには自由記述を含む場合があります。共有前に内容を確認してください。</p>
    </section>
  );
};
