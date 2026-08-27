/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { GeoCell, Earthquake, Observation, RuntimeDataSourceStatus, SocialDerivedPost } from './types';
import { createRuntimeGeoCells } from './services/dataStore';
import { fetchP2PEarthquakes, fetchOpenMeteoWeather } from './services/externalFeeds';
import { calculateRobustAnomalyScore, filterCurrentObservations } from './services/anomalyEngine';
import { fetchLiveSocialPosts, generateCellSocialSummary } from './services/snsCollector';
import {
  ObservationSnapshot,
  applySocialBaseline,
  createObservationSnapshots,
  deriveSocialBaseline,
  loadObservationHistory,
  mergeObservationSnapshots,
  saveObservationHistory,
} from './services/observationHistory';
import { Header, TabType } from './components/Header';
import { HomeDashboard } from './components/HomeDashboard';
import { JapanCellMap } from './components/JapanCellMap';
import { CellDetailPanel } from './components/CellDetailPanel';
import { AudioRecorderModal } from './components/AudioRecorderModal';
import { CloudPhotoModal } from './components/CloudPhotoModal';
import { CitizenReportModal } from './components/CitizenReportModal';
import { EarthquakeDetailModal } from './components/EarthquakeDetailModal';
import { ResearchInfoView } from './components/ResearchInfoView';
import { SocialObservationView } from './components/SocialObservationView';
import { FreeTierStatusView } from './components/FreeTierStatusView';
import { OnboardingModal } from './components/OnboardingModal';
import { LocalDataManager } from './components/LocalDataManager';
import { loadObservations, saveObservations } from './services/observationStore';

const PostEventVerificationView = React.lazy(() =>
  import('./components/PostEventVerificationView').then(module => ({
    default: module.PostEventVerificationView,
  }))
);

