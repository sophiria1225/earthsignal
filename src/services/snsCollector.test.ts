import assert from 'node:assert/strict';
import test from 'node:test';
import { SocialDerivedPost } from '../types';
import {
  buildSocialSearchUrl,
  classifyTextByRules,
  deduplicateSocialPosts,
  extractLocationFromText,
  extractBlueskyActorInput,
  generateCellSocialSummary,
  hasSensitiveBlueskyLabel,
  fetchLiveBlueskyPosts,
  mastodonHtmlToText,
  normalizeBlueskyActor,
} from './snsCollector';

test('関連ワードを各SNSの実在検索URLへ安全に変換する', () => {
  const regionalQuery = '東京都 地鳴り';
  assert.equal(
    buildSocialSearchUrl('bluesky', regionalQuery),
    `https://bsky.app/search?q=${encodeURIComponent(regionalQuery)}`
  );
  assert.equal(
    buildSocialSearchUrl('youtube', regionalQuery),
    `https://www.youtube.com/results?search_query=${encodeURIComponent(regionalQuery)}`
  );
  assert.equal(
    buildSocialSearchUrl('mastodon', '地震雲'),
    `https://mstdn.jp/tags/${encodeURIComponent('地震雲')}`
  );
  assert.equal(
    buildSocialSearchUrl('misskey', regionalQuery),
    `https://misskey.io/search?q=${encodeURIComponent(regionalQuery)}`
  );
});

test('Blueskyの公開actor入力を正規化しURLや検索式を拒否する', () => {
  assert.equal(normalizeBlueskyActor(' @Example.Bsky.Social '), 'example.bsky.social');
  assert.equal(normalizeBlueskyActor('https://bsky.app/profile/example.bsky.social'), null);
  assert.equal(normalizeBlueskyActor('地震雲 OR 地鳴り'), null);
  assert.equal(normalizeBlueskyActor('not-a-domain'), null);
  assert.equal(normalizeBlueskyActor('bad..handle.social'), null);
});

test('UIではBluesky公式プロフィールURLからactorだけを安全に取り出す', () => {
  assert.equal(extractBlueskyActorInput('https://bsky.app/profile/example.bsky.social'), 'example.bsky.social');
  assert.equal(extractBlueskyActorInput('https://example.com/profile/example.bsky.social'), null);
  assert.equal(extractBlueskyActorInput('https://bsky.app/profile/example.bsky.social/post/abc'), null);
});

test('Blueskyのセンシティブラベル付き投稿を判定する', () => {
  assert.equal(hasSensitiveBlueskyLabel({ labels: [{ val: 'porn' }] }), true);
  assert.equal(hasSensitiveBlueskyLabel({ labels: [{ val: 'warn' }] }), false);
});

test('Bluesky V2検索は一時的な403を再試行する', async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  let attempts = 0;
  globalThis.fetch = async (input) => {
    requestedUrls.push(String(input));
    attempts += 1;
    if (attempts === 1) return new Response('forbidden', { status: 403 });
    return new Response(JSON.stringify({ posts: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  try {
    const posts = await fetchLiveBlueskyPosts('地震雲', {
      throwOnError: true,
      retryDelayMs: 0,
    });
    assert.deepEqual(posts, []);
    assert.equal(attempts, 2);
    assert.match(requestedUrls[0], /app\.bsky\.feed\.searchPostsV2/);
    assert.match(requestedUrls[0], /query=/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function makePost(overrides: Partial<SocialDerivedPost> = {}): SocialDerivedPost {
  return {
    id: 'post-1',
    source: 'bluesky',
    sourceIdHash: 'source-1',
    actorIdHash: 'actor-1',
    sourceUrl: 'https://example.com/post-1',
    postedAt: new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
    category: 'sound',
    h3Cell: 'cell_tokyo_01',
    placeName: '東京',
    placeConfidence: 0.9,
    informationQuality: 0.8,
    isPostEventReaction: false,
    isDuplicate: false,
    analysisMode: 'rules',
    temporaryExcerpt: '東京で地鳴りが聞こえる',
    ...overrides,
  };
}

test('場所が書かれていない投稿を東京へ誤分類しない', () => {
  assert.deepEqual(extractLocationFromText('大きな地鳴りが聞こえる'), {
    h3Cell: 'cell_unknown',
    confidence: 0.2,
  });
});

test('過去談や否定文を観測投稿から除外する', () => {
  assert.equal(classifyTextByRules('数日前に地震雲を見た').category, 'unrelated');
  assert.equal(classifyTextByRules('地震雲に科学的根拠は無い').category, 'unrelated');
});

test('原因が雷と分かる音や比喩表現を観測投稿から除外する', () => {
  assert.equal(classifyTextByRules('地鳴りみたいな雷が鳴っている').category, 'unrelated');
  assert.equal(classifyTextByRules('ライブ会場が地鳴りのような歓声だった').category, 'unrelated');
  assert.equal(classifyTextByRules('東京で原因不明の地鳴りが続いている').category, 'sound');
});

test('引用記事だけの言及は除外し、本人の現在観測は残す', () => {
  assert.equal(classifyTextByRules('ニュース記事まとめ: 東京で地鳴り').category, 'unrelated');
  assert.equal(classifyTextByRules('ニュースを見たが、今も東京で地鳴りが聞こえる').category, 'sound');
});

test('Mastodon HTMLを安全なプレーンテキストへ変換する', () => {
  assert.equal(mastodonHtmlToText('<p>東京で<br>地鳴り&amp;揺れ</p>'), '東京で 地鳴り&揺れ');
});

test('複数検索語に現れた同一投稿を重複排除する', () => {
  const duplicate = makePost({ id: 'post-2' });
  assert.equal(deduplicateSocialPosts([makePost(), duplicate]).length, 1);
});

test('地域と時間窓に一致するライブ投稿だけを集計する', () => {
  const posts = [
    makePost(),
    makePost({ id: 'post-2', sourceIdHash: 'source-2', h3Cell: 'cell_unknown' }),
    makePost({
      id: 'post-3',
      sourceIdHash: 'source-3',
      postedAt: new Date(Date.now() - 25 * 60 * 60_000).toISOString(),
    }),
  ];
  const summary = generateCellSocialSummary('cell_tokyo_01', posts, '24h');
  assert.equal(summary.totalPosts, 1);
  assert.equal(summary.uniqueActorEstimate, 1);
  assert.equal(summary.sources.bluesky, 1);
  assert.equal(summary.anomalyScore, null);
});
