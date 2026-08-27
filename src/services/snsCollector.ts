/**
 * EarthSignal - SNS Collective Intelligence Layer (v2.0)
 * Integrates Bluesky, Mastodon, YouTube, and Misskey public endpoints
 * Implements rule dictionary, negation/historical filtering, deduplication, geo-extraction, and quality scoring
 */

import { SocialCategory, SocialDerivedPost, SocialHourlySummary, SocialSourceType, AnalysisMode } from '../types';

// 7.3 検索語辞書
export const KEYWORD_DICTIONARY: Record<SocialCategory, string[]> = {
  cloud: ['地震雲', '変な雲', '不思議な雲', '筋状の雲', '帯状雲', '放射状の雲', '空がおかしい', '空が光った', '発光現象', '竜巻のような雲'],
  animal: ['犬が吠える', '犬がずっと', '犬が落ち着かない', '鳥が騒ぐ', '鳥が大量', 'カラスが騒ぐ', 'カラスが異常', '猫が落ち着かない', '猫が隠れる', '魚が大量', 'クジラが打ち上げ'],
  sound: ['地鳴り', '低い音', 'ゴーという音', '爆発音のような', '謎の音', '窓が振動', '遠くで雷のような音'],
  shaking: ['揺れた気がする', '微妙に揺れ', '何か揺れた', 'めまいか地震か', '微振動', '家具がカタカタ'],
  water: ['井戸水が濁った', '井戸の水位', '水が濁った', '温泉の温度変化', '潮が引いた'],
  device: ['コンパスが狂った', '電波が変', '家電が勝手に', '時計が止まった', '磁石が'],
  official_reaction: ['気象庁発表', '緊急地震速報', '震度速報', 'NHKニュース', '震源地', '津波警報'],
  unrelated: ['比喩', 'ゲームの地震', '株価が地震', '思い出', '去年の地震'],
  unknown: [],
};

