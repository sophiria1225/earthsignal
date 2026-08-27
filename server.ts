import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createHash } from 'crypto';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import {
  deduplicateSocialPosts,
  fetchLiveBlueskyPosts,
  fetchLiveMastodonPosts,
} from './src/services/snsCollector';
import { SocialDerivedPost, SocialFetchResponse, SocialSourceType } from './src/types';
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

let socialCache: { expiresAt: number; response: SocialFetchResponse } | null = null;
let socialRequestQueue: Promise<void> = Promise.resolve();
let earthquakeCache: { expiresAt: number; response: EarthquakeFeedResult } | null = null;
const weatherCache = new Map<string, { expiresAt: number; response: WeatherFeedResult }>();
let earthquakeInFlight: Promise<EarthquakeFeedResult> | null = null;
const weatherInFlight = new Map<string, Promise<WeatherFeedResult>>();
let blueskySession: { accessJwt: string; expiresAt: number } | null = null;

async function getBlueskyAccessToken(): Promise<string | null> {
  const identifier = process.env.BLUESKY_IDENTIFIER?.trim();
  const appPassword = process.env.BLUESKY_APP_PASSWORD?.trim();
  if (!identifier || !appPassword) return null;
  if (blueskySession && blueskySession.expiresAt > Date.now()) return blueskySession.accessJwt;

  const response = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'EarthSignal/1.0 (public-earth-observation-research)',
    },
    body: JSON.stringify({ identifier, password: appPassword }),
    signal: AbortSignal.timeout(SOCIAL_REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Bluesky authentication returned ${response.status}`);
  const session = await response.json() as { accessJwt?: string };
  if (!session.accessJwt) throw new Error('Bluesky authentication response did not include an access token');
  blueskySession = {
    accessJwt: session.accessJwt,
    // Access JWTの実期限より十分短く更新し、期限切れリクエストを避ける。
    expiresAt: Date.now() + 45 * 60_000,
  };
  return session.accessJwt;
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
  app.use(express.json({ limit: '64kb' }));

  const aiRateLimits = new Map<string, { count: number; resetsAt: number }>();
  app.use('/api/ai', (req, res, next) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
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
      '地震雲', '地鳴り', '犬が吠える', '鳥が騒ぐ', '揺れた気がする',
    ];
    const mastodonTags = ['地震雲', '地鳴り'];
    const mastodonInstances = (process.env.MASTODON_INSTANCES || 'https://mastodon.social,https://mstdn.jp')
      .split(',')
      .map(value => value.trim())
      .filter(value => /^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(value))
      .slice(0, 3);

    type CollectionTask = {
      source: Extract<SocialSourceType, 'bluesky' | 'mastodon'>;
      run: () => Promise<SocialDerivedPost[]>;
    };

    const tasks: CollectionTask[] = [
      ...blueskyQueries.map(query => ({
        source: 'bluesky' as const,
        run: async () => {
          const accessJwt = await getBlueskyAccessToken();
          return fetchLiveBlueskyPosts(query, {
            signal: AbortSignal.timeout(SOCIAL_REQUEST_TIMEOUT_MS),
            throwOnError: true,
            serviceUrl: accessJwt ? 'https://bsky.social' : 'https://api.bsky.app',
            accessJwt: accessJwt || undefined,
          });
        },
      })),
      ...mastodonInstances.flatMap(instance => mastodonTags.map(tag => ({
        source: 'mastodon' as const,
        run: () => fetchLiveMastodonPosts(tag, instance, {
          signal: AbortSignal.timeout(SOCIAL_REQUEST_TIMEOUT_MS),
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
      const cellName = typeof req.body?.cellName === 'string' ? req.body.cellName.trim().slice(0, 120) : '';
      const score = typeof req.body?.score === 'number' && Number.isFinite(req.body.score)
        ? Math.min(100, Math.max(0, req.body.score))
        : null;
      const contributors = Array.isArray(req.body?.contributors)
        ? req.body.contributors
          .filter((item: unknown) => item && typeof item === 'object')
          .slice(0, 10)
          .map((item: Record<string, unknown>) => ({
            displayName: typeof item.displayName === 'string' ? item.displayName.slice(0, 100) : '観測項目',
            changeRate: typeof item.changeRate === 'string' ? item.changeRate.slice(0, 30) : undefined,
            zScore: typeof item.zScore === 'number' && Number.isFinite(item.zScore) ? item.zScore : undefined,
            contribution: typeof item.contribution === 'number' && Number.isFinite(item.contribution)
              ? Math.min(100, Math.max(0, item.contribution))
              : undefined,
          }))
        : [];
      const confounders = Array.isArray(req.body?.confounders)
        ? req.body.confounders.filter((item: unknown) => typeof item === 'string').slice(0, 10).map((item: string) => item.slice(0, 200))
        : [];
      if (!cellName) return res.status(400).json({ error: 'cellName is required' });
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
          model: 'gemini-3.7-flash',
          contents: prompt,
          config: {
            temperature: 0.2,
            maxOutputTokens: 256,
          },
        });

        return res.json({
          explanation: response.text?.trim() || '平常時ベースラインとの統計的乖離を計算しています。',
          source: 'gemini-3.7-flash',
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

  // 6. Vite middleware for development vs Static files for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
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
