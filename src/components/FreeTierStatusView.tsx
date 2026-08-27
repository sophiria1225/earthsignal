import React, { useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, Server, ShieldCheck, TriangleAlert } from 'lucide-react';
import { fetchWithTimeout } from '../services/http';

type CheckState = 'checking' | 'ok' | 'degraded';

interface SourceCheck {
  key: string;
  name: string;
  state: CheckState;
  detail: string;
}

const INITIAL_CHECKS: SourceCheck[] = [
  { key: 'server', name: 'EarthSignal API', state: 'checking', detail: '確認中' },
  { key: 'earthquake', name: 'P2P地震情報', state: 'checking', detail: '確認中' },
  { key: 'weather', name: 'Open-Meteo 気象・30日ベースライン', state: 'checking', detail: '確認中' },
  { key: 'social', name: 'Bluesky / Mastodon 公開投稿', state: 'checking', detail: '確認中' },
];

async function readJson(url: string): Promise<any> {
  const response = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } }, 55_000);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export const FreeTierStatusView: React.FC = () => {
  const [checks, setChecks] = useState<SourceCheck[]>(INITIAL_CHECKS);
  const [isChecking, setIsChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  const runChecks = async () => {
    setIsChecking(true);
    setChecks(current => current.map(check => ({ ...check, state: 'checking', detail: '確認中' })));

    const results = await Promise.allSettled([
      readJson('/api/health'),
      readJson('/api/data/earthquakes?limit=10'),
      readJson('/api/data/weather/cell_tokyo_01'),
      readJson('/api/social/posts'),
    ]);

    const next: SourceCheck[] = INITIAL_CHECKS.map((check, index) => {
      const result = results[index];
      if (result.status === 'rejected') {
        return { ...check, state: 'degraded', detail: result.reason instanceof Error ? result.reason.message : '接続失敗' };
      }
      const value = result.value;
      if (check.key === 'server') return { ...check, state: 'ok', detail: `応答時刻 ${new Date(value.timestamp).toLocaleTimeString('ja-JP')}` };
      if (check.key === 'earthquake') {
        return {
          ...check,
          state: value.isLive ? 'ok' : 'degraded',
          detail: value.isLive ? `最新 ${value.earthquakes?.length || 0}件を取得` : (value.error || 'キャッシュまたは停止中'),
        };
      }
      if (check.key === 'weather') {
        const samples = value.weather?.baseline?.sampleCount || 0;
        return {
          ...check,
          state: value.isLive && samples >= 7 ? 'ok' : 'degraded',
          detail: value.isLive ? `同時間帯ベースライン ${samples}標本` : (value.error || '取得停止中'),
        };
      }
      const sources = Array.isArray(value.sources) ? value.sources : [];
      const connected = sources.filter((source: any) => source.ok && !source.degraded).map((source: any) => source.source);
      const partial = sources.filter((source: any) => source.ok && source.degraded).map((source: any) => source.source);
      const failed = sources.filter((source: any) => !source.ok).map((source: any) => source.source);
      const fullyLive = value.isLive && partial.length === 0 && failed.length === 0;
      const details = [
        connected.length > 0 ? `${connected.join(' / ')} 接続` : '',
        partial.length > 0 ? `${partial.join(' / ')} 一部低下` : '',
        failed.length > 0 ? `${failed.join(' / ')} 失敗` : '',
        `24時間内 ${value.posts?.length || 0}件`,
      ].filter(Boolean).join('・');
      return {
        ...check,
        state: fullyLive ? 'ok' : 'degraded',
        detail: value.isLive ? details : '公開APIへ接続できません',
      };
    });

    setChecks(next);
    setCheckedAt(new Date().toISOString());
    setIsChecking(false);
  };

  useEffect(() => {
    runChecks();
  }, []);

  const healthyCount = checks.filter(check => check.state === 'ok').length;

  return (
    <div id="data-source-status-view" className="space-y-6">
      <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl p-6 shadow-xl border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">データソース接続状態</h2>
              <p className="text-xs text-slate-300">表示値ではなく、現在のAPI応答をその場で検査します</p>
            </div>
          </div>
          <button
            onClick={runChecks}
            disabled={isChecking}
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-50 text-xs font-semibold flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
            再チェック
          </button>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          架空の利用量やキルスイッチは表示しません。外部APIはサーバー側でタイムアウト・キャッシュを適用し、障害時はデータの鮮度を落として表示します。
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-indigo-500" />
            接続テスト結果 {healthyCount}/{checks.length}
          </h3>
          <span className="text-[11px] text-slate-400">{checkedAt ? new Date(checkedAt).toLocaleString('ja-JP') : '確認中'}</span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {checks.map(check => (
            <div key={check.key} className="py-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{check.name}</p>
                <p className="text-xs text-slate-500 mt-1">{check.detail}</p>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 ${
                check.state === 'ok'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                  : check.state === 'checking'
                    ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
              }`}>
                {check.state === 'ok' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <TriangleAlert className="w-3.5 h-3.5" />}
                {check.state === 'ok' ? '正常' : check.state === 'checking' ? '確認中' : '低下'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
