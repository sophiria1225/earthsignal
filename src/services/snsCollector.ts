/**
 * EarthSignal - SNS Collective Intelligence Layer (v2.0)
 * Collects Bluesky and Mastodon public posts on the server, then derives privacy-preserving summaries.
 * Implements rule dictionary, negation/historical filtering, deduplication, geo-extraction, and quality scoring
 */

import { SocialCategory, SocialDerivedPost, SocialFetchResponse, SocialHourlySummary, SocialSourceType, AnalysisMode } from '../types';
import { fetchWithTimeout } from './http';

// 7.3 検索語辞書
export const KEYWORD_DICTIONARY: Record<SocialCategory, string[]> = {
  cloud: ['地震雲', '変な雲', '不思議な雲', '筋状の雲', '帯状雲', '放射状の雲', '空がおかしい', '空が光った', '発光現象', '竜巻のような雲'],
  animal: ['犬が吠える', '犬がずっと', '犬が落ち着かない', '鳥が騒ぐ', '鳥が大量', 'カラスが騒ぐ', 'カラスが異常', '猫が落ち着かない', '猫が隠れる', '魚が大量', 'クジラが打ち上げ', '虫が急に静か'],
  sound: ['地鳴り', '低い音', 'ゴーという音', '爆発音のような', '謎の音', '窓が振動', '遠くで雷のような音'],
  shaking: ['揺れた気がする', '微妙に揺れ', '何か揺れた', 'めまいか地震か', '微振動', '家具がカタカタ'],
  water: ['井戸水が濁った', '井戸の水位', '水が濁った', '温泉の温度変化', '潮が引いた'],
  device: ['コンパスが狂った', '電波が変', '家電が勝手に', '時計が止まった', '磁石が'],
  official_reaction: ['気象庁発表', '緊急地震速報', '震度速報', 'NHKニュース', '震源地', '津波警報'],
  unrelated: ['比喩', 'ゲームの地震', '株価が地震', '思い出', '去年の地震'],
  unknown: [],
};

// 否定文・過去談・比喩・公式ニュースの除外ルール (16.6)
const NEGATION_REGEX = /(ない|無い|なかった|ではない|違う|デマ|無関係|根拠.{0,5}(ない|無い)|迷信|嘘|勘違い|嘘っぽい)/i;
const HISTORICAL_REGEX = /(昔|先日|数日前|この前|去年|昨年|\d+[日週ヶか月年]前|過去|思い出|東日本大震災の時|あの時)/i;
const QUOTATION_REGEX = /(ニュース|記事|引用|リポスト|RT|転載|報道|まとめ)/i;
const DIRECT_OBSERVATION_REGEX = /(見た|見える|聞こえ|感じた|している|なっている|今|現在|さっき|目の前)/i;
const METAPHOR_CONTEXT_REGEX = /(ゲーム|漫画|アニメ|小説|映画|ライブ|コンサート|スタジアム|歓声|観客|喘ぎ|創作|二次創作)/i;
const KNOWN_SOUND_SOURCE_REGEX = /(雷|落雷|花火|工事|解体|発破|飛行機|戦闘機|ヘリ|電車|列車|トラック|自衛隊|スピーカー|掃除機|洗濯機)/i;
const KNOWN_ANIMAL_TRIGGER_REGEX = /(地震|揺れ|緊急地震速報|雷|落雷|花火|工事|サイレン|掃除機|引っ越し|来客|人の出入り|動物病院)/i;

// SNS本文は「騒ぐ」だけでなく「騒いでる」等の活用形で書かれるため、
// 語彙の完全一致に加えて生物種と行動語の近接パターンを使う。
const ANIMAL_OBSERVATION_REGEXES = [
  /犬.{0,16}(吠え|遠吠え|鳴き続|落ち着かな)/,
  /猫.{0,16}(落ち着かな|隠れ|鳴き続|騒)/,
  /(鳥|野鳥|カラス).{0,16}(騒|大量|群れ|一斉|静か)/,
  /(魚|イワシ).{0,16}(大量|群れ|打ち上げ|漂着)/,
  /(クジラ|鯨|イルカ).{0,16}(打ち上げ|漂着)/,
  /(虫|カエル).{0,16}(静か|鳴かな|大量)/,
  /(動物|ペット).{0,16}(騒|急に静か|異常|落ち着かな)/,
];

