import React, { useState, useEffect } from 'react';
import { GeoCell, SocialCategory, SocialDerivedPost, SocialFetchResponse, SocialFetchSourceStatus, SocialHourlySummary, SocialSourceType } from '../types';
import { 
  KEYWORD_DICTIONARY, 
  fetchLiveSocialPosts,
  generateCellSocialSummary,
  buildSocialSearchUrl 
} from '../services/snsCollector';
import { 
  Radio, 
  MessageSquare, 
  Sparkles, 
  ExternalLink, 
  Filter, 
  ShieldAlert, 
  CheckCircle2, 
  Layers, 
  BarChart2, 
  Info, 
  RefreshCw,
  Search,
  Hash,
  AlertTriangle,
  Globe,
  Tv,
  Copy,
  Check
} from 'lucide-react';
import { BlueskyPersonalFeed } from './BlueskyPersonalFeed';

interface Props {
  selectedCell: GeoCell;
  allCells: GeoCell[];
  onSelectCell: (cell: GeoCell) => void;
  posts?: SocialDerivedPost[];
  onPostsChange?: (posts: SocialDerivedPost[], response: SocialFetchResponse) => void;
}

export const SocialObservationView: React.FC<Props> = ({
  selectedCell,
  allCells,
  onSelectCell,
  posts: initialPosts = [],
  onPostsChange,
}) => {
  const [selectedWindow, setSelectedWindow] = useState<'1h' | '6h' | '24h'>('6h');
  const [selectedCategory, setSelectedCategory] = useState<SocialCategory | 'all'>('all');
  const [selectedSource, setSelectedSource] = useState<SocialSourceType | 'all'>('all');
  const [postsList, setPostsList] = useState<SocialDerivedPost[]>(initialPosts);
  const [isLoadingLive, setIsLoadingLive] = useState<boolean>(false);
  const [liveFetchStatus, setLiveFetchStatus] = useState<string | null>(null);
  const [sourceStatuses, setSourceStatuses] = useState<SocialFetchSourceStatus[]>([]);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  useEffect(() => {
    setPostsList(initialPosts);
  }, [initialPosts]);

  // 初期マウント時の自動取得と、サーバーキャッシュ周期に合わせた定期更新（5分毎）
  useEffect(() => {
    handleFetchLivePosts(true);

    const intervalId = setInterval(() => {
      handleFetchLivePosts(false);
    }, 5 * 60_000);

    return () => clearInterval(intervalId);
  }, []);

  // リアルタイム公開SNS投稿のライブ取得
  const handleFetchLivePosts = async (isInitial = false) => {
    setIsLoadingLive(true);
    if (!isInitial) setLiveFetchStatus('サーバー経由で Bluesky / Mastodon 公開APIへ接続中...');
    
    try {
      const result = await fetchLiveSocialPosts();
      setPostsList(result.posts);
      onPostsChange?.(result.posts, result);
      setSourceStatuses(result.sources);

      if (!isInitial) {
        const failed = result.sources.filter(source => !source.ok).map(source => source.source);
        const degraded = result.sources.filter(source => source.degraded).map(source => source.source);
        const issueParts = [
          failed.length > 0 ? `${failed.join(', ')} は取得失敗` : '',
          degraded.length > 0 ? `${degraded.join(', ')} は一部検索失敗` : '',
        ].filter(Boolean);
        const suffix = issueParts.length > 0 ? `（${issueParts.join(' / ')}）` : '';
        setLiveFetchStatus(
          result.posts.length > 0
            ? `実在する公開投稿 ${result.posts.length} 件を取得しました${suffix}`
            : `関連する公開投稿は見つかりませんでした${suffix}`
        );
      }
    } catch (e: unknown) {
      console.error(e);
      const message = e instanceof Error ? e.message : '不明なエラー';
      setLiveFetchStatus(`リアルタイム取得エラー: ${message}`);
    } finally {
      setIsLoadingLive(false);
      if (!isInitial) setTimeout(() => setLiveFetchStatus(null), 6000);
    }
  };

  const rawSummary: SocialHourlySummary = generateCellSocialSummary(
    selectedCell.id,
    postsList,
    selectedWindow
  );
  const summary: SocialHourlySummary = selectedWindow === '6h' && selectedCell.socialSummary
    ? {
        ...rawSummary,
        anomalyScore: selectedCell.socialSummary.anomalyScore,
        notice: selectedCell.socialSummary.notice,
      }
    : rawSummary;

  const filteredPosts = postsList.filter(p => {
    const windowHours = selectedWindow === '1h' ? 1 : selectedWindow === '6h' ? 6 : 24;
    if (new Date(p.postedAt).getTime() < Date.now() - windowHours * 60 * 60_000) return false;
    // 地域不明投稿は地域集計には入れないが、全国参考レコードとして確認可能にする。
    if (p.h3Cell !== selectedCell.id && p.h3Cell !== 'cell_unknown') return false;
    if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
    if (selectedSource !== 'all' && p.source !== selectedSource) return false;
    return true;
  });

  const categoryLabels: Record<SocialCategory, { label: string; color: string; desc: string }> = {
    cloud: { label: '雲・空の様子', color: 'bg-sky-500 text-sky-700 dark:text-sky-300', desc: '変な雲、筋状の雲、発光現象など' },
    animal: { label: '動物・野鳥', color: 'bg-emerald-500 text-emerald-700 dark:text-emerald-300', desc: '犬の遠吠え、鳥の群れ騒ぎ、魚など' },
    sound: { label: '地鳴り・低周波音', color: 'bg-amber-500 text-amber-700 dark:text-amber-300', desc: '低い音、窓の振動、ゴーという音' },
    shaking: { label: '微振動・体感', color: 'bg-purple-500 text-purple-700 dark:text-purple-300', desc: '揺れた気がする、微弱な振動' },
    water: { label: '水・井戸・温泉', color: 'bg-cyan-500 text-cyan-700 dark:text-cyan-300', desc: '水位、濁り、潮位の言及' },
    device: { label: '電子機器・磁気', color: 'bg-indigo-500 text-indigo-700 dark:text-indigo-300', desc: '電波の異常、コンパスの乱れ' },
    official_reaction: { label: '公的ニュース反応', color: 'bg-slate-500 text-slate-700 dark:text-slate-300', desc: '気象庁速報への言及（前兆除外）' },
    unrelated: { label: '比喩・過去談・除外', color: 'bg-rose-500 text-rose-700 dark:text-rose-300', desc: '比喩表現、過去の思い出' },
    unknown: { label: 'その他・文脈不足', color: 'bg-gray-500 text-gray-700 dark:text-gray-300', desc: '情報不足による保留' },
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  return (
    <div id="social-observation-view" className="space-y-6">
      {/* 科学的注意バナー */}
      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
          <p className="font-semibold text-sm">SNS集合知レイヤーの観測方針（要件定義書 v2.0 第7章・第16章）</p>
          <p>
            Bluesky / Mastodon の公開エンドポイントから、言及された「現象の種類・時刻・粗い地域」を集計しています。YouTubeは自動収集せず、検索リンクだけを提供します。
            <strong className="underline decoration-amber-500">SNS投稿の増加は地震の前兆を意味しません。</strong> 重複、否定文、過去談、公式発表への反応はルールで区別します。全国的な話題急増の自動補正とSNS異常度は、長期履歴が整うまで採点しません。
          </p>
        </div>
      </div>

      {/* 各プラットフォーム公式リアルタイム検索 ショートカットバー */}
      <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-sky-50 dark:from-slate-800/80 dark:via-slate-800/60 dark:to-slate-800/80 rounded-2xl p-4 border border-indigo-100 dark:border-slate-700 space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              各SNSプラットフォーム 実在検索・ライブフィード直リンク
            </span>
          </div>
          <span className="text-[11px] text-slate-500">※新しいタブで安全に開きます</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <a
            href="https://bsky.app/search?q=%E5%9C%B0%E9%9C%87%E9%9B%B2"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 flex items-center justify-between transition-all group"
          >
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200 block group-hover:text-indigo-600">Bluesky</span>
              <span className="text-[10px] text-slate-400">#地震雲 検索</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600" />
          </a>

          <a
            href="https://mstdn.jp/tags/%E5%9C%B0%E9%9C%87%E9%9B%B2"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 flex items-center justify-between transition-all group"
          >
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200 block group-hover:text-indigo-600">Mastodon</span>
              <span className="text-[10px] text-slate-400">#地震雲 タグ</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600" />
          </a>

          <a
            href="https://www.youtube.com/results?search_query=%E5%9C%B0%E9%9C%87+%E9%9B%B2+%E5%89%8D%E5%85%86"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 flex items-center justify-between transition-all group"
          >
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200 block group-hover:text-indigo-600">YouTube</span>
              <span className="text-[10px] text-slate-400">地震・雲 検索</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600" />
          </a>

          <a
            href="https://bsky.app/search?q=%E5%9C%B0%E9%B3%B4%E3%82%8A"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 flex items-center justify-between transition-all group"
          >
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200 block group-hover:text-indigo-600">Bluesky</span>
              <span className="text-[10px] text-slate-400">地鳴り 検索</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600" />
          </a>
        </div>
      </div>

      <BlueskyPersonalFeed />

      {/* コントロールバー */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* 地域セレクター */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500">集計対象地域:</span>
          <select
            id="social-cell-selector"
            value={selectedCell.id}
            onChange={(e) => {
              const target = allCells.find(c => c.id === e.target.value);
              if (target) onSelectCell(target);
            }}
            className="text-xs font-semibold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
          >
            {allCells.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.prefecture})
              </option>
            ))}
          </select>
        </div>

        {/* リアルタイムAPI更新 & 集計時間窓 */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            id="btn-fetch-live-social"
            onClick={() => handleFetchLivePosts(false)}
            disabled={isLoadingLive}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLive ? 'animate-spin' : ''}`} />
            <span>{isLoadingLive ? '公開API取得中...' : '📡 リアルタイム最新SNS取得'}</span>
          </button>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            {(['1h', '6h', '24h'] as const).map(w => (
              <button
                key={w}
                onClick={() => setSelectedWindow(w)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  selectedWindow === w
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                直近{w}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ライブフェッチステータス通知 */}
      {liveFetchStatus && (
        <div className="bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 px-4 py-2.5 rounded-xl text-xs flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            {liveFetchStatus}
          </span>
          <button onClick={() => setLiveFetchStatus(null)} className="text-indigo-400 hover:text-indigo-600">✕</button>
        </div>
      )}

      {sourceStatuses.length > 0 && (
        <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
          {sourceStatuses.map(status => (
            <span
              key={status.source}
              title={status.error}
              className={`px-2.5 py-1 rounded-full border ${
                status.ok && !status.degraded
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
                  : status.ok
                    ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300'
                  : 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300'
              }`}
            >
              {status.source}: {status.ok ? `${status.degraded ? '一部取得' : '接続済み'} (${status.fetched}件)` : '取得失敗'}
            </span>
          ))}
        </div>
      )}

      {/* サマリーダッシュボード */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs text-slate-500 font-medium">関連言及 総数</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">{summary.totalPosts}</span>
            <span className="text-xs text-slate-400">件 / {selectedWindow}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">独立投稿者推定: 約{summary.uniqueActorEstimate}名</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs text-slate-500 font-medium">地域明示率 (Location Rate)</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">{Math.round(summary.locationExplicitRatio * 100)}%</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">市区町村名・駅名が明示された投稿</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs text-slate-500 font-medium">情報品質スコア (Quality)</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{summary.qualityScore}</span>
            <span className="text-xs text-slate-400">/ 1.0</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">時刻・具体性・事前性による加減点</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs text-slate-500 font-medium">SNS観測異常度</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{summary.anomalyScore ?? '―'}</span>
            <span className="text-xs text-slate-400">/ 100</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {summary.anomalyScore === null ? '地域別履歴を蓄積中' : '平常同時間帯中央値からのずれ'}
          </p>
        </div>
      </div>

      {/* カテゴリ別内訳チャート & データソース内訳 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 現象カテゴリ内訳 */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-500" />
              現象カテゴリ別集計
            </h3>
            <span className="text-[11px] text-slate-400">否定文・公式ニュース除外済</span>
          </div>

          <div className="space-y-3">
            {(['cloud', 'animal', 'sound', 'shaking', 'water', 'device'] as SocialCategory[]).map(catKey => {
              const count = summary.categories[catKey] || 0;
              const meta = categoryLabels[catKey];
              const percent = summary.totalPosts > 0 ? (count / summary.totalPosts) * 100 : 0;

              return (
                <div key={catKey} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{meta.label}</span>
                    <span className="text-slate-500 font-mono">{count}件 ({Math.round(percent)}%)</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${meta.color.split(' ')[0]}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 取得プラットフォーム & 解析方式内訳 */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-500" />
            データソース & 構造化パイプライン
          </h3>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/60 dark:border-slate-700/60 space-y-1.5">
              <span className="font-semibold text-slate-500">プラットフォーム別</span>
              <div className="space-y-1 text-slate-700 dark:text-slate-300">
                <div className="flex justify-between"><span>Bluesky:</span><span className="font-bold">{summary.sources.bluesky}件</span></div>
                <div className="flex justify-between"><span>Mastodon:</span><span className="font-bold">{summary.sources.mastodon}件</span></div>
                <div className="flex justify-between"><span>YouTube:</span><span className="font-bold">{summary.sources.youtube}件</span></div>
                <div className="flex justify-between"><span>Misskey:</span><span className="font-bold">{summary.sources.misskey}件</span></div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/60 dark:border-slate-700/60 space-y-1.5">
              <span className="font-semibold text-slate-500">現在の分類方式</span>
              <div className="space-y-1 text-slate-700 dark:text-slate-300">
                <div className="flex justify-between"><span>辞書・正規表現:</span><span className="font-bold">{summary.analysisModes.rules}件</span></div>
                <div className="flex justify-between"><span>AI分類:</span><span className="font-bold">未使用</span></div>
                <p className="text-[10px] text-slate-400 pt-1">分類理由を再現できるルール方式のみを使用中</p>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-[11px] text-slate-500 space-y-1">
            <p className="font-semibold text-slate-700 dark:text-slate-300">プライバシー & 規約遵守ルール（第7.5章）:</p>
            <p>※投稿者の実名・プロフィール・本文の永久保存は行わず、24時間以内にハッシュ・派生統計値へ変換しています。</p>
          </div>
        </div>
      </div>

      {/* 投稿例と元リンク確認 (7.5節 / 16.14節) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-500" />
              構造化観測レコード（実在元リンク・検索URL連動）
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">※各SNSの公開ポストまたは関連キーワード検索画面を直接新しいタブで開くことができます</p>
            <p className="text-[11px] text-slate-400 mt-0.5">地域名のない投稿は地域別件数に加算せず、全国参考として一覧にのみ表示します</p>
          </div>

          {/* フィルター */}
          <div className="flex items-center gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as any)}
              className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200"
            >
              <option value="all">すべてのカテゴリ</option>
              <option value="cloud">雲・空</option>
              <option value="animal">動物・野鳥</option>
              <option value="sound">地鳴り・音</option>
              <option value="shaking">微振動</option>
            </select>
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {filteredPosts.map(post => {
            const meta = categoryLabels[post.category] || categoryLabels.unknown;
            const targetUrl = post.sourceUrl;

            return (
              <div key={post.id} className="py-3.5 flex flex-col sm:flex-row items-start justify-between gap-3">
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.color}`}>
                      {meta.label}
                    </span>
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                      {post.source}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(post.postedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {post.placeName && (
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                        📍 {post.placeName} (確度: {Math.round(post.placeConfidence * 100)}%)
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-mono">
                    {post.temporaryExcerpt || `${post.subject || ''}に関する言及報告`}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400">
                    <span>情報品質: <strong className="text-slate-600 dark:text-slate-300">{post.informationQuality}</strong></span>
                    <span>分類モード: <span className="font-mono">{post.analysisMode}</span></span>
                    {post.isDuplicate && <span className="text-amber-500 font-medium">※重複クラスタ除外済</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleCopyLink(targetUrl)}
                    title="URLをコピー"
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 text-xs transition-all"
                  >
                    {copiedUrl === targetUrl ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>

                  <a
                    href={targetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/50 px-3 py-1.5 rounded-xl border border-indigo-200/60 dark:border-indigo-800/60 transition-all hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                  >
                    <span>{post.source === 'youtube' ? '元動画を開く' : '元投稿を開く'}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            );
          })}
          {!isLoadingLive && filteredPosts.length === 0 && (
            <div className="py-10 text-center text-xs text-slate-500">
              選択した地域・時間帯に、場所を明示した関連投稿はありません。
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
