import React from 'react';
import { Earthquake, GeoCell, Observation } from '../types';
import { ScientificDisclaimer } from './ScientificDisclaimer';
import { 
  Activity, 
  MapPin, 
  Mic, 
  Camera, 
  FileText, 
  CloudRain, 
  Wind, 
  Gauge, 
  Clock, 
  AlertCircle, 
  ChevronRight, 
  TrendingUp, 
  ShieldCheck, 
  HelpCircle,
  Radio,
  Layers,
  Volume2,
  Sparkles
} from 'lucide-react';

interface Props {
  selectedCell: GeoCell;
  allCells: GeoCell[];
  onSelectCell: (cell: GeoCell) => void;
  recentEarthquakes: Earthquake[];
  recentObservations: Observation[];
  onOpenEarthquakeDetail: (eq: Earthquake) => void;
  onOpenRecordModal: (type?: 'audio' | 'cloud' | 'report') => void;
  onNavigateToMap: () => void;
  onNavigateToEvaluation: () => void;
  onOpenExplanationModal: (cell: GeoCell) => void;
  onNavigateToSocial?: () => void;
  onNavigateToStatus?: () => void;
}

export const HomeDashboard: React.FC<Props> = ({
  selectedCell,
  allCells,
  onSelectCell,
  recentEarthquakes,
  recentObservations,
  onOpenEarthquakeDetail,
  onOpenRecordModal,
  onNavigateToMap,
  onNavigateToEvaluation,
  onOpenExplanationModal,
  onNavigateToSocial,
  onNavigateToStatus,
}) => {
  const latestEq = recentEarthquakes[0];
  const score = selectedCell.currentScore;

  const getScoreBadge = (scoreVal: number | null, status: string) => {
    if (status === 'insufficient' || scoreVal === null) {
      return { label: 'データ不足', color: 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-300' };
    }
    if (scoreVal < 30) {
      return { label: '○ 通常範囲に近い', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30' };
    }
    if (scoreVal < 60) {
      return { label: '△ やや珍しい観測', color: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30' };
    }
    if (scoreVal < 80) {
      return { label: '◇ 珍しい観測', color: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30' };
    }
    return { label: '◆ 非常に珍しい観測', color: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30' };
  };

  const badge = getScoreBadge(score.overallScore, score.status);

  return (
    <div id="home-dashboard" className="space-y-6 max-w-7xl mx-auto px-3 sm:px-6 py-6">
      {/* 科学的免責バナー */}
      <ScientificDisclaimer />

      {/* トップグリッド: 最新公式地震情報 & 地域観測異常度カード */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* 左: 最新の公式地震情報 (OFFICIAL) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700/60 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-base">
                  最新の公式地震情報
                </h3>
              </div>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                P2P地震情報 / 気象庁
              </span>
            </div>

            {latestEq ? (
              <div className="space-y-3">
                <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/70 dark:border-slate-800">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">
                        {new Date(latestEq.occurredAt).toLocaleString('ja-JP', {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })} 発生
                      </span>
                      <h4 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                        {latestEq.hypocenterName}
                      </h4>
                    </div>

                    {latestEq.maxIntensity && (
                      <div className="text-center px-3 py-1.5 rounded-xl bg-red-500 text-white font-bold shadow-sm">
                        <span className="text-[10px] block font-medium opacity-90 leading-tight">最大震度</span>
                        <span className="text-xl leading-none">{latestEq.maxIntensity}</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-800 text-xs">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block text-[10px]">マグニチュード</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-200 text-sm">
                        {latestEq.magnitude ? `M${latestEq.magnitude.toFixed(1)}` : '不明'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block text-[10px]">震源の深さ</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-200 text-sm">
                        {latestEq.depthKm !== null ? `約${latestEq.depthKm} km` : 'ごく浅い'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block text-[10px]">津波の影響</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-200 text-sm">
                        {latestEq.tsunamiStatus === 'none' ? '津波の心配なし' : latestEq.tsunamiStatus}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 最近のその他地震クイックリスト */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">直近の地震履歴:</span>
                  {recentEarthquakes.slice(1, 4).map((eq) => (
                    <div
                      key={eq.id}
                      onClick={() => onOpenEarthquakeDetail(eq)}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 cursor-pointer text-xs transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{eq.hypocenterName}</span>
                        <span className="text-slate-500 dark:text-slate-400">M{eq.magnitude}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-500">
                        <span>最大震度 {eq.maxIntensity || '不明'}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 text-sm">地震情報を受信中...</div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs text-slate-500">
            <span>※公的な気象庁・P2P地震情報準拠</span>
            {latestEq && (
              <button
                onClick={() => onOpenEarthquakeDetail(latestEq)}
                className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium flex items-center gap-0.5"
              >
                震度・詳細情報 <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 右: 選択地域の観測異常度 (DERIVED & OBSERVED) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700/60 shadow-sm flex flex-col justify-between">
          <div>
            {/* 地域セレクター */}
            <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-indigo-600 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">
                      {selectedCell.name}
                    </h3>
                    <span className="text-xs text-slate-500">({selectedCell.prefecture})</span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    H3セルID: {selectedCell.id}
                  </span>
                </div>
              </div>

              {/* 地域切り替えプルダウン */}
              <select
                id="cell-selector-dropdown"
                value={selectedCell.id}
                onChange={(e) => {
                  const target = allCells.find((c) => c.id === e.target.value);
                  if (target) onSelectCell(target);
                }}
                className="text-xs font-medium bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {allCells.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.region}: {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* スコア表示ブロック */}
            <div className="bg-gradient-to-br from-slate-50 to-indigo-50/30 dark:from-slate-900/80 dark:to-indigo-950/20 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/80 mb-4">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">
                    平常時ベースラインからの統計的差異
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                      {score.overallScore !== null ? score.overallScore : '―'}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">/ 100</span>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${badge.color}`}>
                      {badge.label}
                    </span>
                  </div>
                </div>

                <div className="text-right text-xs space-y-1">
                  <div className="flex items-center gap-1.5 justify-end text-slate-600 dark:text-slate-300 font-medium">
                    <ShieldCheck className="w-4 h-4 text-indigo-500" />
                    <span>データ品質指標: {(score.qualityScore * 100).toFixed(0)}%</span>
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    有効観測標本数: {score.sampleCount} 件
                  </div>
                  <button
                    onClick={() => onOpenExplanationModal(selectedCell)}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5 mt-1"
                  >
                    <HelpCircle className="w-3.5 h-3.5" /> 算出根拠・数式を見る
                  </button>
                </div>
              </div>

              {/* 注意書き */}
              <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>この数値は過去30日の同時間帯との「珍しさ」を表すものであり、<strong>地震発生確率ではありません</strong>。</span>
              </div>
            </div>

            {/* カテゴリスコアバー (v2.0 6系統) */}
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
              <div className="bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] mb-0.5">周辺地震</span>
                <span className="font-bold text-slate-900 dark:text-slate-200 text-sm">
                  {score.earthquakeActivityScore !== null ? score.earthquakeActivityScore : '―'}
                </span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] mb-0.5">雲・気象</span>
                <span className="font-bold text-slate-900 dark:text-slate-200 text-sm">
                  {score.weatherScore !== null ? score.weatherScore : '―'}
                </span>
              </div>
              <div className="bg-indigo-50/50 dark:bg-indigo-950/30 p-2 rounded-lg border border-indigo-200/50 dark:border-indigo-800/50">
                <span className="text-indigo-600 dark:text-indigo-400 block text-[10px] font-semibold mb-0.5">SNS集合知</span>
                <span className="font-bold text-indigo-700 dark:text-indigo-300 text-sm">
                  {score.socialScore !== null ? score.socialScore : '―'}
                </span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] mb-0.5">動物音響</span>
                <span className="font-bold text-slate-900 dark:text-slate-200 text-sm">
                  {score.animalAudioScore !== null ? score.animalAudioScore : '―'}
                </span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] mb-0.5">その他音響</span>
                <span className="font-bold text-slate-900 dark:text-slate-200 text-sm">
                  {score.otherAudioScore !== null ? score.otherAudioScore : '―'}
                </span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] mb-0.5">市民レポート</span>
                <span className="font-bold text-slate-900 dark:text-slate-200 text-sm">
                  {score.citizenReportScore !== null ? score.citizenReportScore : '―'}
                </span>
              </div>
            </div>
          </div>

          {/* セル詳細マップへ */}
          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs">
            <span className="text-slate-500">気象データ取得元: Open-Meteo API</span>
            <button
              onClick={onNavigateToMap}
              className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold flex items-center gap-1"
            >
              全国観測マップを開く <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 観測記録クイックアクション (3大投稿導線) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
            <Mic className="w-5 h-5 text-indigo-600" />
            観測データを記録・研究に協力する
          </h3>
          <span className="text-xs text-slate-500">※個人情報・会話は自動保護されます</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. 10秒音響録音 */}
          <div
            onClick={() => onOpenRecordModal('audio')}
            className="group bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <Mic className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 dark:text-white text-base group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  10秒音響を録音
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  周囲の音を10秒間録音し、YAMNet AIで動物の鳴き声・環境音を自動分類（元音声は即時削除）。
                </p>
                <span className="inline-block text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 pt-1">
                  マイク録音を開始 →
                </span>
              </div>
            </div>
          </div>

          {/* 2. 雲写真を記録 */}
          <div
            onClick={() => onOpenRecordModal('cloud')}
            className="group bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-cyan-500 dark:hover:border-cyan-400 shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <Camera className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 dark:text-white text-base group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                  雲写真を撮影・解析
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  気になった雲の写真をアップロード。EXIFのGPSを除去し、空占有率と気象学的雲形を解析します。
                </p>
                <span className="inline-block text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 pt-1">
                  写真を投稿する →
                </span>
              </div>
            </div>
          </div>

          {/* 3. 市民構造化レポート */}
          <div
            onClick={() => onOpenRecordModal('report')}
            className="group bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-400 shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 dark:text-white text-base group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  市民レポートを投稿
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  「動物が急に静かになった」「地鳴りのような低音」「微小な揺れ」などの違和感を構造化記録。
                </p>
                <span className="inline-block text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 pt-1">
                  レポートを入力 →
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SNS集合知ハイライト & 気象カード & 事後検証バナー */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* SNS集合知ハイライトカード (v2.0 SCR-007導線) */}
        <div className="lg:col-span-12 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-indigo-500" />
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                SNS公開集合知 リアルタイム観測状況（Bluesky / Mastodon / YouTube）
              </h4>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-200 dark:border-indigo-800">
                {selectedCell.name}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              直近6時間の関連投稿: <strong>{selectedCell.socialSummary?.totalPosts ?? 18}件</strong> （独立投稿者推定: 約{selectedCell.socialSummary?.uniqueActorEstimate ?? 14}名 / 品質スコア: {selectedCell.socialSummary?.qualityScore ?? 0.74}）。
              雲・空模様 ({selectedCell.socialSummary?.categories.cloud ?? 6}件) や動物・鳥類 ({selectedCell.socialSummary?.categories.animal ?? 5}件) の言及をAI/ルールベースで安全分類中。
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onNavigateToSocial && (
              <button
                onClick={onNavigateToSocial}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all flex items-center gap-1.5"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>SNS観測詳細を見る</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 現在の気象状況 (Open-Meteo) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
              <CloudRain className="w-4 h-4 text-indigo-500" />
              {selectedCell.name} のリアルタイム気象データ
            </h4>
            <span className="text-xs text-slate-500">更新: {new Date(selectedCell.weather.fetchedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl">
              <span className="text-slate-500 block text-[11px] mb-1">全雲量</span>
              <span className="text-xl font-bold text-slate-900 dark:text-white">{selectedCell.weather.cloudCoverTotal}%</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">上層: {selectedCell.weather.cloudCoverHigh}% / 下層: {selectedCell.weather.cloudCoverLow}%</span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl">
              <span className="text-slate-500 block text-[11px] mb-1">海面気圧 (msl)</span>
              <span className="text-xl font-bold text-slate-900 dark:text-white">{selectedCell.weather.pressureMsl} <span className="text-xs font-normal">hPa</span></span>
              <span className={`text-[10px] block mt-0.5 font-medium ${selectedCell.weather.pressureChange24h && selectedCell.weather.pressureChange24h < 0 ? 'text-amber-500' : 'text-slate-400'}`}>
                24h差: {selectedCell.weather.pressureChange24h ? `${selectedCell.weather.pressureChange24h > 0 ? '+' : ''}${selectedCell.weather.weatherCode} hPa` : '安定'}
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl">
              <span className="text-slate-500 block text-[11px] mb-1">地上風速・風向</span>
              <span className="text-xl font-bold text-slate-900 dark:text-white">{selectedCell.weather.windSpeed} <span className="text-xs font-normal">m/s</span></span>
              <span className="text-[10px] text-slate-400 block mt-0.5">風向角: {selectedCell.weather.windDirection}°</span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl">
              <span className="text-slate-500 block text-[11px] mb-1">気温 / 湿度</span>
              <span className="text-xl font-bold text-slate-900 dark:text-white">{selectedCell.weather.temperature} <span className="text-xs font-normal">℃</span></span>
              <span className="text-[10px] text-slate-400 block mt-0.5">相対湿度: {selectedCell.weather.relativeHumidity}%</span>
            </div>
          </div>
        </div>

        {/* 事後検証研究への導線カード */}
        <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold">
              <Sparkles className="w-4 h-4" />
              <span>研究機能 (Case-Control Analysis)</span>
            </div>
            <h4 className="font-bold text-base sm:text-lg">
              地震発生後の事後検証カタログ
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              能登半島地震や千葉県東方沖などの過去の地震前24hデータと通常対照期間を統計比較。偽陽性事例も含め客観検証結果を公開中。
            </p>
          </div>

          <div className="pt-4 mt-2 border-t border-slate-700/60 flex items-center justify-between">
            <span className="text-xs text-slate-400">仮説検証・偽陽性アーカイブ</span>
            <button
              onClick={onNavigateToEvaluation}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
            >
              事後検証を見る <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 最近の市民観測ストリーム */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-500" />
            <h4 className="font-bold text-slate-900 dark:text-white text-sm">
              地域セルの最新観測フィード (匿名集計)
            </h4>
          </div>
          <span className="text-xs text-slate-500">位置はセル中心へ丸め済</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {recentObservations.map((obs) => (
            <div
              key={obs.id}
              className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 text-xs space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  {obs.type === 'audio' && <Volume2 className="w-3.5 h-3.5 text-indigo-500" />}
                  {obs.type === 'cloud_photo' && <Camera className="w-3.5 h-3.5 text-cyan-500" />}
                  {obs.type === 'citizen_report' && <FileText className="w-3.5 h-3.5 text-emerald-500" />}
                  {obs.type === 'audio' ? '音響観測' : obs.type === 'cloud_photo' ? '雲写真解析' : '市民レポート'}
                </span>
                <span className="text-slate-400 text-[10px]">
                  {new Date(obs.observedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div className="text-slate-800 dark:text-slate-200">
                {obs.type === 'audio' && obs.audioAnalysis && (
                  <div>
                    <span className="font-medium">AI検出音: </span>
                    {obs.audioAnalysis.topLabels.slice(0, 2).map((l) => `${l.displayName} (${Math.round(l.meanScore * 100)}%)`).join(', ')}
                    {obs.userConfirmation && (
                      <span className="block text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                        ✓ 投稿者確認: {obs.userConfirmation.confirmedLabels.join(', ')}
                      </span>
                    )}
                  </div>
                )}

                {obs.type === 'cloud_photo' && obs.cloudAnalysis && (
                  <div>
                    <span className="font-medium">雲形分類: </span>
                    {obs.cloudAnalysis.detectedCloudTypes[0]?.displayName}
                    <span className="block text-[11px] text-slate-500 mt-0.5">
                      空占有率: {Math.round(obs.cloudAnalysis.skyCoverageRatio * 100)}% (EXIF位置除去済)
                    </span>
                  </div>
                )}

                {obs.type === 'citizen_report' && obs.citizenReport && (
                  <div>
                    <span className="font-medium">違和感報告: </span>
                    {obs.citizenReport.description || '動物・環境音の平常時との差'}
                    <span className="block text-[11px] text-slate-500 mt-0.5">
                      普段との差: レベル {obs.citizenReport.differenceFromNormal} / 5
                    </span>
                  </div>
                )}
              </div>

              <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-200/50 dark:border-slate-800">
                <span>{obs.cellName}</span>
                <span className="bg-slate-200/60 dark:bg-slate-800 px-1.5 py-0.5 rounded">匿名集計</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