function stableTextId(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

// 都道府県・主要都市の辞書
const JAPAN_PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
];

const MAJOR_CITIES_MAP: Record<string, { pref: string; cellId: string }> = {
  '東京': { pref: '東京都', cellId: 'cell_tokyo_01' },
  '渋谷': { pref: '東京都', cellId: 'cell_tokyo_01' },
  '新宿': { pref: '東京都', cellId: 'cell_tokyo_01' },
  '横浜': { pref: '神奈川県', cellId: 'cell_tokyo_01' },
  '千葉': { pref: '千葉県', cellId: 'cell_chiba_02' },
  '銚子': { pref: '千葉県', cellId: 'cell_chiba_02' },
  '九十九里': { pref: '千葉県', cellId: 'cell_chiba_02' },
  '輪島': { pref: '石川県', cellId: 'cell_noto_03' },
  '能登': { pref: '石川県', cellId: 'cell_noto_03' },
  '金沢': { pref: '石川県', cellId: 'cell_noto_03' },
  '仙台': { pref: '宮城県', cellId: 'cell_miyagi_04' },
  '石巻': { pref: '宮城県', cellId: 'cell_miyagi_04' },
  '大阪': { pref: '大阪府', cellId: 'cell_osaka_05' },
  '神戸': { pref: '兵庫県', cellId: 'cell_osaka_05' },
  '京都': { pref: '京都府', cellId: 'cell_osaka_05' },
  '宮崎': { pref: '宮崎県', cellId: 'cell_miyazaki_06' },
  '日南': { pref: '宮崎県', cellId: 'cell_miyazaki_06' },
  '札幌': { pref: '北海道', cellId: 'cell_hokkaido_07' },
  '千歳': { pref: '北海道', cellId: 'cell_hokkaido_07' },
  '那覇': { pref: '沖縄県', cellId: 'cell_okinawa_08' },
};

/**
 * 16.4 テキスト正規化
 */
export function normalizeSocialText(input: string): string {
  return input
    .normalize('NFKC')
    .replace(/<[^>]*>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' URL ')
    .replace(/@[\w.:-]+/g, ' USER ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1000);
}

/**
 * Bluesky の公開 actor 指定に使える handle / DID だけを受け付ける。
 * URLや検索式を許可しないことで、サーバーを任意URL取得に利用できないようにする。
 */
export function normalizeBlueskyActor(input: string): string | null {
  const actor = input.trim().replace(/^@/, '').toLowerCase();
  if (/^did:plc:[a-z2-7]{20,64}$/.test(actor)) return actor;
  if (actor.length > 253 || !actor.includes('.')) return null;
  const labels = actor.split('.');
  return labels.every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
    ? actor
    : null;
}

/** UI入力では公式プロフィールURLも受け付け、actor部分だけへ変換する。 */
export function extractBlueskyActorInput(input: string): string | null {
  const trimmed = input.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (url.protocol !== 'https:' || url.hostname !== 'bsky.app') return null;
      const match = url.pathname.match(/^\/profile\/([^/]+)\/?$/);
      return match ? normalizeBlueskyActor(decodeURIComponent(match[1])) : null;
    } catch {
      return null;
    }
  }
  return normalizeBlueskyActor(trimmed);
}

/**
 * テキストから現象カテゴリをルールベース判定
 */
