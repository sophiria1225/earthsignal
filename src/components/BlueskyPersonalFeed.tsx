import React, { FormEvent, useState } from 'react';
import { AlertCircle, AtSign, ExternalLink, Loader2, Search, ShieldCheck, UserRound } from 'lucide-react';
import { BlueskyPublicProfileResponse, SocialCategory } from '../types';
import { normalizeBlueskyActor } from '../services/snsCollector';

const CATEGORY_LABELS: Record<SocialCategory, string> = {
  cloud: '雲・空',
  animal: '動物',
  sound: '地鳴り・音',
  shaking: '揺れ・振動',
  water: '水・井戸',
  device: '機器・磁気',
  official_reaction: '公式情報への反応',
  unrelated: '対象外',
  unknown: '分類保留',
};

export const BlueskyPersonalFeed: React.FC = () => {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<BlueskyPublicProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const actor = normalizeBlueskyActor(input);
    if (!actor) {
      setError('例: example.bsky.social の形式で入力してください。');
      setResult(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/social/bluesky/profile/${encodeURIComponent(actor)}`, {
        headers: { Accept: 'application/json' },
      });
      const payload = await response.json().catch(() => ({})) as Partial<BlueskyPublicProfileResponse> & { error?: string };
      if (!response.ok || !payload.profile || !Array.isArray(payload.relevantPosts)) {
        throw new Error(payload.error || `Bluesky APIから取得できませんでした (${response.status})`);
      }
      setResult(payload as BlueskyPublicProfileResponse);
    } catch (fetchError) {
      setResult(null);
      setError(fetchError instanceof Error ? fetchError.message : '公開投稿を取得できませんでした。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden" aria-labelledby="bluesky-personal-title">
      <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-sky-50 to-indigo-50 dark:from-sky-950/30 dark:to-indigo-950/30">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-500 text-white flex items-center justify-center shrink-0">
            <UserRound className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="bluesky-personal-title" className="font-bold text-slate-900 dark:text-white">自分のBluesky公開投稿を確認</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              ハンドルから直近100件（最大30日）を取得し、地震に関連して観測対象になりうる投稿だけを分類します。ログインやApp Passwordは不要です。
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col sm:flex-row gap-2">
          <label className="sr-only" htmlFor="bluesky-handle">Blueskyハンドル</label>
          <div className="relative flex-1">
            <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
            <input
              id="bluesky-handle"
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="example.bsky.social"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={253}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {isLoading ? '公開投稿を取得中' : '自分の投稿を取得'}
          </button>
        </form>
        <p className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          入力値・投稿本文は端末履歴に保存しません。サーバーキャッシュは5分で失効します。
        </p>
      </div>

      {error && (
        <div role="alert" className="m-5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-sm text-rose-700 dark:text-rose-300 flex gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {result.profile.avatar ? (
                <img
                  src={result.profile.avatar}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="w-11 h-11 rounded-full object-cover bg-slate-100 dark:bg-slate-800"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><UserRound className="w-5 h-5 text-slate-400" /></div>
              )}
              <div className="min-w-0">
                <strong className="text-sm text-slate-900 dark:text-white block truncate">{result.profile.displayName}</strong>
                <span className="text-xs text-slate-500 block truncate">@{result.profile.handle}</span>
              </div>
            </div>
            <div className="text-[11px] text-slate-500 flex gap-3">
              <span>投稿 {result.profile.postsCount.toLocaleString('ja-JP')}</span>
              <span>フォロワー {result.profile.followersCount.toLocaleString('ja-JP')}</span>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-3">
            <p className="text-xs text-slate-700 dark:text-slate-300">
              走査 {result.scannedCount}件中、観測キーワードに該当した公開投稿 <strong>{result.relevantPosts.length}件</strong>
            </p>
            <p className="text-[11px] text-slate-500 mt-1">0件はAPI失敗ではなく、対象期間の公開投稿に現在の観測分類が一致しなかったことを表します。</p>
          </div>

          {result.relevantPosts.length > 0 ? (
            <ul className="space-y-2">
              {result.relevantPosts.map((post) => (
                <li key={post.uri} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300">{CATEGORY_LABELS[post.category]}</span>
                    <time className="text-[11px] text-slate-400" dateTime={post.postedAt}>{new Date(post.postedAt).toLocaleString('ja-JP')}</time>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">{post.excerpt}</p>
                  <a href={post.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-sky-600 dark:text-sky-400 font-semibold mt-2 inline-flex items-center gap-1">
                    Blueskyで原文を見る <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500 text-center py-3">関連する自分の公開投稿は見つかりませんでした。</p>
          )}
          <p className="text-[11px] text-slate-400">{result.notice}</p>
        </div>
      )}
    </section>
  );
};
