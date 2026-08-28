import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createHash } from 'crypto';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import {
  classifyTextByRules,
  deduplicateSocialPosts,
  fetchLiveBlueskyPosts,
  fetchLiveMastodonPosts,
  hasSensitiveBlueskyLabel,
  normalizeBlueskyActor,
  normalizeSocialText,
} from './src/services/snsCollector';
import { BlueskyPublicProfileResponse, SocialDerivedPost, SocialFetchResponse, SocialSourceType } from './src/types';
import {
  EarthquakeFeedResult,
  WeatherFeedResult,
  fetchOpenMeteoWeatherFromSource,
  fetchP2PEarthquakesFromSource,
} from './src/services/externalFeeds';
import { INITIAL_GEO_CELLS } from './src/services/dataStore';

// SNS検索APIへの過剰アクセスを避ける。24時間窓の集計用途なので5分で十分に新鮮。
const SOCIAL_CACHE_TTL_MS = 5 * 60_000;
const SOCIAL_REQUEST_TIMEOUT_MS = 8_000;
const GEMINI_MODEL = 'gemini-3.7-flash';

let socialCache: { expiresAt: number; response: SocialFetchResponse } | null = null;
let socialRequestQueue: Promise<void> = Promise.resolve();
let earthquakeCache: { expiresAt: number; response: EarthquakeFeedResult } | null = null;
const weatherCache = new Map<string, { expiresAt: number; response: WeatherFeedResult }>();
let earthquakeInFlight: Promise<EarthquakeFeedResult> | null = null;
const weatherInFlight = new Map<string, Promise<WeatherFeedResult>>();
let blueskySession: { accessJwt: string; expiresAt: number } | null = null;
let blueskyAuthFailureUntil = 0;
const blueskyProfileCache = new Map<string, { expiresAt: number; response: BlueskyPublicProfileResponse }>();

class UpstreamHttpError extends Error {
  constructor(public status: number, service: string) {
    super(`${service} returned ${status}`);
  }
}

async function fetchBlueskyPublicJson(url: URL): Promise<any> {
  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'EarthSignal/1.0 (public-earth-observation-research)',
      },
      signal: AbortSignal.timeout(SOCIAL_REQUEST_TIMEOUT_MS),
    });
    if (response.ok) return response.json();
    lastStatus = response.status;
    if (![403, 429].includes(response.status) && response.status < 500) break;
    if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
  }
  if (lastStatus) throw new UpstreamHttpError(lastStatus, 'Bluesky public API');
  throw new Error('Bluesky public API did not respond');
}