export function classifyTextByRules(text: string): {
  category: SocialCategory;
  confidence: number;
  isNegated: boolean;
  isHistorical: boolean;
  isOfficialReaction: boolean;
} {
  const norm = normalizeSocialText(text);

  // 1. 公式ニュースまたは地震後反応チェック
  if (KEYWORD_DICTIONARY.official_reaction.some(k => norm.includes(k))) {
    return { category: 'official_reaction', confidence: 0.95, isNegated: false, isHistorical: false, isOfficialReaction: true };
  }

  // 2. 過去談・比喩判定
  const isHistorical = HISTORICAL_REGEX.test(norm);
  // 「犬/猫が落ち着かない」の「ない」は否定ではなく観測対象の行動語。
  // この句だけ置換し、「ではない」「デマ」等の否定文は残す。
  const negationTarget = norm.replace(/(犬|猫)が落ち着かない/g, '$1が不穏');
  const isNegated = NEGATION_REGEX.test(negationTarget);
  const isMetaphorical = METAPHOR_CONTEXT_REGEX.test(norm);
  const isIndirectQuotation = QUOTATION_REGEX.test(norm) && !DIRECT_OBSERVATION_REGEX.test(norm);

  // 3. カテゴリマッチング
  for (const cat of ['cloud', 'animal', 'sound', 'shaking', 'water', 'device'] as SocialCategory[]) {
    const keywords = KEYWORD_DICTIONARY[cat];
    const matched = keywords.some(k => norm.includes(k))
      || (cat === 'animal' && ANIMAL_OBSERVATION_REGEXES.some(pattern => pattern.test(norm)));
    if (matched) {
      const hasKnownCause = ((cat === 'sound' || cat === 'shaking') && KNOWN_SOUND_SOURCE_REGEX.test(norm))
        || (cat === 'animal' && KNOWN_ANIMAL_TRIGGER_REGEX.test(norm));
      if (isHistorical || isNegated || isMetaphorical || isIndirectQuotation || hasKnownCause) {
        return { category: 'unrelated', confidence: 0.85, isNegated, isHistorical, isOfficialReaction: false };
      }
      return { category: cat, confidence: 0.85, isNegated: false, isHistorical: false, isOfficialReaction: false };
    }
  }

  return { category: 'unknown', confidence: 0.3, isNegated: false, isHistorical: false, isOfficialReaction: false };
}

/**
 * 7.6 地域抽出
 */
export function extractLocationFromText(text: string, defaultCellId: string = 'cell_unknown'): {
  placeName?: string;
  h3Cell: string;
  confidence: number;
} {
  for (const [cityName, info] of Object.entries(MAJOR_CITIES_MAP)) {
    if (text.includes(cityName)) {
      return { placeName: cityName, h3Cell: info.cellId, confidence: 0.90 };
    }
  }

  for (const pref of JAPAN_PREFECTURES) {
    if (text.includes(pref)) {
      // 都道府県から代表セルをマッピング
      const entry = Object.entries(MAJOR_CITIES_MAP).find(([_, v]) => v.pref === pref);
      return {
        placeName: pref,
        h3Cell: entry ? entry[1].cellId : defaultCellId,
        confidence: 0.75,
      };
    }
  }

  return { h3Cell: defaultCellId, confidence: 0.20 };
}

function decodeHtmlEntities(value: string): string {
  const entities: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", nbsp: ' ',
  };
  return value.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const radix = entity[1]?.toLowerCase() === 'x' ? 16 : 10;
      const raw = radix === 16 ? entity.slice(2) : entity.slice(1);
      const codePoint = Number.parseInt(raw, radix);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return entities[entity.toLowerCase()] ?? match;
  });
}

