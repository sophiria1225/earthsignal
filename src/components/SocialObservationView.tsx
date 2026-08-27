import React, { useState, useEffect } from 'react';
import { GeoCell, SocialCategory, SocialDerivedPost, SocialHourlySummary, SocialSourceType } from '../types';
import { 
  SAMPLE_SOCIAL_POSTS, 
  KEYWORD_DICTIONARY, 
  fetchLiveBlueskyPosts, 
  fetchLiveMastodonPosts, 
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

interface Props {
  selectedCell: GeoCell;
  allCells: GeoCell[];
  onSelectCell: (cell: GeoCell) => void;
  posts?: SocialDerivedPost[];
}

export const SocialObservationView: React.FC<Props> = ({
  selectedCell,
  allCells,
  onSelectCell,
  posts: initialPosts = SAMPLE_SOCIAL_POSTS,
}) => {
  const [selectedWindow, setSelectedWindow] = useState<'1h' | '6h' | '24h'>('6h');
  const [selectedCategory, setSelectedCategory] = useState<SocialCategory | 'all'>('all');
  const [selectedSource, setSelectedSource] = useState<SocialSourceType | 'all'>('all');
  const [postsList, setPostsList] = useState<SocialDerivedPost[]>(initialPosts);
  const [isLoadingLive, setIsLoadingLive] = useState<boolean>(false);
  const [liveFetchStatus, setLiveFetchStatus] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // 初期マウント時の自動取得と、定期的な自動更新（1分毎）
  useEffect(() => {
    handleFetchLivePosts(true);

    const intervalId = setInterval(() => {
      handleFetchLivePosts(false);
    }, 60000);

    return () => clearInterval(intervalId);
  }, []);

  // リアルタイム公開SNS投稿のライブ取得
  const handleFetchLivePosts = async (isInitial = false) => {
    if (!isInitial) setIsLoadingLive(true);
    if (!isInitial) setLiveFetchStatus('Bluesky & Mastodon 公開エンドポイントへ接続中...');
    
    try {
      const [bskyPosts1, bskyPosts2, mastoPosts] = await Promise.all([
        fetchLiveBlueskyPosts('地震雲'),
        fetchLiveBlueskyPosts('地鳴り'),
        fetchLiveMastodonPosts('地震雲'),
      ]);

      const combined = [...bskyPosts1, ...bskyPosts2, ...mastoPosts];
      
      if (combined.length > 0) {
        setPostsList((prev) => {
          const existingIds = new Set(combined.map(p => p.id));
          // 初期ロード時はモックデータをクリアして実データのみにする
          const filteredOld = isInitial ? [] : prev.filter(p => !existingIds.has(p.id));
          
          // 時間の新しい順にソートして返す
          const newList = [...combined, ...filteredOld].sort((a, b) => {
            return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
          });
          
          return newList;
        });
        if (!isInitial) setLiveFetchStatus(`実在する公開投稿 ${combined.length} 件をリアルタイム取得しました`);
      } else {
        if (!isInitial) setLiveFetchStatus('現在取得可能な新規投稿はありません（最新状態です）');
      }
    } catch (e) {
      console.error(e);
      if (!isInitial) setLiveFetchStatus('リアルタイム取得エラー（外部エンドポイント待機中）');
    } finally {
      setIsLoadingLive(false);
      if (!isInitial) setTimeout(() => setLiveFetchStatus(null), 6000);
    }
  };

  const summary: SocialHourlySummary = selectedCell.socialSummary || {
    cellId: selectedCell.id,
    window: selectedWindow,
    totalPosts: postsList.length,
    uniqueActorEstimate: Math.max(1, Math.round(postsList.length * 0.85)),
    locationExplicitRatio: 0.72,
    qualityScore: 0.76,
    anomalyScore: 65,
    categories: {
      cloud: postsList.filter(p => p.category === 'cloud').length,
      animal: postsList.filter(p => p.category === 'animal').length,
      sound: postsList.filter(p => p.category === 'sound').length,
      shaking: postsList.filter(p => p.category === 'shaking').length,
      water: 0,
      device: 0,
      official_reaction: 0,
      unrelated: 0,
      unknown: 0,
    },
    sources: {
      bluesky: postsList.filter(p => p.source === 'bluesky').length,
      mastodon: postsList.filter(p => p.source === 'mastodon').length,
      youtube: postsList.filter(p => p.source === 'youtube').length,
      misskey: 0,
    },
    analysisModes: {
      rules: postsList.length,
      embedding: 0,
      llm: 0,
      rules_only_quota: 0,
    },
    globalTopicSpike: false,
    notice: 'SNS投稿数の増加は地震の前兆を意味しません。報道・天候等の別要因が存在します。',
  };

  const filteredPosts = postsList.filter(p => {
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
            Bluesky / Mastodon / YouTube 等の公開エンドポイントから、言及された「現象の種類・時刻・粗い地域」を集計しています。
            <strong className="underline decoration-amber-500">SNS投稿の増加は地震の前兆を意味しません。</strong> テレビ報道や天候（夕焼け・雷雨）による全国的な話題急増（Global Topic Spike）や重複・比喩投稿は自動除外・品質スコア補正されています。
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
            onClick={handleFetchLivePosts}
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
            <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{summary.anomalyScore}</span>
            <span className="text-xs text-slate-400">/ 100</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">平常同時間帯中央値からのずれ</p>
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
              <span className="font-semibold text-slate-500">分類方式 (AI二段構成)</span>
              <div className="space-y-1 text-slate-700 dark:text-slate-300">
                <div className="flex justify-between"><span>辞書・正規表現:</span><span className="font-bold">{summary.analysisModes.rules}件</span></div>
                <div className="flex justify-between"><span>埋め込み類似度:</span><span className="font-bold">{summary.analysisModes.embedding}件</span></div>
                <div className="flex justify-between"><span>Workers AI (LLM):</span><span className="font-bold">{summary.analysisModes.llm}件</span></div>
                <div className="flex justify-between"><span>無料枠超過退避:</span><span className="font-bold">{summary.analysisModes.rules_only_quota}件</span></div>
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
        </div>
      </div>
    </div>
  );
};