async function getBlueskyAccessToken(signal?: AbortSignal): Promise<string | null> {
  const identifier = process.env.BLUESKY_IDENTIFIER?.trim();
  const appPassword = process.env.BLUESKY_APP_PASSWORD?.trim();
  if (!identifier || !appPassword) return null;
  if (blueskySession && blueskySession.expiresAt > Date.now()) return blueskySession.accessJwt;
  if (blueskyAuthFailureUntil > Date.now()) return null;

  try {
    const response = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'EarthSignal/1.0 (public-earth-observation-research)',
      },
      body: JSON.stringify({ identifier, password: appPassword }),
      signal: signal || AbortSignal.timeout(SOCIAL_REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Bluesky authentication returned ${response.status}`);
    const session = await response.json() as { accessJwt?: string };
    if (!session.accessJwt) throw new Error('Bluesky authentication response did not include an access token');
    blueskySession = {
      accessJwt: session.accessJwt,
      // Access JWTの実期限より十分短く更新し、期限切れリクエストを避ける。
      expiresAt: Date.now() + 45 * 60_000,
    };
    blueskyAuthFailureUntil = 0;
    return session.accessJwt;
  } catch (error) {
    blueskySession = null;
    blueskyAuthFailureUntil = Date.now() + 5 * 60_000;
    console.warn('Bluesky authentication unavailable; falling back to public search:', error instanceof Error ? error.message : error);
    return null;
  }
}

function hashSocialIdentifier(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function protectSocialIdentifiers(post: SocialDerivedPost): SocialDerivedPost {
  return {
    ...post,
    id: `${post.source}_${hashSocialIdentifier(post.sourceIdHash).slice(0, 20)}`,
    sourceIdHash: hashSocialIdentifier(`${post.source}:${post.sourceIdHash}`),
    actorIdHash: post.actorIdHash
      ? hashSocialIdentifier(`${post.source}:actor:${post.actorIdHash}`)
      : undefined,
  };
}

async function startServer() {
  const app = express();
  const requestedPort = Number.parseInt(process.env.PORT || '3000', 10);
  const PORT = Number.isFinite(requestedPort) && requestedPort > 0 && requestedPort <= 65535
    ? requestedPort
    : 3000;

  app.disable('x-powered-by');
  if (process.env.K_SERVICE || process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);
  app.use(express.json({ limit: '64kb' }));
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Content-Security-Policy', [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https://cdn.bsky.app",
        "connect-src 'self'",
        "media-src 'self' blob:",
        "font-src 'self' data:",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
      ].join('; '));
    }
    next();
  });

  const aiRateLimits = new Map<string, { count: number; resetsAt: number }>();
  app.use('/api/ai', (req, res, next) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    if (aiRateLimits.size > 1_000) {
      for (const [storedKey, value] of aiRateLimits) {
        if (value.resetsAt <= now) aiRateLimits.delete(storedKey);
      }
    }
    const current = aiRateLimits.get(key);
    const state = !current || current.resetsAt <= now
      ? { count: 0, resetsAt: now + 60_000 }
      : current;
    state.count += 1;
    aiRateLimits.set(key, state);
    res.setHeader('X-RateLimit-Limit', '10');
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, 10 - state.count)));
    if (state.count > 10) return res.status(429).json({ error: 'AI解説のリクエスト回数が上限に達しました' });
    next();
  });

  // Gemini client (Lazy initialization safe)
  let aiClient: GoogleGenAI | null = null;
  function getGeminiClient(): GoogleGenAI {
    if (!aiClient) {
      aiClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          timeout: 15_000,
          headers: {
            'User-Agent': 'EarthSignal/1.0',
          },
        },
      });
    }
    return aiClient;
  }

  // 1. Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'EarthSignal Server',
      timestamp: new Date().toISOString(),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  // External observations are proxied and cached server-side. Coordinates are
  // resolved from the fixed cell catalog instead of accepting arbitrary URLs/latlng.
  app.get('/api/data/earthquakes', async (req, res) => {
    const requestedLimit = Number.parseInt(String(req.query.limit || '100'), 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(1, requestedLimit)) : 100;
    const sendLimited = (response: EarthquakeFeedResult) => res.json({
      ...response,
      earthquakes: response.earthquakes.slice(0, limit),
    });
    if (earthquakeCache && earthquakeCache.expiresAt > Date.now()) {
      res.setHeader('X-EarthSignal-Cache', 'HIT');
      return sendLimited(earthquakeCache.response);
    }
    if (!earthquakeInFlight) {
      earthquakeInFlight = fetchP2PEarthquakesFromSource(100, AbortSignal.timeout(8_000))
        .finally(() => { earthquakeInFlight = null; });
    }
    const result = await earthquakeInFlight;
    if (result.isLive) {
      earthquakeCache = { expiresAt: Date.now() + 60_000, response: result };
      res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
      return sendLimited(result);
    }
    if (earthquakeCache) {
      res.setHeader('X-EarthSignal-Cache', 'STALE');
      return sendLimited({ ...earthquakeCache.response, isLive: false, error: result.error });
    }
    return sendLimited(result);
  });

  app.get('/api/data/weather/:cellId', async (req, res) => {
    const cell = INITIAL_GEO_CELLS.find(candidate => candidate.id === req.params.cellId);
    if (!cell) return res.status(404).json({ error: 'Unknown observation cell' });

    const cached = weatherCache.get(cell.id);
    if (cached && cached.expiresAt > Date.now()) {
      res.setHeader('X-EarthSignal-Cache', 'HIT');
      return res.json(cached.response);
    }
    if (!weatherInFlight.has(cell.id)) {
      weatherInFlight.set(cell.id, fetchOpenMeteoWeatherFromSource(
        cell.id,
        cell.center.latitude,
        cell.center.longitude,
        AbortSignal.timeout(12_000)
      ).finally(() => { weatherInFlight.delete(cell.id); }));
    }
    const result = await weatherInFlight.get(cell.id)!;
    if (result.isLive) {
      weatherCache.set(cell.id, { expiresAt: Date.now() + 10 * 60_000, response: result });
      res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=900');
      return res.json(result);
    }
    if (cached) {
      res.setHeader('X-EarthSignal-Cache', 'STALE');
      return res.json({ ...cached.response, isLive: false, error: result.error });
    }
    return res.json(result);
  });

  const blueskyProfileRateLimits = new Map<string, { count: number; resetsAt: number }>();
  app.get('/api/social/bluesky/profile/:handle', async (req, res) => {
    const handle = normalizeBlueskyActor(req.params.handle);
    if (!handle) {
      return res.status(400).json({ error: 'Blueskyハンドルの形式が正しくありません' });
    }
    // 公開情報でも入力したハンドルをブラウザ・CDNの共有キャッシュへ残さない。
    res.setHeader('Cache-Control', 'no-store');
    const requestKey = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    if (blueskyProfileRateLimits.size > 1_000) {
      for (const [key, value] of blueskyProfileRateLimits) {
        if (value.resetsAt <= now) blueskyProfileRateLimits.delete(key);
      }
    }
    const currentLimit = blueskyProfileRateLimits.get(requestKey);
    const limitState = !currentLimit || currentLimit.resetsAt <= now
      ? { count: 0, resetsAt: now + 10 * 60_000 }
      : currentLimit;
    limitState.count += 1;
    blueskyProfileRateLimits.set(requestKey, limitState);
    res.setHeader('X-RateLimit-Limit', '20');
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, 20 - limitState.count)));
    if (limitState.count > 20) {
      return res.status(429).json({ error: '公開プロフィールの取得回数が上限に達しました。しばらくしてから再試行してください。' });
    }
    const cached = blueskyProfileCache.get(handle);
    if (cached && cached.expiresAt > Date.now()) {
      res.setHeader('X-EarthSignal-Cache', 'HIT');
      return res.json(cached.response);
    }

    try {
      const profileUrl = new URL('https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile');
      profileUrl.searchParams.set('actor', handle);
      const feedUrl = new URL('https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed');
      feedUrl.searchParams.set('actor', handle);
      feedUrl.searchParams.set('limit', '100');
      feedUrl.searchParams.set('filter', 'posts_no_replies');
      const [profile, feed] = await Promise.all([
        fetchBlueskyPublicJson(profileUrl),
        fetchBlueskyPublicJson(feedUrl),
      ]);

      const cutoff = Date.now() - 30 * 24 * 60 * 60_000;
      const relevantPosts = (Array.isArray(feed.feed) ? feed.feed : [])
        // リポストは「自身が書いた本文」ではないため除外する。
        .filter((item: any) => !item?.reason && item?.post?.author?.did === profile.did)
        .map((item: any) => item.post)
        .filter((post: any) => post?.record?.text
          && !hasSensitiveBlueskyLabel(post)
          && Date.parse(post.record.createdAt) >= cutoff)
        .map((post: any) => {
          const text = normalizeSocialText(post.record.text);
          const classification = classifyTextByRules(text);
          const rkey = String(post.uri || '').split('/').at(-1);
          return {
            uri: post.uri,
            url: rkey ? `https://bsky.app/profile/${post.author?.handle || handle}/post/${rkey}` : `https://bsky.app/profile/${handle}`,
            postedAt: post.record.createdAt,
            excerpt: text.slice(0, 300),
            category: classification.category,
            excluded: classification.category === 'unknown'
              || classification.category === 'unrelated'
              || classification.isOfficialReaction,
          };
        })
        .filter((post: any) => !post.excluded)
        .slice(0, 30);
      const response: BlueskyPublicProfileResponse = {
        profile: {
          did: profile.did,
          handle: profile.handle,
          displayName: profile.displayName || profile.handle,
          description: normalizeSocialText(profile.description || '').slice(0, 300),
          avatar: typeof profile.avatar === 'string' && profile.avatar.startsWith('https://') ? profile.avatar : undefined,
          followersCount: Number(profile.followersCount) || 0,
          followsCount: Number(profile.followsCount) || 0,
          postsCount: Number(profile.postsCount) || 0,
        },
        scannedCount: Math.min(100, Array.isArray(feed.feed) ? feed.feed.length : 0),
        relevantPosts,
        fetchedAt: new Date().toISOString(),
        notice: '公開投稿だけを取得します。サーバーでは5分間だけキャッシュし、ハンドルや本文をEarthSignalの端末履歴へ保存しません。',
      };
      if (blueskyProfileCache.size >= 100) {
        const oldestKey = blueskyProfileCache.keys().next().value;
        if (oldestKey) blueskyProfileCache.delete(oldestKey);
      }
      blueskyProfileCache.set(handle, { expiresAt: Date.now() + 5 * 60_000, response });
      return res.json(response);
    } catch (error) {
      if (error instanceof UpstreamHttpError && [400, 404].includes(error.status)) {
        return res.status(404).json({ error: '指定したBluesky公開プロフィールが見つかりません' });
      }
      if (error instanceof UpstreamHttpError && error.status === 429) {
        res.setHeader('Retry-After', '60');
        return res.status(503).json({ error: 'Bluesky公開APIが混雑しています。しばらくしてから再試行してください。' });
      }
      console.warn('Bluesky public profile fetch failed:', error instanceof Error ? error.message : error);
      return res.status(502).json({ error: 'Bluesky公開プロフィールを現在取得できません' });
    }
  });

  // 4. Public SNS collection. External APIs are called server-side to avoid CORS
  // failures and to keep rate limiting/cache behavior consistent for every client.
  app.get('/api/social/posts', async (req, res) => {
    if (socialCache && socialCache.expiresAt > Date.now()) {
      res.setHeader('X-EarthSignal-Cache', 'HIT');
      return res.status(socialCache.response.isLive ? 200 : 502).json(
        socialCache.response.isLive
          ? socialCache.response
          : { ...socialCache.response, error: '利用可能なSNS公開APIがありません' }
      );
    }

    // 複数クライアントの同時更新を直列化し、外部SNSへ同じ検索を重ねて送らない。
    let releaseQueue!: () => void;
    const previousRequest = socialRequestQueue;
    socialRequestQueue = new Promise<void>(resolve => { releaseQueue = resolve; });
    await previousRequest;
    if (socialCache && socialCache.expiresAt > Date.now()) {
      releaseQueue();
      res.setHeader('X-EarthSignal-Cache', 'HIT');
      return res.status(socialCache.response.isLive ? 200 : 502).json(
        socialCache.response.isLive
          ? socialCache.response
          : { ...socialCache.response, error: '利用可能なSNS公開APIがありません' }
      );
    }

    try {

    const blueskyQueries = [
      '地震雲', '変な雲', '地鳴り', '犬が吠える', '猫が落ち着かない',
      '鳥が騒ぐ', '鳥が大量', 'カラスが騒ぐ', '猫が隠れる', '虫が急に静か', '魚が大量',
      'クジラが打ち上げ', '揺れた気がする', '井戸水が濁った',
    ];
    const mastodonTags = ['地震雲', '地鳴り'];
    const mastodonInstances = (process.env.MASTODON_INSTANCES || 'https://mastodon.social,https://mstdn.jp')
      .split(',')
      .map(value => value.trim())
      .filter(value => /^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(value))
      .slice(0, 3);
    // 検索語を増やしてもブラウザ側の50秒制限より前に部分結果を返す。
    const collectionSignal = AbortSignal.timeout(42_000);

    type CollectionTask = {
      source: Extract<SocialSourceType, 'bluesky' | 'mastodon'>;
      run: () => Promise<SocialDerivedPost[]>;
    };

    const tasks: CollectionTask[] = [
      ...blueskyQueries.map(query => ({
        source: 'bluesky' as const,
        run: async () => {
          const requestSignal = AbortSignal.any([collectionSignal, AbortSignal.timeout(SOCIAL_REQUEST_TIMEOUT_MS)]);
          const accessJwt = await getBlueskyAccessToken(requestSignal);
          try {
            return await fetchLiveBlueskyPosts(query, {
              signal: requestSignal,
              throwOnError: true,
              serviceUrl: accessJwt ? 'https://bsky.social' : 'https://api.bsky.app',
              accessJwt: accessJwt || undefined,
            });
          } catch (error) {
            if (!accessJwt || collectionSignal.aborted) throw error;
            // 期限切れ・拒否された認証セッションは破棄し、この回だけ公開検索へ戻す。
            blueskySession = null;
            blueskyAuthFailureUntil = Date.now() + 5 * 60_000;
            return fetchLiveBlueskyPosts(query, {
              signal: AbortSignal.any([collectionSignal, AbortSignal.timeout(SOCIAL_REQUEST_TIMEOUT_MS)]),
              throwOnError: true,
              serviceUrl: 'https://api.bsky.app',
            });
          }
        },
      })),
      ...mastodonInstances.flatMap(instance => mastodonTags.map(tag => ({
        source: 'mastodon' as const,
        run: () => fetchLiveMastodonPosts(tag, instance, {
          signal: AbortSignal.any([collectionSignal, AbortSignal.timeout(SOCIAL_REQUEST_TIMEOUT_MS)]),
          throwOnError: true,
        }),
      }))),
    ];

    // OR検索はBluesky側の既知不具合で0件になるため語ごとに検索し、短い間隔を空ける。
    // Mastodonはインスタンスが分散しているので並列取得して待ち時間を抑える。
    const blueskyTasks = tasks.filter(task => task.source === 'bluesky');
    const mastodonTasks = tasks.filter(task => task.source === 'mastodon');
    const runSequentially = async (items: CollectionTask[]) => {
      const settled: PromiseSettledResult<SocialDerivedPost[]>[] = [];
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        try {
          settled.push({ status: 'fulfilled', value: await item.run() });
        } catch (reason) {
          settled.push({ status: 'rejected', reason });
        }
        if (index < items.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
      return settled;
    };
    const [blueskyResults, mastodonResults] = await Promise.all([
      runSequentially(blueskyTasks),
      Promise.allSettled(mastodonTasks.map(task => task.run())),
    ]);
    const orderedTasks = [...blueskyTasks, ...mastodonTasks];
    const results = [...blueskyResults, ...mastodonResults];
    const posts: SocialDerivedPost[] = [];
    const sourceResults = new Map<SocialSourceType, { successes: number; fetched: number; errors: string[] }>();

    results.forEach((result, index) => {
      const source = orderedTasks[index].source;
      const state = sourceResults.get(source) || { successes: 0, fetched: 0, errors: [] };
      if (result.status === 'fulfilled') {
        state.successes += 1;
        state.fetched += result.value.length;
        posts.push(...result.value);
      } else {
        const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
        state.errors.push(message.replace(/https?:\/\/\S+/g, '[endpoint]'));
      }
      sourceResults.set(source, state);
    });

    const cutoff24h = Date.now() - 24 * 60 * 60_000;
    const protectedPosts = deduplicateSocialPosts(posts)
      .filter(post => new Date(post.postedAt).getTime() >= cutoff24h)
      .sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime())
      .slice(0, 120)
      .map(protectSocialIdentifiers);
    const statuses = (['bluesky', 'mastodon'] as const).map(source => {
      const state = sourceResults.get(source) || { successes: 0, fetched: 0, errors: ['not configured'] };
      return {
        source,
        ok: state.successes > 0,
        degraded: state.successes > 0 && state.errors.length > 0,
        fetched: protectedPosts.filter(post => post.source === source).length,
        error: state.errors.length > 0 ? [...new Set(state.errors)].join(' / ') : undefined,
      };
    });
    const anySourceLive = statuses.some(status => status.ok);

    if (!anySourceLive && socialCache) {
      const staleResponse = { ...socialCache.response, isLive: false, sources: statuses };
      res.setHeader('X-EarthSignal-Cache', 'STALE');
      return res.status(200).json(staleResponse);
    }

    const response: SocialFetchResponse = {
      posts: protectedPosts,
      fetchedAt: new Date().toISOString(),
      isLive: anySourceLive,
      sources: statuses,
    };
    const allConfiguredSourcesLive = statuses.every(status => status.ok);
    socialCache = {
      expiresAt: Date.now() + (allConfiguredSourcesLive ? SOCIAL_CACHE_TTL_MS : 30_000),
      response,
    };
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
    return res.status(anySourceLive ? 200 : 502).json(
      anySourceLive ? response : { ...response, error: '利用可能なSNS公開APIがありません' }
    );
    } finally {
      releaseQueue();
    }
  });

  // 5. AI Explanation / Hypothesis Verification endpoint using Gemini API
  app.post('/api/ai/explain-anomaly', async (req, res) => {
    try {
      const cellId = typeof req.body?.cellId === 'string' ? req.body.cellId.trim() : '';
      const cell = INITIAL_GEO_CELLS.find(candidate => candidate.id === cellId);
      if (!cell) return res.status(400).json({ error: 'Unknown observation cell' });
      res.setHeader('Cache-Control', 'no-store');
      const cellName = cell.name;
      const score = typeof req.body?.score === 'number' && Number.isFinite(req.body.score)
        ? Math.min(100, Math.max(0, req.body.score))
        : null;
      const allowedContributorNames = new Set([
        '上層雲量 (卷雲・巻積雲)',
        '24時間気圧変動幅',
        '同時間帯気温',
        '市民レポートの「普段との差」自己評価',
        '利用者確認済み動物音の「普段との差」',
        '利用者確認済み低い環境音の「普段との差」',
        '雲写真の「普段との差」自己評価',
        '周辺250kmの地震情報件数',
      ]);
      const contributors = Array.isArray(req.body?.contributors)
        ? req.body.contributors
          .filter((item: unknown) => item && typeof item === 'object')
          .slice(0, 10)
          .map((item: Record<string, unknown>) => ({
            displayName: typeof item.displayName === 'string' && allowedContributorNames.has(item.displayName)
              ? item.displayName
              : '観測項目',
            changeRate: typeof item.changeRate === 'string' ? item.changeRate.slice(0, 30) : undefined,
            zScore: typeof item.zScore === 'number' && Number.isFinite(item.zScore) ? item.zScore : undefined,
            contribution: typeof item.contribution === 'number' && Number.isFinite(item.contribution)
              ? Math.min(100, Math.max(0, item.contribution))
              : undefined,
          }))
        : [];
      const confounders = Array.isArray(req.body?.confounders)
        ? req.body.confounders
          .filter((item: unknown) => typeof item === 'string')
          .slice(0, 10)
          .map((item: string) => {
            const wind = item.match(/^強風\(([\d.]+)m\/s\)/);
            if (wind) return `強風(${Number(wind[1]).toFixed(1)}m/s)による音響品質補正`;
            const rain = item.match(/^降雨\(([\d.]+)mm\)/);
            if (rain) return `降雨(${Number(rain[1]).toFixed(1)}mm)による環境音補正`;
            const reports = item.match(/^市民観測は(\d+)件/);
            if (reports) return `市民観測${Math.min(200, Number(reports[1]))}件（標本数を考慮）`;
            return null;
          })
          .filter((item): item is string => Boolean(item))
        : [];
      if (score === null) {
        return res.json({
          explanation: '実測ベースラインまたは有効な観測項目が不足しているため、現在は異常度を算出していません。データ蓄積後に再評価します。※地震発生確率ではありません。',
          source: 'rule-based-engine',
        });
      }
      
      // If Gemini API Key is available, generate an objective scientific commentary
      if (process.env.GEMINI_API_KEY) {
        const ai = getGeminiClient();
        const prompt = `あなたは地震学・気象学・生物音響学の研究コミュニケーション専門家です。
以下の観測データから、平常時からの統計的乖離に関する学術的かつ客観的な解説文を日本語で150文字以内で作成してください。

【厳格なルール】
1. 「地震が起きる」「予知」「危険」「避難」という断定的な語は絶対に使用禁止。
2. 平常時ベースラインとの統計的な珍しさ（Zスコア）および気象や生活音などの交絡要因（Confounders）を説明すること。
3. 末尾に「※本スコアは平常時データとの差異を示すもので、地震発生確率ではありません。」を明記すること。

【データ】
地域: ${cellName}
観測異常度: ${score} / 100
主な寄与要因: ${JSON.stringify(contributors || [])}
考慮された交絡要因: ${JSON.stringify(confounders || [])}
`;

        const response = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
          config: {
            maxOutputTokens: 256,
          },
        });

        const generated = response.text?.replace(/\s+/g, ' ').trim() || '';
        const unsafeClaim = /(地震.{0,8}(起きる|発生する|可能性|恐れ)|予知|予兆|前兆|危険度|避難)/i.test(generated);
        if (generated && !unsafeClaim) {
          const disclaimer = '※本スコアは平常時データとの差異を示すもので、地震発生確率ではありません。';
          const body = generated
            .replace(/※本スコアは平常時データとの差異を示すもので、地震発生確率ではありません。?$/u, '')
            .trim()
            .slice(0, 320);
          if (body) {
            return res.json({
              explanation: `${body}${/[。！？]$/u.test(body) ? '' : '。'}${disclaimer}`,
              source: GEMINI_MODEL,
            });
          }
        }
        return res.json({
          explanation: `地域（${cellName}）の観測異常度は ${score} / 100 です。利用可能な実測ベースラインとの差だけを示し、履歴不足の項目は採点していません。※本スコアは地震発生確率ではありません。`,
          source: 'rule-based-safety-fallback',
        });
      } else {
        // Fallback rule-based explanation
        return res.json({
          explanation: `地域（${cellName}）において利用可能な実測ベースラインと比較した観測異常度は ${score} / 100 です。交絡要因（${confounders?.join(', ') || 'なし'}）を併記しています。履歴不足の項目は採点していません。※本スコアは地震発生確率ではありません。`,
          source: 'rule-based-engine',
        });
      }
    } catch (err: any) {
      console.error('Error generating AI explanation:', err);
      res.status(503).json({ error: 'AI解説を一時的に生成できません' });
    }
  });

  // APIの打ち間違いをSPA成功応答に見せず、機械判読できるJSONで返す。
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  // express.json の構文エラーをHTMLではなく一貫したJSON 400にする。
  app.use((error: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (error instanceof SyntaxError && 'body' in error) {
      return res.status(400).json({ error: 'Request body must be valid JSON' });
    }
    next(error);
  });

  // 6. Vite middleware for development vs Static files for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (path.basename(filePath) === 'index.html') {
          res.setHeader('Cache-Control', 'no-cache');
        } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=3600');
        }
      },
    }));
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EarthSignal server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start EarthSignal server:', err);
});