export function mastodonHtmlToText(value: string): string {
  return normalizeSocialText(decodeHtmlEntities(value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')));
}

export function hasSensitiveBlueskyLabel(post: any): boolean {
  return Array.isArray(post?.labels) && post.labels.some((label: any) =>
    ['porn', 'sexual', 'nudity', 'graphic-media'].includes(String(label?.val || '').toLowerCase()));
}

/**
 * 7.8 情報品質スコア (0.0〜1.0)
 */
export function calculateInformationQuality(params: {
  hasTimestamp: boolean;
  hasLocation: boolean;
  isSpecific: boolean;
  hasMediaLink: boolean;
  isPreEvent: boolean;
  isDuplicate: boolean;
  isProfileLocationOnly: boolean;
}): number {
  let score = 0.0;
  if (params.hasTimestamp) score += 0.25;
  if (params.hasLocation) score += 0.25;
  if (params.isSpecific) score += 0.20;
  if (params.hasMediaLink) score += 0.10;
  if (params.isPreEvent) score += 0.10;
  if (!params.isDuplicate) score += 0.10;

  if (params.isDuplicate) score -= 0.30;
  if (!params.isPreEvent) score -= 0.30; // 事後回想ペナルティ
  if (params.isProfileLocationOnly) score -= 0.20;

  return Math.min(1.0, Math.max(0.0, Math.round(score * 100) / 100));
}

// リアルタイム検索用URLビルダー
export function buildSocialSearchUrl(source: SocialSourceType, query: string): string {
  const enc = encodeURIComponent(query);
  switch (source) {
    case 'bluesky':
      return `https://bsky.app/search?q=${enc}`;
    case 'mastodon':
      return `https://mstdn.jp/tags/${enc}`;
    case 'youtube':
      return `https://www.youtube.com/results?search_query=${enc}`;
    case 'misskey':
      return `https://misskey.io/search?q=${enc}`;
    default:
      return `https://bsky.app/search?q=${enc}`;
  }
}

/**
 * Bluesky 公開検索 API からリアルタイム投稿を取得
 */
export async function fetchLiveBlueskyPosts(
  query: string = '地震雲 OR 地鳴り OR 犬 吠える',
  options: {
    signal?: AbortSignal;
    throwOnError?: boolean;
    serviceUrl?: 'https://api.bsky.app' | 'https://bsky.social';
    accessJwt?: string;
    retryDelayMs?: number;
  } = {}
): Promise<SocialDerivedPost[]> {
  try {
    const serviceUrl = options.serviceUrl || 'https://api.bsky.app';
    const url = new URL(`${serviceUrl}/xrpc/app.bsky.feed.searchPostsV2`);
    url.searchParams.set('query', query);
    url.searchParams.set('limit', '20');
    url.searchParams.set('sort', 'recent');
    url.searchParams.append('languages', 'ja');
    url.searchParams.set('queryLanguage', 'ja');
    url.searchParams.set('since', new Date(Date.now() - 24 * 60 * 60_000).toISOString());

    let res: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'EarthSignal/1.0 (public-earth-observation-research)',
          ...(options.accessJwt ? { Authorization: `Bearer ${options.accessJwt}` } : {}),
        },
        signal: options.signal,
      });
      if (res.ok) break;
      const retryable = res.status === 403 || res.status === 429 || res.status >= 500;
      if (!retryable || attempt === 2) throw new Error(`Bluesky API returned ${res.status}`);
      const retryAfterSeconds = Number.parseFloat(res.headers.get('retry-after') || '');
      const delayMs = Number.isFinite(retryAfterSeconds)
        ? Math.min(3_000, retryAfterSeconds * 1000)
        : (options.retryDelayMs ?? 600) * (attempt + 1);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    if (!res?.ok) throw new Error(`Bluesky API returned ${res?.status || 'no response'}`);
    const data = await res.json();
    const posts = data.posts || [];

    return posts.filter((p: any) => !hasSensitiveBlueskyLabel(p)).map((p: any) => {
      const text = p.record?.text || '';
      const { category, isNegated, isHistorical, isOfficialReaction } = classifyTextByRules(text);
      const loc = extractLocationFromText(text);

      // at://did:plc:.../app.bsky.feed.post/3kw... から rkey を抽出
      const uriParts = (p.uri || '').split('/');
      const rkey = uriParts[uriParts.length - 1] || '';
      const handle = p.author?.handle || 'bsky.app';
      const webUrl = rkey ? `https://bsky.app/profile/${handle}/post/${rkey}` : `https://bsky.app/search?q=${encodeURIComponent(query)}`;

      const quality = calculateInformationQuality({
        hasTimestamp: Boolean(p.record?.createdAt),
        hasLocation: Boolean(loc.placeName),
        isSpecific: text.length > 20,
        hasMediaLink: Boolean(p.embed),
        isPreEvent: !isOfficialReaction,
        isDuplicate: false,
        isProfileLocationOnly: false,
      });

      return {
        id: `bsky_${p.cid || stableTextId(`${p.uri || ''}:${p.record?.createdAt || ''}:${text}`)}`,
        source: 'bluesky',
        sourceIdHash: p.cid || stableTextId(`${p.uri || ''}:${p.record?.createdAt || ''}:${text}`),
        actorIdHash: p.author?.did,
        sourceUrl: webUrl,
        postedAt: p.record?.createdAt || new Date().toISOString(),
        fetchedAt: new Date().toISOString(),
        category,
        subject: category,
        behavior: text.slice(0, 40),
        h3Cell: loc.h3Cell,
        placeName: loc.placeName,
        placeConfidence: loc.confidence,
        informationQuality: quality,
        isPostEventReaction: isOfficialReaction,
        isDuplicate: false,
        analysisMode: 'rules',
        temporaryExcerpt: text.slice(0, 140),
      } as SocialDerivedPost;
    }).filter((p: SocialDerivedPost) => p.category !== 'unknown' && p.category !== 'unrelated');
  } catch (err) {
    if (options.throwOnError) throw err;
    console.warn('Failed to fetch live Bluesky posts:', err);
    return [];
  }
}

