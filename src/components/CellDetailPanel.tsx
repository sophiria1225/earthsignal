import React, { useState } from 'react';
import { GeoCell } from '../types';
import { 
  X, 
  MapPin, 
  ShieldCheck, 
  HelpCircle, 
  TrendingUp, 
  Cloud, 
  Volume2, 
  Gauge, 
  FileText, 
  AlertTriangle,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Legend 
} from 'recharts';

interface Props {
  cell: GeoCell | null;
  onClose: () => void;
  onOpenRecord: (cell: GeoCell) => void;
}

export const CellDetailPanel: React.FC<Props> = ({ cell, onClose, onOpenRecord }) => {
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  if (!cell) return null;

  const score = cell.currentScore;

  // 時系列シミュレーションデータ (24時間 / 7日)
  const timeseriesData = Array.from({ length: 12 }).map((_, i) => {
    const hour = (i * 2 + 2) % 24;
    const baseAudio = score.animalAudioScore || 40;
    const baseWeather = score.weatherScore || 45;
    const baseSocial = score.socialScore || 50;
    const baseOverall = score.overallScore || 42;
    
    // 時間帯による変動
    const noise = Math.sin(i * 0.8) * 8;
    return {
      time: `${hour}:00`,
      overall: Math.max(10, Math.min(95, Math.round(baseOverall + noise))),
      audio: Math.max(10, Math.min(95, Math.round(baseAudio + noise * 1.4))),
      weather: Math.max(10, Math.min(95, Math.round(baseWeather - noise * 0.8))),
      social: Math.max(10, Math.min(95, Math.round(baseSocial + noise * 1.1))),
      baselineMedian: 35,
    };
  });

  // Gemini API またはサーバエンドポイントによる自然言語解説リクエスト
  const fetchAiExplanation = async () => {
    setIsLoadingAi(true);
    try {
      const res = await fetch('/api/ai/explain-anomaly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cellName: cell.name,
          score: score.overallScore,
          contributors: score.contributors,
          confounders: score.confounders,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiExplanation(data.explanation);
      } else {
        setAiExplanation(score.explanationText);
      }
    } catch {
      setAiExplanation(score.explanationText);
    } finally {
      setIsLoadingAi(false);
    }
  };

  return (
    <div id="cell-detail-modal" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 w-full max-w-4xl rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
        
        {/* モーダルヘッダー */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                  {cell.name}
                </h3>
                <span className="text-xs text-slate-500">({cell.prefecture})</span>
              </div>
              <span className="text-xs text-slate-500">
                H3地域セル: {cell.id} / 標本数: {score.sampleCount} 件
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* モーダルコンテンツ */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1 text-slate-700 dark:text-slate-300">
          
          {/* スコアサマリー */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800">
              <span className="text-xs text-slate-500 block mb-1">総合観測異常度</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                  {score.overallScore !== null ? score.overallScore : '―'}
                </span>
                <span className="text-xs text-slate-500">/ 100</span>
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                ロバストZスコア換算式 (k=3.0) 準拠
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800">
              <span className="text-xs text-slate-500 block mb-1">データ品質指標 (Q)</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">
                  {(score.qualityScore * 100).toFixed(0)}%
                </span>
                <span className="text-xs text-slate-500">({score.status})</span>
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                標本数・風速ノイズ・投稿者多様性を加味
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800">
              <span className="text-xs text-slate-500 block mb-1">主な寄与指標</span>
              <span className="font-bold text-slate-900 dark:text-slate-200 text-sm block">
                {score.contributors[0]?.displayName || '特異寄与なし'}
              </span>
              <span className="text-[11px] text-amber-600 dark:text-amber-400 block mt-1">
                {score.contributors[0]?.changeRate || '平常範囲内'}
              </span>
            </div>
          </div>

          {/* 時系列推移チャート (Recharts) */}
          <div className="bg-white dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-500" />
                観測異常度の時系列推移 (過去24時間)
              </h4>
              <span className="text-xs text-slate-500">中央値ベースライン比</span>
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeseriesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                  <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} />
                  <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={11} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }} 
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Line type="monotone" dataKey="overall" name="総合観測異常度" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="social" name="SNS集合知" stroke="#8b5cf6" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="audio" name="動物音響" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                  <Line type="monotone" dataKey="weather" name="雲・気象" stroke="#06b6d4" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="baselineMedian" name="平常中央値基準 (35)" stroke="#64748b" strokeWidth={1} strokeDasharray="2 2" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* SNS集合知 (v2.0 SCR-004) */}
          {cell.socialSummary && (
            <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  SNS公開集合知 観測サマリー ({cell.socialSummary.window})
                </h4>
                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                  異常度 {cell.socialSummary.anomalyScore}/100 (品質: {cell.socialSummary.qualityScore})
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="bg-white dark:bg-slate-800 p-2 rounded-lg">
                  <span className="text-slate-400 text-[10px] block">総言及数</span>
                  <span className="font-bold text-slate-900 dark:text-white">{cell.socialSummary.totalPosts} 件</span>
                </div>
                <div className="bg-white dark:bg-slate-800 p-2 rounded-lg">
                  <span className="text-slate-400 text-[10px] block">推定独立投稿者</span>
                  <span className="font-bold text-slate-900 dark:text-white">約 {cell.socialSummary.uniqueActorEstimate} 名</span>
                </div>
                <div className="bg-white dark:bg-slate-800 p-2 rounded-lg">
                  <span className="text-slate-400 text-[10px] block">雲・空の言及</span>
                  <span className="font-bold text-slate-900 dark:text-white">{cell.socialSummary.categories.cloud} 件</span>
                </div>
                <div className="bg-white dark:bg-slate-800 p-2 rounded-lg">
                  <span className="text-slate-400 text-[10px] block">動物・鳥類の言及</span>
                  <span className="font-bold text-slate-900 dark:text-white">{cell.socialSummary.categories.animal} 件</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/40 dark:border-slate-800 text-[11px] text-slate-500">
                <p>※Bluesky / Mastodon / YouTube 公開エンドポイントより集計</p>
                <div className="flex items-center gap-2">
                  <a
                    href={`https://bsky.app/search?q=${encodeURIComponent(`${cell.name} 地震雲 OR 地鳴り`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                  >
                    Blueskyで検索 ↗
                  </a>
                  <span>|</span>
                  <a
                    href="https://mstdn.jp/tags/%E5%9C%B0%E9%9C%87%E9%9B%B2"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                  >
                    Mastodonで検索 ↗
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* 寄与要因の内訳 & ロバストZスコア */}
          <div className="space-y-3">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">
              各観測特徴量のロバストZスコア内訳
            </h4>

            <div className="space-y-2">
              {score.contributors.map((c, i) => (
                <div key={i} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-xs flex items-center justify-between gap-3">
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white block">{c.displayName}</span>
                    <span className="text-[11px] text-slate-500">{c.note}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 text-sm block">z = {c.zScore}</span>
                    <span className="text-[10px] text-slate-400">寄与度 {c.contribution.toFixed(0)}/100</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 科学的解説 & 自然文根拠 (第12.9章) */}
          <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-4 rounded-xl border border-indigo-200/60 dark:border-indigo-800/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                学術的解説・根拠テキスト
              </span>
              <button
                onClick={fetchAiExplanation}
                disabled={isLoadingAi}
                className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingAi ? 'animate-spin' : ''}`} />
                {isLoadingAi ? '解説生成中...' : '解説を再生成'}
              </button>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              {aiExplanation || score.explanationText}
            </p>
          </div>

          {/* 免責 */}
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              本スコアは過去の同一地域・同一時間帯との「統計的乖離度」を示す指標です。地震の発生を予測・保証するものではありません。
            </span>
          </div>
        </div>

        {/* モーダルフッター */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
          <span className="text-xs text-slate-500">出典: P2P地震情報 / Open-Meteo / 市民音響</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              閉じる
            </button>
            <button
              onClick={() => {
                onClose();
                onOpenRecord(cell);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition-colors"
            >
              この地域で観測を投稿
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
