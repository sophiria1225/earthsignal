import React, { useState } from 'react';
import { GeoCell, Earthquake } from '../types';
import { Layers, MapPin, Activity, AlertCircle, Info, Sparkles, Filter } from 'lucide-react';

export type MapLayerType = 'overall' | 'social' | 'weather' | 'audio' | 'reports' | 'earthquakes';

interface Props {
  cells: GeoCell[];
  selectedCell: GeoCell;
  onSelectCell: (cell: GeoCell) => void;
  recentEarthquakes: Earthquake[];
  onOpenEarthquakeDetail: (eq: Earthquake) => void;
  onOpenRecordForCell: (cell: GeoCell) => void;
}

export const JapanCellMap: React.FC<Props> = ({
  cells,
  selectedCell,
  onSelectCell,
  recentEarthquakes,
  onOpenEarthquakeDetail,
  onOpenRecordForCell,
}) => {
  const [activeLayer, setActiveLayer] = useState<MapLayerType>('overall');
  const [hoveredCell, setHoveredCell] = useState<GeoCell | null>(null);
  const visibleEarthquakes = recentEarthquakes
    .filter(earthquake => earthquake.latitude >= 24 && earthquake.latitude <= 46
      && earthquake.longitude >= 125 && earthquake.longitude <= 146)
    .slice(0, 20);

  // レイヤー別のセル色決定ロジック
  const getCellColor = (cell: GeoCell) => {
    const score = cell.currentScore;

    let targetVal: number | null = score.overallScore;
    if (activeLayer === 'social') targetVal = score.socialScore;
    if (activeLayer === 'weather') targetVal = score.weatherScore;
    if (activeLayer === 'audio') targetVal = score.animalAudioScore;
    if (activeLayer === 'reports') targetVal = score.citizenReportScore;
    if (activeLayer === 'earthquakes') targetVal = score.earthquakeActivityScore;

    if (targetVal === null || (activeLayer === 'overall' && score.status === 'insufficient')) {
      return {
        fill: '#94a3b8',
        stroke: '#64748b',
        text: 'データ不足',
        value: '―',
      };
    }

    if (targetVal < 30) {
      return { fill: '#3b82f6', stroke: '#1d4ed8', text: '通常範囲', value: targetVal.toFixed(0) }; // blue
    } else if (targetVal < 60) {
      return { fill: '#f59e0b', stroke: '#d97706', text: 'やや珍しい', value: targetVal.toFixed(0) }; // amber
    } else if (targetVal < 80) {
      return { fill: '#f97316', stroke: '#ea580c', text: '珍しい', value: targetVal.toFixed(0) }; // orange
    } else {
      return { fill: '#a855f7', stroke: '#7e22ce', text: '非常に珍しい', value: targetVal.toFixed(0) }; // purple
    }
  };

  return (
    <div id="japan-cell-map-container" className="space-y-4 max-w-7xl mx-auto px-3 sm:px-6 py-6">
      {/* 上部コントロールバー */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            代表8地域の統合観測マップ
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            現在対応している8地域の「観測異常度」を六角形セルで可視化しています。
          </p>
        </div>

        {/* レイヤー切替 */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveLayer('overall')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeLayer === 'overall'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            総合異常度
          </button>
          <button
            onClick={() => setActiveLayer('social')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeLayer === 'social'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            SNS集合知
          </button>
          <button
            onClick={() => setActiveLayer('weather')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeLayer === 'weather'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            雲・気象
          </button>
          <button
            onClick={() => setActiveLayer('audio')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeLayer === 'audio'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            動物音響
          </button>
          <button
            onClick={() => setActiveLayer('reports')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeLayer === 'reports'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            市民レポート
          </button>
          <button
            onClick={() => setActiveLayer('earthquakes')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeLayer === 'earthquakes'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            地震活動度
          </button>
        </div>
      </div>

      {/* マップ本体 & セル概要 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* 地図ビジュアライザー (SVG) */}
        <div className="lg:col-span-8 bg-slate-900 rounded-2xl p-4 border border-slate-800 shadow-inner relative overflow-hidden flex flex-col justify-between min-h-[520px]">
          
          {/* マップ凡例 & 注意 */}
          <div className="absolute top-4 left-4 z-10 bg-slate-900/90 backdrop-blur-md p-3 rounded-xl border border-slate-800 text-xs text-white space-y-2 max-w-xs pointer-events-none">
            <span className="font-semibold block text-[11px] text-slate-300">
              表示レイヤー: {{ overall: '総合観測異常度', social: 'SNS集合知', weather: '雲・気象異常度', audio: '動物音響異常度', reports: '市民レポート異常度', earthquakes: '地震活動度' }[activeLayer]}
            </span>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
                <span>0〜29: 通常範囲</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                <span>30〜59: やや珍しい</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-orange-500" />
                <span>60〜79: 珍しい</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-purple-500" />
                <span>80〜100: 特異観測</span>
              </div>
              <div className="flex items-center gap-1.5 col-span-2">
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-500" />
                <span>灰色: データ不足 (標本数少)</span>
              </div>
            </div>
            <p className="text-[9px] text-slate-400 pt-1 border-t border-slate-800">
              ※色の濃さは「平常時データからの乖離度」であり、危険度や地震確率ではありません。
            </p>
          </div>

          {/* SVG 日本地図と六角形セル */}
          <div className="w-full h-full flex items-center justify-center py-6">
            <svg
              viewBox="0 0 800 700"
              className="w-full max-h-[500px] select-none"
              style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))' }}
            >
              {/* 日本列島のアウトライン背景 */}
              <g fill="#1e293b" stroke="#334155" strokeWidth="1.5" opacity="0.8">
                {/* 北海道 */}
                <path d="M 580,100 L 660,110 L 700,160 L 650,200 L 590,190 L 570,140 Z" />
                {/* 本州 */}
                <path d="M 640,240 L 600,320 L 570,420 L 520,440 L 460,470 L 400,480 L 480,380 L 530,340 L 610,250 Z" />
                {/* 四国 */}
                <path d="M 390,500 L 440,490 L 450,530 L 380,530 Z" />
                {/* 九州 */}
                <path d="M 300,500 L 350,510 L 340,590 L 290,580 L 280,530 Z" />
                {/* 沖縄 */}
                <path d="M 160,610 L 200,615 L 190,630 L 150,625 Z" />
              </g>

              {/* 緯度経度グリッド線 */}
              <g stroke="#334155" strokeDasharray="3,3" strokeWidth="0.5" opacity="0.4">
                <line x1="100" y1="200" x2="750" y2="200" />
                <line x1="100" y1="350" x2="750" y2="350" />
                <line x1="100" y1="500" x2="750" y2="500" />
                <line x1="300" y1="50" x2="300" y2="650" />
                <line x1="500" y1="50" x2="500" y2="650" />
              </g>

              {/* 最近の公式地震震源地マーカー (P2P地震情報) */}
              {visibleEarthquakes.map((eq) => {
                // 簡易座標マッピング (緯度 24-46 -> y 650-80, 経度 125-146 -> x 120-720)
                const px = 120 + ((eq.longitude - 125) / 21) * 600;
                const py = 650 - ((eq.latitude - 24) / 22) * 570;
                const markerMagnitude = eq.magnitude ?? 3;
                const radius = Math.max(6, Math.min(18, (markerMagnitude - 2) * 5));

                return (
                  <g
                    key={eq.id}
                    onClick={() => onOpenEarthquakeDetail(eq)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onOpenEarthquakeDetail(eq);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`${eq.hypocenterName} ${eq.magnitude !== null ? `マグニチュード${eq.magnitude.toFixed(1)}` : '規模不明'}の地震詳細を開く`}
                    className="cursor-pointer group"
                  >
                    <circle
                      cx={px}
                      cy={py}
                      r={radius * 1.6}
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="1.5"
                      opacity="0.6"
                      className="animate-ping"
                    />
                    <circle
                      cx={px}
                      cy={py}
                      r={radius}
                      fill="#ef4444"
                      fillOpacity="0.8"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                    <text
                      x={px}
                      y={py - radius - 3}
                      textAnchor="middle"
                      fill="#fca5a5"
                      fontSize="9"
                      fontWeight="bold"
                    >
                      {eq.magnitude !== null ? `M${eq.magnitude.toFixed(1)}` : 'M?'} {eq.hypocenterName.slice(0, 4)}
                    </text>
                  </g>
                );
              })}

              {/* 代表地域を示す六角形セルポリゴン */}
              {cells.map((cell) => {
                const { x, y } = cell.svgCoordinates;
                const isSelected = selectedCell.id === cell.id;
                const colorInfo = getCellColor(cell);
                const r = isSelected ? 34 : 30; // 六角形の半径

                // 正六角形ポリゴンの頂点座標
                const points = Array.from({ length: 6 }).map((_, i) => {
                  const angle = (Math.PI / 3) * i - Math.PI / 6;
                  return `${x + r * Math.cos(angle)},${y + r * Math.sin(angle)}`;
                }).join(' ');

                return (
                  <g
                    key={cell.id}
                    onClick={() => onSelectCell(cell)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelectCell(cell);
                      }
                    }}
                    onMouseEnter={() => setHoveredCell(cell)}
                    onMouseLeave={() => setHoveredCell(null)}
                    role="button"
                    tabIndex={0}
                    aria-label={`${cell.name}を選択。${colorInfo.text}、異常度${colorInfo.value}`}
                    className="cursor-pointer transition-all duration-200"
                  >
                    {/* 選択中のグローリング */}
                    {isSelected && (
                      <polygon
                        points={points}
                        fill="none"
                        stroke="#6366f1"
                        strokeWidth="5"
                        strokeOpacity="0.8"
                      />
                    )}

                    {/* 六角形本体 */}
                    <polygon
                      points={points}
                      fill={colorInfo.fill}
                      fillOpacity="0.75"
                      stroke={isSelected ? '#ffffff' : colorInfo.stroke}
                      strokeWidth={isSelected ? '2.5' : '1.5'}
                      className="hover:fill-opacity-95 transition-opacity"
                    />

                    {/* スコア・ラベルテキスト */}
                    <text
                      x={x}
                      y={y - 4}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="11"
                      fontWeight="bold"
                    >
                      {colorInfo.value}
                    </text>
                    <text
                      x={x}
                      y={y + 10}
                      textAnchor="middle"
                      fill="#f1f5f9"
                      fontSize="8"
                      opacity="0.9"
                    >
                      {cell.prefecture.slice(0, 3)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* 下部情報バー */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span>● 震源地マーカー: 日本周辺の直近{visibleEarthquakes.length}件（最大20件）</span>
            <span>⬡ 六角形セル: 対応地域 ({cells.length}箇所)</span>
          </div>
        </div>

        {/* 右: 選択セルのクイック詳細・寄与要因 */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold block">
                  {selectedCell.region}エリア
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {selectedCell.name}
                </h3>
                <span className="text-[11px] text-slate-500">
                  緯度: {selectedCell.center.latitude.toFixed(2)}° / 経度: {selectedCell.center.longitude.toFixed(2)}°
                </span>
              </div>

              <div className="text-right">
                <span className="text-2xl font-extrabold text-slate-900 dark:text-white block">
                  {selectedCell.currentScore.overallScore !== null ? selectedCell.currentScore.overallScore : '―'}
                </span>
                <span className="text-[10px] text-slate-500">観測異常度 / 100</span>
              </div>
            </div>

            {/* 主要な平常時からの変化要因 (Contributors) */}
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                統計的差異の主な要因（各指標の実測ベースライン比）
              </span>

              {selectedCell.currentScore.contributors.length > 0 ? (
                <div className="space-y-2">
                  {selectedCell.currentScore.contributors.map((c, i) => (
                    <div key={i} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-xs">
                      <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
                        <span>{c.displayName}</span>
                        <span className="text-amber-600 dark:text-amber-400">{c.changeRate} (z={c.zScore})</span>
                      </div>
                      {c.note && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          {c.note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-slate-50 dark:bg-slate-900 text-center text-xs text-slate-500 rounded-xl">
                  {selectedCell.currentScore.status === 'insufficient' ? '比較できる履歴が不足しています。' : '大きな統計的乖離は検出されていません。'}
                </div>
              )}
            </div>

            {/* 交絡要因・品質 */}
            {selectedCell.currentScore.confounders.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                <span className="font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  考慮された交絡要因 (Confounders):
                </span>
                <ul className="list-disc list-inside text-[11px] space-y-0.5 opacity-90">
                  {selectedCell.currentScore.confounders.map((cf, i) => (
                    <li key={i}>{cf}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* このセルで観測を記録するボタン */}
            <button
              onClick={() => onOpenRecordForCell(selectedCell)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs sm:text-sm py-2.5 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              <MapPin className="w-4 h-4" />
              この地域で10秒録音・観測を記録
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