/**
 * Mastodon 公開タグ API (mstdn.jp) からリアルタイム投稿を取得
 */
export async function fetchLiveMastodonPosts(
  tag: string = '地震雲',
  instance: string = 'https://mstdn.jp',
  options: { signal?: AbortSignal; throwOnError?: boolean } = {}
): Promise<SocialDerivedPost[]> {
  try {
    const baseUrl = instance.replace(/\/$/, '');
    const url = `${baseUrl}/api/v1/timelines/tag/${encodeURIComponent(tag)}?limit=20`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'EarthSignal/1.0 (public-earth-observation-research)',
      },
      signal: options.signal,
    });
    if (!res.ok) throw new Error(`${new URL(baseUrl).hostname} returned ${res.status}`);
    const posts = await res.json();
    if (!Array.isArray(posts)) return [];

    return posts.filter((p: any) => !(p.reblog || p)?.sensitive).map((p: any) => {
      const status = p.reblog || p;
      const text = mastodonHtmlToText(`${status.spoiler_text || ''} ${status.content || ''}`);
      const { category, isOfficialReaction } = classifyTextByRules(text);
      const loc = extractLocationFromText(text);

      const quality = calculateInformationQuality({
        hasTimestamp: Boolean(status.created_at),
        hasLocation: Boolean(loc.placeName),
        isSpecific: text.length > 15,
        hasMediaLink: (status.media_attachments || []).length > 0,
        isPreEvent: !isOfficialReaction,
        isDuplicate: false,
        isProfileLocationOnly: false,
      });

      return {
        id: `masto_${status.id || stableTextId(`${status.uri || ''}:${status.created_at || ''}:${text}`)}`,
        source: 'mastodon',
        sourceIdHash: String(status.id || stableTextId(`${status.uri || ''}:${status.created_at || ''}:${text}`)),
        actorIdHash: status.account?.id ? String(status.account.id) : undefined,
        sourceUrl: status.url || status.uri || `${baseUrl}/tags/${encodeURIComponent(tag)}`,
        postedAt: status.created_at || new Date().toISOString(),
        fetchedAt: new Date().toISOString(),
        category,
        subject: category,
        behavior: text.slice(0, 40),
        h3Cell: loc.h3Cell,
        placeName: loc.placeName,
        placeConfidence: loc.confidence,
        informationQuality: quality,
        isPostEventReaction: isOfficialReaction,
        isDuplicate: false,
        analysisMode: 'rules',
        temporaryExcerpt: text.slice(0, 140),
      } as SocialDerivedPost;
    }).filter((p: SocialDerivedPost) => p.category !== 'unknown' && p.category !== 'unrelated');
  } catch (err) {
    if (options.throwOnError) throw err;
    console.warn('Failed to fetch live Mastodon posts:', err);
    return [];
  }
}

/** 同じ投稿が複数の検索語・インスタンスに現れた場合に1件へまとめる。 */
export function deduplicateSocialPosts(posts: SocialDerivedPost[]): SocialDerivedPost[] {
  const seenIds = new Set<string>();
  const seenContent = new Set<string>();
  return posts.filter((post) => {
    const idKey = `${post.source}:${post.sourceIdHash}`;
    const contentKey = `${post.source}:${normalizeSocialText(post.temporaryExcerpt || '').toLowerCase()}`;
    if (seenIds.has(idKey) || (post.temporaryExcerpt && seenContent.has(contentKey))) return false;
    seenIds.add(idKey);
    if (post.temporaryExcerpt) seenContent.add(contentKey);
    return true;
  });
}

