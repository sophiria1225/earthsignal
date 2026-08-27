import React, { useState } from 'react';
import { PostEventEvaluation } from '../types';
import { POST_EVENT_EVALUATIONS } from '../services/dataStore';
import { 
  BarChart3, 
  Sparkles, 
  AlertTriangle, 
  ShieldCheck, 
  HelpCircle, 
  Layers, 
  Calendar, 
  TrendingUp, 
  CheckCircle2, 
  XCircle,
  FileCheck,
  Scale
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Legend, 
  ReferenceLine 
} from 'recharts';

export const PostEventVerificationView: React.FC = () => {
  const [evaluations, setEvaluations] = useState<PostEventEvaluation[]>(POST_EVENT_EVALUATIONS);
  const [selectedEvalId, setSelectedEvalId] = useState<string>(POST_EVENT_EVALUATIONS[0].id);

  const currentEval = evaluations.find((e) => e.id === selectedEvalId) || evaluations[0];

  // チャート用データ整形
  const chartData = currentEval.metrics.map((m) => ({
    name: m.displayName,
    change: m.changePercentage,
    ciLow: m.confidenceInterval95[0],
    ciHigh: m.confidenceInterval95[1],
    significant: m.isStatisticallySignificant,
  }));

  return (
    <div id="post-event-verification-view" className="space-y-6 max-w-7xl mx-auto px-3 sm:px-6 py-6 text-slate-700 dark:text-slate-300">
      
      {/* ページタイトル & 研究方針 */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white text-lg">
                事後検証 (Case-Control Analysis) カタログ
              </h2>
              <span className="text-xs text-slate-500">
                第24章・第25章 研究評価設計 準拠
              </span>
            </div>
          </div>

          <span className="text-xs bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 px-3 py-1 rounded-full border border-purple-200 dark:border-purple-800 font-semibold">
            対照群比較 & リーケージ防止プロトコル
          </span>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-4xl">
          地震発生後にSNS等で語られる「前兆証言」の多くは、地震後の心理的想起バイアスや気象交絡によるものです。EarthSignalでは、地震前24h〜72hの観測データと、地震が起きなかった同曜日・同時間帯の「対照期間」を厳格に比較検証しています。
        </p>
      </div>

      {/* メイングリッド */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* 左: 対象地震一覧セレクター */}
        <div className="lg:col-span-4 space-y-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            検証対象イベント一覧
          </span>

          <div className="space-y-2">
            {evaluations.map((ev) => {
              const isSelected = ev.id === currentEval.id;
              const isFalsePositive = ev.id.includes('false_positive');
              return (
                <div
                  key={ev.id}
                  onClick={() => setSelectedEvalId(ev.id)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all space-y-2 ${
                    isSelected
                      ? 'bg-purple-50/70 dark:bg-purple-950/30 border-purple-500 text-purple-950 dark:text-purple-100 shadow-sm'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      isFalsePositive
                        ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                        : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300'
                    }`}>
                      {isFalsePositive ? '偽陽性検証サンプル' : '実地震ケース'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      窓: 発生前{ev.analysisWindow}
                    </span>
                  </div>

                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    {ev.earthquake.hypocenterName}
                  </h4>

                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                    <span>{ev.cellName}</span>
                    <span>震央距離 約{ev.distanceFromEpicenterKm}km</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 右: 選択地震の詳細検証結果 */}
        <div className="lg:col-span-8 space-y-5">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
            
            {/* 地震概要ヘッダー */}
            <div className="flex items-start justify-between flex-wrap gap-2 pb-4 border-b border-slate-200 dark:border-slate-700">
              <div>
                <span className="text-xs text-slate-500 block mb-1">
                  検証イベント / 発生日時: {new Date(currentEval.earthquake.occurredAt).toLocaleString('ja-JP')}
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  {currentEval.earthquake.hypocenterName}
                </h3>
                <span className="text-xs text-slate-500">
                  観測対象地域: {currentEval.cellName} (震央距離: {currentEval.distanceFromEpicenterKm} km)
                </span>
              </div>

              <div className="text-right">
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                  比較窓: 発生前 {currentEval.analysisWindow} vs 同時間対照群
                </span>
              </div>
            </div>

            {/* 対照群比較バーチャート (Recharts) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Scale className="w-4 h-4 text-purple-500" />
                  平常時対照中央値に対する変化率 (%) と 95% 信頼区間
                </h4>
                <span className="text-xs text-slate-400">0% = 平常中央値と同等</span>
              </div>

              <div className="h-64 w-full bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} unit="%" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                      formatter={(val: any) => [`${val > 0 ? '+' : ''}${val}%`, '変化率']}
                    />
                    <ReferenceLine y={0} stroke="#64748b" strokeWidth={1.5} />
                    <Bar dataKey="change" name="通常対照比変化率 (%)" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 各指標の統計詳細テーブル */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                統計検定データ一覧 (多重比較補正済み)
              </span>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 text-[11px]">
                      <th className="py-2 px-2">特徴量</th>
                      <th className="py-2 px-2">発生前観測値</th>
                      <th className="py-2 px-2">対照群中央値</th>
                      <th className="py-2 px-2">変化率</th>
                      <th className="py-2 px-2">95% 信頼区間</th>
                      <th className="py-2 px-2">有意差 (p&lt;0.05)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {currentEval.metrics.map((m, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                        <td className="py-2.5 px-2 font-medium text-slate-800 dark:text-slate-200">{m.displayName}</td>
                        <td className="py-2.5 px-2">{m.preEventValue}</td>
                        <td className="py-2.5 px-2">{m.controlMedian}</td>
                        <td className={`py-2.5 px-2 font-bold ${m.changePercentage > 0 ? 'text-amber-600' : 'text-blue-600'}`}>
                          {m.changePercentage > 0 ? '+' : ''}{m.changePercentage}%
                        </td>
                        <td className="py-2.5 px-2 text-slate-500 text-[11px]">
                          [{m.confidenceInterval95[0]}%, {m.confidenceInterval95[1]}%]
                        </td>
                        <td className="py-2.5 px-2">
                          {m.isStatisticallySignificant ? (
                            <span className="inline-flex items-center gap-1 text-purple-600 font-semibold text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" /> 有意差あり
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-slate-400 text-[11px]">
                              <XCircle className="w-3.5 h-3.5" /> 統計的差なし
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 学術的総括 (Verdict) */}
            <div className="bg-slate-50 dark:bg-slate-900/70 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-bold text-xs">
                <FileCheck className="w-4 h-4" />
                事後検証サマリー結論
              </div>
              <p className="text-xs text-slate-900 dark:text-white font-semibold leading-relaxed">
                {currentEval.verdictSummary}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed pt-1 border-t border-slate-200/60 dark:border-slate-800">
                <strong>学術的考察:</strong> {currentEval.scientificNotes}
              </p>
            </div>

            {/* 科学的注意書き */}
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>科学的健全性の担保:</strong> EarthSignalでは、高い異常度が出たが地震が発生しなかった「偽陽性事例」も欠落なくアーカイブし、多重比較による偶然の相関を排除する透明な研究姿勢を徹底しています。
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
