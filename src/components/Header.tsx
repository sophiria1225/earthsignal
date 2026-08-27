import React from 'react';
import { Activity, MapPin, Mic, FileText, BarChart3, Database, Shield, RefreshCw, Radio, Sliders } from 'lucide-react';

export type TabType = 'home' | 'map' | 'social' | 'record' | 'evaluation' | 'status' | 'research';

interface Props {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  feedStatus: 'loading' | 'live' | 'degraded';
  isRefreshing: boolean;
  onRefresh: () => void;
  onOpenPrivacy: () => void;
  onOpenQuickRecord: (type?: 'audio' | 'cloud' | 'report') => void;
}

export const Header: React.FC<Props> = ({
  activeTab,
  onSelectTab,
  feedStatus,
  isRefreshing,
  onRefresh,
  onOpenPrivacy,
  onOpenQuickRecord,
}) => {
  return (
    <header id="app-header" className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-2">
          {/* Logo & Brand */}
          <button type="button" className="flex items-center gap-3 text-left" onClick={() => onSelectTab('home')} aria-label="EarthSignal ホームを開く">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">
                  EarthSignal
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  v2.0 集合知版
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
                地震関連情報と身の回りの変化を統合観測
              </p>
            </div>
          </button>

          {/* Navigation Tabs (Desktop) */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-sm">
            <button
              id="nav-tab-home"
              onClick={() => onSelectTab('home')}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'home'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Activity className="w-4 h-4" />
              ホーム
            </button>
            <button
              id="nav-tab-map"
              onClick={() => onSelectTab('map')}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'map'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <MapPin className="w-4 h-4" />
              観測マップ
            </button>
            <button
              id="nav-tab-social"
              onClick={() => onSelectTab('social')}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'social'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Radio className="w-4 h-4" />
              SNS集合知
            </button>
            <button
              id="nav-tab-record"
              onClick={() => onSelectTab('record')}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'record'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Mic className="w-4 h-4" />
              記録
            </button>
            <button
              id="nav-tab-evaluation"
              onClick={() => onSelectTab('evaluation')}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'evaluation'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              事後検証
            </button>
            <button
              id="nav-tab-status"
              onClick={() => onSelectTab('status')}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'status'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sliders className="w-4 h-4" />
              接続状態
            </button>
            <button
              id="nav-tab-research"
              onClick={() => onSelectTab('research')}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'research'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Database className="w-4 h-4" />
              研究
            </button>
          </nav>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {/* Live Feed Status Indicator */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
              <span className={`w-2 h-2 rounded-full ${
                feedStatus === 'live' ? 'bg-emerald-500 animate-pulse' : feedStatus === 'loading' ? 'bg-indigo-500 animate-pulse' : 'bg-amber-500'
              }`} />
              <span>{feedStatus === 'live' ? '全データ連動中' : feedStatus === 'loading' ? 'データ更新中' : '一部データ低下'}</span>
            </div>

            {/* Refresh Button */}
            <button
              id="header-refresh-btn"
              onClick={onRefresh}
              disabled={isRefreshing}
              aria-label={isRefreshing ? 'データを更新中' : 'データを更新'}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="データを更新"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
            </button>

            {/* Quick Record CTA */}
            <button
              id="header-record-cta"
              onClick={() => onOpenQuickRecord()}
              className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-xs sm:text-sm font-medium px-3 sm:px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm shadow-indigo-500/20 active:scale-95 transition-all"
            >
              <Mic className="w-4 h-4" />
              <span className="hidden sm:inline">10秒録音・記録</span>
              <span className="sm:hidden">記録</span>
            </button>

            {/* Privacy & Settings */}
            <button
              id="header-privacy-btn"
              onClick={onOpenPrivacy}
              aria-label="同意設定とプライバシーを開く"
              className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="同意設定・プライバシー"
            >
              <Shield className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Bar (Bottom / Mobile Tabs) */}
      <div className="lg:hidden flex items-center justify-around border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 py-2 px-1 text-[11px] overflow-x-auto">
        <button
          onClick={() => onSelectTab('home')}
          className={`flex flex-col items-center gap-0.5 py-1 px-1.5 rounded shrink-0 ${
            activeTab === 'home' ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-500'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>ホーム</span>
        </button>
        <button
          onClick={() => onSelectTab('map')}
          className={`flex flex-col items-center gap-0.5 py-1 px-1.5 rounded shrink-0 ${
            activeTab === 'map' ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-500'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>マップ</span>
        </button>
        <button
          onClick={() => onSelectTab('social')}
          className={`flex flex-col items-center gap-0.5 py-1 px-1.5 rounded shrink-0 ${
            activeTab === 'social' ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-500'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>SNS</span>
        </button>
        <button
          onClick={() => onSelectTab('record')}
          className={`flex flex-col items-center gap-0.5 py-1 px-1.5 rounded shrink-0 ${
            activeTab === 'record' ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-500'
          }`}
        >
          <Mic className="w-4 h-4" />
          <span>記録</span>
        </button>
        <button
          onClick={() => onSelectTab('evaluation')}
          className={`flex flex-col items-center gap-0.5 py-1 px-1.5 rounded shrink-0 ${
            activeTab === 'evaluation' ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-500'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>検証</span>
        </button>
        <button
          onClick={() => onSelectTab('status')}
          className={`flex flex-col items-center gap-0.5 py-1 px-1.5 rounded shrink-0 ${
            activeTab === 'status' ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-500'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>接続</span>
        </button>
        <button
          onClick={() => onSelectTab('research')}
          className={`flex flex-col items-center gap-0.5 py-1 px-1.5 rounded shrink-0 ${
            activeTab === 'research' ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-500'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>研究</span>
        </button>
      </div>
    </header>
  );
};
