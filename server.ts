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

const SOCIAL_CACHE_TTL_MS = 60_000;
const SOCIAL_REQUEST_TIMEOUT_MS = 8_000;

let socialCache: { expiresAt: number; response: SocialFetchResponse } | null = null;

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
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Gemini client (Lazy initialization safe)
  let aiClient: GoogleGenAI | null = null;
  function getGeminiClient(): GoogleGenAI {
    if (!aiClient) {
      aiClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
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
    });
  });

  // 2. Public SNS collection. External APIs are called server-side to avoid CORS
  // failures and to keep rate limiting/cache behavior consistent for every client.
  app.get('/api/social/posts', async (req, res) => {
    if (socialCache && socialCache.expiresAt > Date.now()) {
      res.setHeader('X-EarthSignal-Cache', 'HIT');
      return res.json(socialCache.response);
    }

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
        run: () => fetchLiveBlueskyPosts(query, {
          signal: AbortSignal.timeout(SOCIAL_REQUEST_TIMEOUT_MS),
          throwOnError: true,
        }),
      })),
      ...mastodonInstances.flatMap(instance => mastodonTags.map(tag => ({
        source: 'mastodon' as const,
        run: () => fetchLiveMastodonPosts(tag, instance, {
          signal: AbortSignal.timeout(SOCIAL_REQUEST_TIMEOUT_MS),
          throwOnError: true,
        }),
      }))),
    ];

    // Blueskyは短時間の並列検索を403で抑止するため直列化する。
    // Mastodonはインスタンスが分散しているので並列取得して待ち時間を抑える。
    const blueskyTasks = tasks.filter(task => task.source === 'bluesky');
    const mastodonTasks = tasks.filter(task => task.source === 'mastodon');
    const runSequentially = async (items: CollectionTask[]) => {
      const settled: PromiseSettledResult<SocialDerivedPost[]>[] = [];
      for (const item of items) {
        try {
          settled.push({ status: 'fulfilled', value: await item.run() });
        } catch (reason) {
          settled.push({ status: 'rejected', reason });
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
    socialCache = { expiresAt: Date.now() + SOCIAL_CACHE_TTL_MS, response };
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
    return res.status(anySourceLive ? 200 : 502).json(
      anySourceLive ? response : { ...response, error: '利用可能なSNS公開APIがありません' }
    );
  });

  // 3. AI Explanation / Hypothesis Verification endpoint using Gemini API
  app.post('/api/ai/explain-anomaly', async (req, res) => {
    try {
      const { cellName, score, contributors, confounders } = req.body;
      
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
        });

        return res.json({
          explanation: response.text?.trim() || '平常時ベースラインとの統計的乖離を計算しています。',
          source: 'gemini-3.7-flash',
        });
      } else {
        // Fallback rule-based explanation
        return res.json({
          explanation: `地域（${cellName}）において過去30日同時間帯データと比較した観測異常度は ${score} / 100 です。交絡要因（${confounders?.join(', ') || 'なし'}）を補正の上で集計しています。※本スコアは地震発生確率ではありません。`,
          source: 'rule-based-engine',
        });
      }
    } catch (err: any) {
      console.error('Error generating AI explanation:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Vite middleware for development vs Static files for production
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
