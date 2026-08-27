/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { GeoCell, Earthquake, Observation } from './types';
import { INITIAL_GEO_CELLS, INITIAL_EARTHQUAKES, INITIAL_OBSERVATIONS } from './services/dataStore';
import { fetchP2PEarthquakes, fetchOpenMeteoWeather } from './services/externalFeeds';
import { calculateRobustAnomalyScore } from './services/anomalyEngine';
import { Header, TabType } from './components/Header';
import { HomeDashboard } from './components/HomeDashboard';
import { JapanCellMap } from './components/JapanCellMap';
import { CellDetailPanel } from './components/CellDetailPanel';
import { AudioRecorderModal } from './components/AudioRecorderModal';
import { CloudPhotoModal } from './components/CloudPhotoModal';
import { CitizenReportModal } from './components/CitizenReportModal';
import { EarthquakeDetailModal } from './components/EarthquakeDetailModal';
import { PostEventVerificationView } from './components/PostEventVerificationView';
import { ResearchInfoView } from './components/ResearchInfoView';
import { SocialObservationView } from './components/SocialObservationView';
import { FreeTierStatusView } from './components/FreeTierStatusView';
import { OnboardingModal } from './components/OnboardingModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [cells, setCells] = useState<GeoCell[]>(INITIAL_GEO_CELLS);
  const [selectedCell, setSelectedCell] = useState<GeoCell>(INITIAL_GEO_CELLS[0]);
  const [earthquakes, setEarthquakes] = useState<Earthquake[]>(INITIAL_EARTHQUAKES);
  const [observations, setObservations] = useState<Observation[]>(INITIAL_OBSERVATIONS);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);

  // モーダル管理
  const [selectedEqForDetail, setSelectedEqForDetail] = useState<Earthquake | null>(null);
  const [selectedCellForDetail, setSelectedCellForDetail] = useState<GeoCell | null>(null);
  const [activeRecordModal, setActiveRecordModal] = useState<'audio' | 'cloud' | 'report' | null>(null);

  // オンボーディング同意チェック
  useEffect(() => {
    const hasAgreed = localStorage.getItem('earthsignal_onboarded_v2');
    if (!hasAgreed) {
      setShowOnboarding(true);
    }
  }, []);

  const handleCloseOnboarding = () => {
    localStorage.setItem('earthsignal_onboarded_v2', 'true');
    setShowOnboarding(false);
  };

  // データ更新関数
  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      // 1. 地震情報
      const p2pRes = await fetchP2PEarthquakes();
      if (p2pRes.earthquakes && p2pRes.earthquakes.length > 0) {
        setEarthquakes(p2pRes.earthquakes);
      }

      // 2. 選択セルのリアルタイム気象
      const weather = await fetchOpenMeteoWeather(
        selectedCell.id,
        selectedCell.center.latitude,
        selectedCell.center.longitude
      );
      if (weather) {
        setCells((prev) =>
          prev.map((c) => {
            if (c.id === selectedCell.id) {
              const updated = { ...c, weather };
              const updatedScore = calculateRobustAnomalyScore(
                updated,
                observations.filter((o) => o.cellId === c.id),
                earthquakes
              );
              return { ...updated, currentScore: updatedScore };
            }
            return c;
          })
        );
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  // 初回データ読み込み (外部P2P地震 & 気象データ)
  useEffect(() => {
    refreshData();
  }, []);

  // 選択セルが変更された時の最新状態同期
  const handleSelectCell = (cell: GeoCell) => {
    setSelectedCell(cell);
  };

  // 新規観測投稿のハンドラ
  const handleObservationSubmit = (newObs: Observation) => {
    const nextObs = [newObs, ...observations];
    setObservations(nextObs);

    // 該当セルのスコアを再計算
    setCells((prev) =>
      prev.map((c) => {
        if (c.id === newObs.cellId) {
          const cellObs = nextObs.filter((o) => o.cellId === c.id);
          const newScore = calculateRobustAnomalyScore(c, cellObs, earthquakes);
          const updatedCell = { ...c, currentScore: newScore };
          if (selectedCell.id === c.id) {
            setSelectedCell(updatedCell);
          }
          return updatedCell;
        }
        return c;
      })
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      
      {/* 共通ナビゲーションヘッダー */}
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isLiveFeed={true}
        isRefreshing={isRefreshing}
        onRefresh={refreshData}
        onOpenPrivacy={() => setShowOnboarding(true)}
        onOpenQuickRecord={(type) => setActiveRecordModal(type || 'audio')}
      />

      {/* メインコンテンツエリア */}
      <main className="flex-1 pb-16">
        {activeTab === 'home' && (
          <HomeDashboard
            selectedCell={selectedCell}
            allCells={cells}
            onSelectCell={handleSelectCell}
            recentEarthquakes={earthquakes}
            recentObservations={observations}
            onOpenEarthquakeDetail={(eq) => setSelectedEqForDetail(eq)}
            onOpenRecordModal={(type) => setActiveRecordModal(type || 'audio')}
            onNavigateToMap={() => setActiveTab('map')}
            onNavigateToEvaluation={() => setActiveTab('evaluation')}
            onNavigateToSocial={() => setActiveTab('social')}
            onNavigateToStatus={() => setActiveTab('status')}
            onOpenExplanationModal={(cell) => setSelectedCellForDetail(cell)}
          />
        )}

        {activeTab === 'map' && (
          <JapanCellMap
            cells={cells}
            selectedCell={selectedCell}
            onSelectCell={handleSelectCell}
            recentEarthquakes={earthquakes}
            onOpenEarthquakeDetail={(eq) => setSelectedEqForDetail(eq)}
            onOpenRecordForCell={(cell) => {
              setSelectedCell(cell);
              setActiveRecordModal('audio');
            }}
          />
        )}

        {activeTab === 'social' && (
          <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6">
            <SocialObservationView
              selectedCell={selectedCell}
              allCells={cells}
              onSelectCell={handleSelectCell}
            />
          </div>
        )}

        {activeTab === 'record' && (
          <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-2">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                市民センシング観測センター
              </h2>
              <p className="text-xs text-slate-500">
                現在の観測セル: <strong className="text-indigo-600 dark:text-indigo-400">{selectedCell.name}</strong> （変更はホームまたはマップから可能）
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div
                onClick={() => setActiveRecordModal('audio')}
                className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 cursor-pointer shadow-sm space-y-3 transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold text-lg">
                  🎙️
                </div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">10秒音響録音</h3>
                <p className="text-xs text-slate-500">
                  YAMNet AIで鳥・犬の鳴き声・風速ノイズを自動分類。生音声は解析直後に自動破棄されます。
                </p>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 block pt-2">
                  マイクで録音を開始 →
                </span>
              </div>

              <div
                onClick={() => setActiveRecordModal('cloud')}
                className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-cyan-500 cursor-pointer shadow-sm space-y-3 transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center font-bold text-lg">
                  ☁️
                </div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">雲写真の撮影・解析</h3>
                <p className="text-xs text-slate-500">
                  EXIF位置情報を自動除去。空占有率と気象学的雲形（波状雲・すじ雲等）を解析。
                </p>
                <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 block pt-2">
                  写真を投稿する →
                </span>
              </div>

              <div
                onClick={() => setActiveRecordModal('report')}
                className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-emerald-500 cursor-pointer shadow-sm space-y-3 transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-lg">
                  📝
                </div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">市民レポート</h3>
                <p className="text-xs text-slate-500">
                  「動物の活動」「微弱な揺れ」「地鳴り音」などの違和感を構造化フォームで記録。
                </p>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block pt-2">
                  レポートを入力 →
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'evaluation' && <PostEventVerificationView />}

        {activeTab === 'status' && (
          <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6">
            <FreeTierStatusView />
          </div>
        )}

        {activeTab === 'research' && <ResearchInfoView />}
      </main>

      {/* フッター */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-6 text-center text-xs text-slate-500 space-y-2">
        <div className="flex flex-wrap items-center justify-center gap-4">
          <button onClick={() => setActiveTab('home')} className="hover:underline">ホーム</button>
          <button onClick={() => setActiveTab('map')} className="hover:underline">全国観測マップ</button>
          <button onClick={() => setActiveTab('social')} className="hover:underline">SNS集合知</button>
          <button onClick={() => setActiveTab('evaluation')} className="hover:underline">事後検証</button>
          <button onClick={() => setActiveTab('status')} className="hover:underline">無料枠・キルスイッチ</button>
          <button onClick={() => setActiveTab('research')} className="hover:underline">科学的根拠・仕様</button>
        </div>
        <p>
          EarthSignal: 地震前兆候補の客観的観測・事後検証オープンプラットフォーム (気象庁P2P・Open-Meteo・Bluesky・Mastodon準拠)
        </p>
        <p className="text-[11px] text-slate-400">
          ※本システムは地震予知を行うものではありません。緊急時は気象庁の緊急地震速報および自治体の避難指示に従ってください。
        </p>
      </footer>

      {/* 初回オンボーディングモーダル */}
      <OnboardingModal
        isOpen={showOnboarding}
        onClose={handleCloseOnboarding}
      />

      {/* 各種モーダル */}
      {selectedEqForDetail && (
        <EarthquakeDetailModal
          earthquake={selectedEqForDetail}
          onClose={() => setSelectedEqForDetail(null)}
        />
      )}

      {selectedCellForDetail && (
        <CellDetailPanel
          cell={selectedCellForDetail}
          onClose={() => setSelectedCellForDetail(null)}
          onOpenRecord={(cell) => {
            setSelectedCell(cell);
            setActiveRecordModal('audio');
          }}
        />
      )}

      {activeRecordModal === 'audio' && (
        <AudioRecorderModal
          cell={selectedCell}
          onClose={() => setActiveRecordModal(null)}
          onSubmitObservation={handleObservationSubmit}
        />
      )}

      {activeRecordModal === 'cloud' && (
        <CloudPhotoModal
          cell={selectedCell}
          onClose={() => setActiveRecordModal(null)}
          onSubmitObservation={handleObservationSubmit}
        />
      )}

      {activeRecordModal === 'report' && (
        <CitizenReportModal
          cell={selectedCell}
          onClose={() => setActiveRecordModal(null)}
          onSubmitObservation={handleObservationSubmit}
        />
      )}
    </div>
  );
}

