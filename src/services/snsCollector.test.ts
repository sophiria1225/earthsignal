import assert from 'node:assert/strict';
import test from 'node:test';
import { SocialDerivedPost } from '../types';
import {
  classifyTextByRules,
  deduplicateSocialPosts,
  extractLocationFromText,
  generateCellSocialSummary,
  mastodonHtmlToText,
} from './snsCollector';

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
});
