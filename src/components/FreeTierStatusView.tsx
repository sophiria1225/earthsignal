import React, { useState } from 'react';
import { FreeTierStatus, KillSwitchSettings } from '../types';
import { getFreeTierStatus, updateKillSwitch } from '../services/freeTierGuard';
import { 
  ShieldCheck, 
  Cpu, 
  Database, 
  Cloud, 
  Radio, 
  Power, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  Layers, 
  Sliders, 
  Lock,
  Flame
} from 'lucide-react';

export const FreeTierStatusView: React.FC = () => {
  const [status, setStatus] = useState<FreeTierStatus>(getFreeTierStatus());
  const [message, setMessage] = useState<string | null>(null);

  const handleToggle = (key: keyof KillSwitchSettings) => {
    const updated = updateKillSwitch(key, !status.killSwitches[key]);
    setStatus(updated);
    setMessage(`キルスイッチ [${key}] を ${!status.killSwitches[key] ? '有効' : '停止'} に変更しました。`);
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div id="free-tier-status-view" className="space-y-6">
      {/* ゼロコスト・安全運用ポリシー */}
      <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl p-6 shadow-xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">完全無料運用ガード（必須月額費用 0円）</h2>
              <p className="text-xs text-slate-300">
                Cloudflare Free / Open-Meteo / P2P地震情報 / 公開SNS / 端末内YAMNet の安全枠制御
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              システム正常稼働中
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
          各サービスの無料上限を超える前に自動的にキャッシュ延長やルール分類フォールバックを実行し、<strong>有料課金への自動移行を一切行いません。</strong> また、外部APIの障害や不測の負荷に備えて個別のキルスイッチ（緊急停止）を即時切り替え可能です。
        </p>
      </div>

      {message && (
        <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-indigo-600" />
          <span>{message}</span>
        </div>
      )}

      {/* 本日のリソース利用量 (FR-101) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
            <Cpu className="w-5 h-5 text-indigo-500" />
            本日の無料枠利用状況（UTC基準: {status.dateUtc}）
          </h3>
          <span className="text-xs text-slate-400 font-mono">毎日 00:00 UTC リセット</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {status.resources.map(res => {
            const percent = Math.min(100, Math.round((res.used / res.hardLimit) * 100));
            const isWarning = percent >= 70;
            const isExceeded = res.state === 'stopped_for_today';

            return (
              <div
                key={res.resourceKey}
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">{res.name}</span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    isExceeded
                      ? 'bg-rose-100 dark:bg-rose-950 text-rose-600'
                      : isWarning
                      ? 'bg-amber-100 dark:bg-amber-950 text-amber-600'
                      : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600'
                  }`}>
                    {res.state === 'normal' ? '正常' : res.state === 'soft_limit_exceeded' ? '省枠モード' : '停止中'}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex items-baseline justify-between text-xs font-mono">
                    <span className="text-slate-900 dark:text-white font-bold">{res.used.toLocaleString()}</span>
                    <span className="text-slate-400">/ {res.hardLimit.toLocaleString()} {res.unit} ({percent}%)</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isExceeded ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  💡 {res.fallbackDescription}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* データソース別ステータス & キルスイッチ (FR-102) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              <Sliders className="w-5 h-5 text-cyan-500" />
              データソース健全性 & 個別キルスイッチ
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              異常検知やAPI障害時に即座に特定データソースの取得・処理をトグル停止できます
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {status.sources.map(src => {
            const switchKey = src.sourceName === 'workers_ai' ? 'workersAi' : (src.sourceName === 'p2pquake' ? 'p2pQuake' : (src.sourceName === 'open_meteo' ? 'openMeteo' : src.sourceName as keyof KillSwitchSettings));
            const isEnabled = status.killSwitches[switchKey] ?? src.enabled;

            return (
              <div key={src.sourceName} className="py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${isEnabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    <span className="font-bold text-xs text-slate-900 dark:text-white">{src.displayName}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({src.latencyMs}ms)</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span>本日呼出: <strong className="text-slate-700 dark:text-slate-300">{src.dailyCallsUsed}</strong> / {src.dailyCallsLimit}</span>
                    <span>最終成功: {new Date(src.lastSuccessAt).toLocaleTimeString('ja-JP')}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${isEnabled ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950' : 'text-slate-400 bg-slate-100 dark:bg-slate-800'}`}>
                    {isEnabled ? '有効稼働中' : '停止 (Paused)'}
                  </span>
                  <button
                    onClick={() => handleToggle(switchKey)}
                    className={`p-2 rounded-xl border font-semibold text-xs flex items-center gap-1.5 transition-all ${
                      isEnabled
                        ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 border-rose-200 dark:border-rose-800 hover:bg-rose-100'
                        : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>{isEnabled ? '停止する' : '再開する'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