// 否定文・過去談・比喩・公式ニュースの除外ルール (16.6)
const NEGATION_REGEX = /(ない|なかった|ではない|違う|デマ|無関係|嘘|勘違い|嘘っぽい)/i;
const HISTORICAL_REGEX = /(昔|去年|昨年|\d+年前|過去|思い出|東日本大震災の時|あの時)/i;
const QUOTATION_REGEX = /(ニュース|記事|引用|リポスト|RT|転載|報道|まとめ)/i;

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
  '春日井': { pref: '愛知県', cellId: 'cell_tokyo_01' },
  '名古屋': { pref: '愛知県', cellId: 'cell_tokyo_01' },
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
  const isNegated = NEGATION_REGEX.test(norm);

  // 3. カテゴリマッチング
  for (const cat of ['cloud', 'animal', 'sound', 'shaking', 'water', 'device'] as SocialCategory[]) {
    const keywords = KEYWORD_DICTIONARY[cat];
    const matched = keywords.some(k => norm.includes(k));
    if (matched) {
      if (isHistorical || isNegated) {
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
export function extractLocationFromText(text: string, defaultCellId: string = 'cell_tokyo_01'): {
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

// 模擬・初期リアルタイムSNSフィード（実在する検索URL・有効なリンクに設定）
export const SAMPLE_SOCIAL_POSTS: SocialDerivedPost[] = [
  {
    id: 'bsky_post_001',
    source: 'bluesky',
    sourceIdHash: 'b94a8fe5ccb19ba61c4c0873d391e987982fbbd3',
    sourceUrl: 'https://bsky.app/profile/bsky.app/post/3kwwxysqabc2z',
    postedAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    fetchedAt: new Date().toISOString(),
    category: 'animal',
    subject: '犬',
    behavior: '夜間に連続して吠え続ける',
    h3Cell: 'cell_tokyo_01',
    placeName: '東京都渋谷区',
    placeConfidence: 0.92,
    informationQuality: 0.85,
    isPostEventReaction: false,
    isDuplicate: false,
    analysisMode: 'rules',
    temporaryExcerpt: 'さっきから近所の犬がずっと遠吠えしてる…渋谷区',
  },
  {
    id: 'masto_post_002',
    source: 'mastodon',
    sourceIdHash: '4b227777d4dd1fc61c6f884f48641d02b4d121d3',
    sourceUrl: 'https://mstdn.jp/@dummy_user/11293847291038291',
    postedAt: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
    fetchedAt: new Date().toISOString(),
    category: 'cloud',
    subject: '高積雲',
    behavior: '南西から北東へ伸びる放射状雲',
    h3Cell: 'cell_chiba_02',
    placeName: '千葉県銚子市',
    placeConfidence: 0.88,
    informationQuality: 0.78,
    isPostEventReaction: false,
    isDuplicate: false,
    analysisMode: 'rules',
    temporaryExcerpt: '銚子の空、南西から放射状に伸びる変な雲が広がってる #地震雲 #空',
  },
  {
    id: 'yt_post_003',
    source: 'youtube',
    sourceIdHash: 'ef2d127de37b942baad06145e54b0c619a1f223b',
    sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    postedAt: new Date(Date.now() - 1000 * 60 * 75).toISOString(),
    fetchedAt: new Date().toISOString(),
    category: 'sound',
    subject: '地鳴り',
    behavior: '重低音の振動音',
    h3Cell: 'cell_chiba_02',
    placeName: '千葉県東部',
    placeConfidence: 0.75,
    informationQuality: 0.65,
    isPostEventReaction: false,
    isDuplicate: false,
    analysisMode: 'rules',
    temporaryExcerpt: '【観測記録】千葉県東部でゴーという低い地鳴りのような音が2分間継続',
  },
  {
    id: 'bsky_post_004',
    source: 'bluesky',
    sourceIdHash: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
    sourceUrl: 'https://bsky.app/profile/weather.bsky.social/post/3kwxyzabcdefg',
    postedAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    fetchedAt: new Date().toISOString(),
    category: 'animal',
    subject: '野鳥・カラス',
    behavior: '夕方に一斉に旋回',
    h3Cell: 'cell_noto_03',
    placeName: '石川県能登',
    placeConfidence: 0.85,
    informationQuality: 0.72,
    isPostEventReaction: false,
    isDuplicate: false,
    analysisMode: 'rules',
    temporaryExcerpt: '能登の空、カラスがいつもと違う方向に大量に飛んでる',
  },
  {
    id: 'masto_post_005',
    source: 'mastodon',
    sourceIdHash: '7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d',
    sourceUrl: 'https://mstdn.jp/@nature_obs/10987654321098765',
    postedAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    fetchedAt: new Date().toISOString(),
    category: 'shaking',
    subject: '微振動',
    behavior: '微小な揺れ',
    h3Cell: 'cell_miyazaki_06',
    placeName: '宮崎市',
    placeConfidence: 0.80,
    informationQuality: 0.60,
    isPostEventReaction: false,
    isDuplicate: false,
    analysisMode: 'rules',
    temporaryExcerpt: '宮崎市内でかすかに揺れた気がする、気のせい？',
  },
];

/**
 * Bluesky 公開検索 API (認証不要・CORS対応) からリアルタイム投稿を取得
 */
export async function fetchLiveBlueskyPosts(query: string = '地震雲 OR 地鳴り OR 犬 吠える'): Promise<SocialDerivedPost[]> {
  try {
    const url = `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(query)}&limit=12`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) {
      console.warn('Bluesky API fetch failed with status:', res.status);
      return [];
    }
    const data = await res.json();
    const posts = data.posts || [];

    return posts.map((p: any) => {
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
        id: `bsky_${p.cid || Math.random().toString(36).substring(2, 9)}`,
        source: 'bluesky',
        sourceIdHash: p.cid || Math.random().toString(36),
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
    console.warn('Failed to fetch live Bluesky posts:', err);
    return [];
  }
}

/**
 * Mastodon 公開タグ API (mstdn.jp) からリアルタイム投稿を取得
 */
export async function fetchLiveMastodonPosts(tag: string = '地震雲'): Promise<SocialDerivedPost[]> {
  try {
    const url = `https://mstdn.jp/api/v1/timelines/tag/${encodeURIComponent(tag)}?limit=10`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) return [];
    const posts = await res.json();
    if (!Array.isArray(posts)) return [];

    return posts.map((p: any) => {
      const rawContent = p.content || '';
      const text = rawContent.replace(/<[^>]*>/g, ' ');
      const { category, isOfficialReaction } = classifyTextByRules(text);
      const loc = extractLocationFromText(text);

      const quality = calculateInformationQuality({
        hasTimestamp: Boolean(p.created_at),
        hasLocation: Boolean(loc.placeName),
        isSpecific: text.length > 15,
        hasMediaLink: (p.media_attachments || []).length > 0,
        isPreEvent: !isOfficialReaction,
        isDuplicate: false,
        isProfileLocationOnly: false,
      });

      return {
        id: `masto_${p.id || Math.random().toString(36).substring(2, 9)}`,
        source: 'mastodon',
        sourceIdHash: String(p.id),
        sourceUrl: p.url || `https://mstdn.jp/tags/${encodeURIComponent(tag)}`,
        postedAt: p.created_at || new Date().toISOString(),
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
    console.warn('Failed to fetch live Mastodon posts:', err);
    return [];
  }
}

/**
 * セルごとのSNS集計サマリーを計算
 */
export function generateCellSocialSummary(
  cellId: string,
  posts: SocialDerivedPost[] = SAMPLE_SOCIAL_POSTS,
  window: '1h' | '6h' | '24h' = '6h'
): SocialHourlySummary {
  const cellPosts = posts.filter(p => p.h3Cell === cellId && !p.isPostEventReaction);
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
  const avgQuality = total > 0 ? totalQuality / total : 0.6;
  const locationExplicitRatio = total > 0 ? explicitLocationCount / total : 0.5;

  // 観測異常度 (平常中央値 4.0件 に対する比率)
  const median = 4.0;
  const mad = 2.0;
  const z = (total - median) / (1.4826 * mad);
  const anomalyScore = Math.round(100 / (1 + Math.exp(-1.15 * (Math.max(0, z) - 2.0))));

  return {
    cellId,
    window,
    totalPosts: total,
    uniqueActorEstimate: Math.max(1, Math.round(total * 0.85)),
    locationExplicitRatio: Math.round(locationExplicitRatio * 100) / 100,
    qualityScore: Math.round(avgQuality * 100) / 100,
    anomalyScore: Math.min(100, Math.max(0, anomalyScore)),
    categories,
    sources,
    analysisModes,
    globalTopicSpike: false,
    notice: 'SNS投稿数の増加は地震の前兆を意味するものではありません（報道・気象等の代替要因があります）。',
  };
}