let liveSocialRequest: Promise<SocialFetchResponse> | null = null;

/** ブラウザは外部SNSへ直接接続せず、同一オリジンの収集APIだけを呼ぶ。 */
export function fetchLiveSocialPosts(): Promise<SocialFetchResponse> {
  // React StrictModeの二重effectや更新ボタン連打でも同一リクエストへ合流させる。
  if (liveSocialRequest) return liveSocialRequest;

  liveSocialRequest = (async () => {
    const res = await fetchWithTimeout('/api/social/posts', { headers: { Accept: 'application/json' } }, 50_000);
    if (!res.ok) {
      let detail = '';
      try {
        const body = await res.json();
        detail = body?.error ? `: ${body.error}` : '';
      } catch {
        // JSONでないエラー応答はステータスだけを表示する。
      }
      throw new Error(`SNS収集APIが ${res.status} を返しました${detail}`);
    }
    return res.json();
  })().finally(() => {
    liveSocialRequest = null;
  });

  return liveSocialRequest;
}

/**
 * セルごとのSNS集計サマリーを計算
 */
export function generateCellSocialSummary(
  cellId: string,
  posts: SocialDerivedPost[] = [],
  window: '1h' | '6h' | '24h' = '6h'
): SocialHourlySummary {
  const windowMs = { '1h': 60 * 60_000, '6h': 6 * 60 * 60_000, '24h': 24 * 60 * 60_000 }[window];
  const cutoff = Date.now() - windowMs;
  const cellPosts = posts.filter(p =>
    p.h3Cell === cellId
    && !p.isPostEventReaction
    && new Date(p.postedAt).getTime() >= cutoff
  );
  const categories: Record<SocialCategory, number> = {
    cloud: 0,
    animal: 0,
    sound: 0,
    shaking: 0,
    water: 0,
    device: 0,
    official_reaction: 0,
    unrelated: 0,
    unknown: 0,
  };

  const sources: Record<SocialSourceType, number> = {
    bluesky: 0,
    mastodon: 0,
    youtube: 0,
    misskey: 0,
  };

  const analysisModes: Record<AnalysisMode, number> = {
    rules: 0,
    embedding: 0,
    llm: 0,
    rules_only_quota: 0,
  };

  let totalQuality = 0;
  let explicitLocationCount = 0;

  for (const post of cellPosts) {
    categories[post.category] = (categories[post.category] || 0) + 1;
    sources[post.source] = (sources[post.source] || 0) + 1;
    analysisModes[post.analysisMode] = (analysisModes[post.analysisMode] || 0) + 1;
    totalQuality += post.informationQuality;
    if (post.placeConfidence >= 0.7) explicitLocationCount++;
  }

  const total = cellPosts.length;
  const avgQuality = total > 0 ? totalQuality / total : 0;
  const locationExplicitRatio = total > 0 ? explicitLocationCount / total : 0;

  return {
    cellId,
    window,
    totalPosts: total,
    uniqueActorEstimate: total === 0
      ? 0
      : new Set(cellPosts.map(p => p.actorIdHash || p.sourceIdHash)).size,
    locationExplicitRatio: Math.round(locationExplicitRatio * 100) / 100,
    qualityScore: Math.round(avgQuality * 100) / 100,
    // SNSの平常時履歴は永続DBが整うまで推測値を置かない。
    anomalyScore: null,
    baselineSampleCount: 0,
    animalAnomalyScore: null,
    animalBaselineSampleCount: 0,
    animalBaselineMedian: null,
    animalBaselineMad: null,
    categories,
    sources,
    analysisModes,
    globalTopicSpike: false,
    notice: 'SNS異常度は同一地域・同時間帯の履歴が十分に蓄積された場合のみ算出します。投稿数の増加は地震の前兆を意味しません。',
  };
}