export default function App() {
  const initialCells = React.useMemo(() => createRuntimeGeoCells(), []);
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [cells, setCells] = useState<GeoCell[]>(initialCells);
  const [selectedCell, setSelectedCell] = useState<GeoCell>(initialCells[0]);
  const [earthquakes, setEarthquakes] = useState<Earthquake[]>([]);
  const [socialPosts, setSocialPosts] = useState<SocialDerivedPost[]>([]);
  const [observationHistory, setObservationHistory] = useState<ObservationSnapshot[]>(loadObservationHistory);
  const [observations, setObservations] = useState<Observation[]>(loadObservations);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [sourceStatuses, setSourceStatuses] = useState<RuntimeDataSourceStatus[]>([
    { key: 'earthquake', label: '地震', state: 'loading', isCurrent: false, recordCount: 0, detail: '取得待ち' },
    { key: 'weather', label: '気象', state: 'loading', isCurrent: false, recordCount: 0, detail: '取得待ち' },
    { key: 'social', label: 'SNS', state: 'loading', isCurrent: false, recordCount: 0, detail: '取得待ち' },
  ]);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);

  // モーダル管理
  const [selectedEqForDetail, setSelectedEqForDetail] = useState<Earthquake | null>(null);
  const [selectedCellForDetail, setSelectedCellForDetail] = useState<GeoCell | null>(null);
  const [activeRecordModal, setActiveRecordModal] = useState<'audio' | 'cloud' | 'report' | null>(null);

  // オンボーディング同意チェック
  useEffect(() => {
    let hasAgreed: string | null = null;
    try {
      hasAgreed = localStorage.getItem('earthsignal_onboarded_v2');
    } catch {
      // ストレージ無効時は毎回注意事項を表示する。
    }
    if (!hasAgreed) {
      setShowOnboarding(true);
    }
  }, []);

  const handleCloseOnboarding = () => {
    try {
      localStorage.setItem('earthsignal_onboarded_v2', 'true');
    } catch {
      // プライベートブラウズ等でも同意後の利用自体は継続できる。
    }
    setShowOnboarding(false);
  };

  useEffect(() => {
    if (!saveObservations(observations) && observations.length > 0) {
      setStorageWarning('市民観測をブラウザへ保存できません。ページを閉じる前にJSONバックアップを作成してください。');
    }
  }, [observations]);

  useEffect(() => {
    if (!saveObservationHistory(observationHistory) && observationHistory.length > 0) {
      setStorageWarning('観測履歴をブラウザへ保存できません。ページを閉じる前にJSONバックアップを作成してください。');
    }
  }, [observationHistory]);

  // セル配列更新後も、選択中セルが古いオブジェクトを参照しないよう同期する。
  useEffect(() => {
    const latest = cells.find(cell => cell.id === selectedCell.id);
    if (latest && latest !== selectedCell) setSelectedCell(latest);
    if (selectedCellForDetail) {
      const latestDetail = cells.find(cell => cell.id === selectedCellForDetail.id);
      if (latestDetail && latestDetail !== selectedCellForDetail) setSelectedCellForDetail(latestDetail);
    }
  }, [cells, selectedCell.id, selectedCellForDetail?.id]);

  // データ更新関数
  const refreshData = async () => {
    setIsRefreshing(true);
    setSourceStatuses(current => current.map(source => ({ ...source, state: 'loading', detail: '更新中', error: undefined })));
    try {
      const earthquakePromise = fetchP2PEarthquakes()
        .catch((error: unknown) => ({
          earthquakes: [],
          isLive: false,
          fetchedAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : '地震情報の取得に失敗',
        }));
      const socialPromise = fetchLiveSocialPosts()
        .catch((error: unknown) => ({
          posts: [],
          isLive: false,
          fetchedAt: new Date().toISOString(),
          sources: [],
          error: error instanceof Error ? error.message : 'SNSの取得に失敗',
        }));
      const weatherPromise = Promise.all(cells.map(cell => fetchOpenMeteoWeather(cell.id).catch((error: unknown) => ({
        weather: null,
        isLive: false,
        fetchedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : '気象情報の取得に失敗',
      }))));
      const [earthquakeResult, socialResult, weatherResults] = await Promise.all([
        earthquakePromise,
        socialPromise,
        weatherPromise,
      ]);

      const freshEarthquakes = earthquakeResult.isLive || earthquakeResult.earthquakes.length > 0
        ? earthquakeResult.earthquakes
        : earthquakes;
      const freshSocialPosts = socialResult.isLive || socialResult.posts.length > 0
        ? socialResult.posts
        : socialPosts;
      const scoreEarthquakes = earthquakeResult.isLive ? freshEarthquakes : [];
      const capturedAt = new Date();
      setEarthquakes(freshEarthquakes);
      setSocialPosts(freshSocialPosts);
      const liveWeatherCount = weatherResults.filter(result => result.isLive).length;
      const socialFailures = socialResult.sources.filter(source => !source.ok || source.degraded);
      setSourceStatuses([
        {
          key: 'earthquake',
          label: '地震',
          state: earthquakeResult.isLive ? 'live' : 'degraded',
          isCurrent: earthquakeResult.isLive,
          fetchedAt: earthquakeResult.fetchedAt,
          recordCount: freshEarthquakes.length,
          detail: earthquakeResult.isLive ? `P2P地震情報 ${freshEarthquakes.length}件` : '取得停止中',
          error: earthquakeResult.error,
        },
        {
          key: 'weather',
          label: '気象',
          state: liveWeatherCount === cells.length ? 'live' : 'degraded',
          isCurrent: liveWeatherCount > 0,
          fetchedAt: weatherResults.find(result => result.isLive)?.fetchedAt,
          recordCount: liveWeatherCount,
          detail: `Open-Meteo ${liveWeatherCount}/${cells.length}地域`,
          error: weatherResults.find(result => !result.isLive)?.error,
        },
        {
          key: 'social',
          label: 'SNS',
          state: socialResult.isLive && socialFailures.length === 0 ? 'live' : 'degraded',
          isCurrent: socialResult.isLive,
          fetchedAt: socialResult.fetchedAt,
          recordCount: freshSocialPosts.length,
          detail: socialResult.isLive
            ? `公開投稿 ${freshSocialPosts.length}件${socialFailures.length ? ` / ${socialFailures.map(source => source.source).join('・')}低下` : ''}`
            : '取得停止中',
          error: socialResult.error || socialFailures.map(source => `${source.source}: ${source.error || '取得失敗'}`).join(' / ') || undefined,
        },
      ]);

      const updatedCells = cells.map((cell, index) => {
          const weatherResult = weatherResults[index];
          const weather = weatherResult?.weather
            ? { ...weatherResult.weather, isStale: !weatherResult.isLive }
            : { ...cell.weather, isStale: true };
          const rawSocialSummary = generateCellSocialSummary(cell.id, freshSocialPosts, '6h');
          const socialSummary = socialResult.isLive
            ? applySocialBaseline(
                rawSocialSummary,
                deriveSocialBaseline(cell.id, rawSocialSummary.totalPosts, observationHistory, capturedAt)
              )
            : cell.socialSummary || rawSocialSummary;
          const updated = { ...cell, weather, socialSummary };
          const currentScore = calculateRobustAnomalyScore(
            updated,
            observations.filter(observation => observation.cellId === cell.id),
            scoreEarthquakes,
            socialResult.isLive ? socialSummary.anomalyScore : null
          );
          return {
            ...updated,
            recentObservationsCount: filterCurrentObservations(
              observations.filter(observation => observation.cellId === cell.id),
              capturedAt.getTime()
            ).length,
            currentScore,
          };
      });
      setCells(updatedCells);
      setObservationHistory(current => mergeObservationSnapshots(
        current,
        createObservationSnapshots(updatedCells, capturedAt, { socialLive: socialResult.isLive }),
        capturedAt
      ));
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
    const nextObs = [newObs, ...observations.filter(observation => observation.id !== newObs.id)].slice(0, 200);
    setObservations(nextObs);

    // 該当セルのスコアを再計算
    setCells((prev) =>
      prev.map((c) => {
        if (c.id === newObs.cellId) {
          const cellObs = nextObs.filter((o) => o.cellId === c.id);
          const currentEarthquakes = sourceStatuses.some(source => source.key === 'earthquake' && source.isCurrent)
            ? earthquakes
            : [];
          const currentSocialScore = sourceStatuses.some(source => source.key === 'social' && source.isCurrent)
            ? c.socialSummary?.anomalyScore
            : null;
          const newScore = calculateRobustAnomalyScore(c, cellObs, currentEarthquakes, currentSocialScore);
          return {
            ...c,
            recentObservationsCount: filterCurrentObservations(cellObs).length,
            currentScore: newScore,
          };
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
        feedStatus={sourceStatuses.some(source => source.state === 'loading')
          ? 'loading'
          : sourceStatuses.every(source => source.state === 'live') ? 'live' : 'degraded'}
        isRefreshing={isRefreshing}
        onRefresh={refreshData}
        onOpenPrivacy={() => setShowOnboarding(true)}
        onOpenQuickRecord={(type) => setActiveRecordModal(type || 'audio')}
      />

      {/* メインコンテンツエリア */}
      <main className="flex-1 pb-16">
        <React.Suspense fallback={(
          <div className="max-w-7xl mx-auto px-4 py-12 text-center text-sm text-slate-500">
            画面を読み込んでいます…
          </div>
        )}>
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
            sourceStatuses={sourceStatuses}
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
              posts={socialPosts}
              onPostsChange={(posts, result) => {
                const capturedAt = new Date();
                setSocialPosts(posts);
                const failed = result.sources.filter(source => !source.ok || source.degraded);
                setSourceStatuses(current => current.map(source => source.key === 'social' ? {
                  ...source,
                  state: result.isLive && failed.length === 0 ? 'live' : 'degraded',
                  isCurrent: result.isLive,
                  fetchedAt: result.fetchedAt,
                  recordCount: result.posts.length,
                  detail: result.isLive
                    ? `公開投稿 ${result.posts.length}件${failed.length ? ` / ${failed.map(item => item.source).join('・')}低下` : ''}`
                    : `更新失敗 / 前回表示 ${result.posts.length}件`,
                  error: result.error || failed.map(item => `${item.source}: ${item.error || '取得失敗'}`).join(' / ') || undefined,
                } : source));
                if (!result.isLive) {
                  const currentEarthquakes = sourceStatuses.some(source => source.key === 'earthquake' && source.isCurrent)
                    ? earthquakes
                    : [];
                  setCells(current => current.map(cell => ({
                    ...cell,
                    currentScore: calculateRobustAnomalyScore(
                      cell,
                      observations.filter(observation => observation.cellId === cell.id),
                      currentEarthquakes,
                      null
                    ),
                  })));
                  return;
                }
                const currentEarthquakes = sourceStatuses.some(source => source.key === 'earthquake' && source.isCurrent)
                  ? earthquakes
                  : [];
                const updatedCells = cells.map(cell => {
                    const rawSocialSummary = generateCellSocialSummary(cell.id, posts, '6h');
                    const socialSummary = applySocialBaseline(
                      rawSocialSummary,
                      deriveSocialBaseline(cell.id, rawSocialSummary.totalPosts, observationHistory, capturedAt)
                    );
                    return {
                    ...cell,
                    socialSummary,
                    currentScore: calculateRobustAnomalyScore(
                      { ...cell, socialSummary },
                      observations.filter(observation => observation.cellId === cell.id),
                      currentEarthquakes,
                      socialSummary.anomalyScore
                    ),
                  };
                });
                setCells(updatedCells);
                setObservationHistory(current => mergeObservationSnapshots(
                  current,
                  createObservationSnapshots(updatedCells, capturedAt, { socialLive: result.isLive }),
                  capturedAt
                ));
              }}
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
              <button
                type="button"
                onClick={() => setActiveRecordModal('audio')}
                className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 cursor-pointer shadow-sm space-y-3 transition-all text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold text-lg">
                  🎙️
                </div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">10秒音響録音</h3>
                <p className="text-xs text-slate-500">
                  音量・無音率などを端末内解析し、聞こえた動物音・環境音は利用者が確認。生音声は解析直後に破棄されます。
                </p>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 block pt-2">
                  マイクで録音を開始 →
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveRecordModal('cloud')}
                className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-cyan-500 cursor-pointer shadow-sm space-y-3 transition-all text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center font-bold text-lg">
                  ☁️
                </div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">雲写真の撮影・解析</h3>
                <p className="text-xs text-slate-500">
                  元写真・EXIFは保存せず端末内で空占有率を推定。雲形は利用者が選択します。
                </p>
                <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 block pt-2">
                  写真を投稿する →
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveRecordModal('report')}
                className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-emerald-500 cursor-pointer shadow-sm space-y-3 transition-all text-left"
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
              </button>
            </div>

            <LocalDataManager
              observations={observations}
              history={observationHistory}
              storageWarning={storageWarning}
              onClearObservations={() => setObservations([])}
              onClearHistory={() => setObservationHistory([])}
              onRestore={(restoredObservations, restoredHistory) => {
                setObservations(current => {
                  const merged = new Map<string, Observation>(current.map(observation => [observation.id, observation]));
                  restoredObservations.forEach(observation => merged.set(observation.id, observation));
                  return [...merged.values()]
                    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))
                    .slice(0, 200);
                });
                setObservationHistory(current => mergeObservationSnapshots(current, restoredHistory));
              }}
            />
          </div>
        )}

        {activeTab === 'evaluation' && <PostEventVerificationView />}

        {activeTab === 'status' && (
          <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6">
            <FreeTierStatusView />
          </div>
        )}

        {activeTab === 'research' && <ResearchInfoView />}
        </React.Suspense>
      </main>

      {/* フッター */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-6 text-center text-xs text-slate-500 space-y-2">
        <div className="flex flex-wrap items-center justify-center gap-4">
          <button onClick={() => setActiveTab('home')} className="hover:underline">ホーム</button>
          <button onClick={() => setActiveTab('map')} className="hover:underline">代表地域マップ</button>
          <button onClick={() => setActiveTab('social')} className="hover:underline">SNS集合知</button>
          <button onClick={() => setActiveTab('evaluation')} className="hover:underline">事後検証</button>
          <button onClick={() => setActiveTab('status')} className="hover:underline">データソース接続状態</button>
          <button onClick={() => setActiveTab('research')} className="hover:underline">科学的根拠・仕様</button>
        </div>
        <p>
          EarthSignal: 地震関連情報と身の回りの変化を統合し、平常時との差を確認する観測プラットフォーム
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
          history={observationHistory.filter(snapshot => snapshot.cellId === selectedCellForDetail.id)}
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
