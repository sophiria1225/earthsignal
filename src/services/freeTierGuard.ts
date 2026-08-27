/**
 * EarthSignal - Free Tier Quota Guard & Kill Switch Service (v2.0)
 * Manages daily API budgets, soft/hard limits, degraded fallbacks, and data source kill switches
 */

import { FreeTierStatus, KillSwitchSettings, DataSourceHealth, ResourceUsage } from '../types';

// 初期キルスイッチ設定 (v2.0)
export const DEFAULT_KILL_SWITCHES: KillSwitchSettings = {
  bluesky: true,
  mastodon: true,
  misskey: false, // 任意・初期OFF
  youtube: false,  // クォータ節約のため初期OFF
  workersAi: true,
  userReports: true,
  p2pQuake: true,
  openMeteo: true,
};

// 23.2 アプリ内初期上限と日次使用量シミュレータ
let currentUsageState: FreeTierStatus = {
  dateUtc: new Date().toISOString().slice(0, 10),
  systemOverallState: 'normal',
  resources: [
    {
      resourceKey: 'workers_api',
      name: 'Cloudflare Workers API',
      used: 14280,
      softLimit: 50000,
      hardLimit: 70000, // 無料上限100kに対し安全値70k
      unit: 'req/日',
      state: 'normal',
      fallbackDescription: '50,000超でCDNキャッシュTTLを5分から15分へ自動延長',
    },
    {
      resourceKey: 'd1_writes',
      name: 'Cloudflare D1 行書き込み',
      used: 8430,
      softLimit: 20000,
      hardLimit: 30000, // 無料上限100kに対し安全値30k
      unit: '行/日',
      state: 'normal',
      fallbackDescription: '上限接近時にSNS個別投稿の保存を停止し1時間集計のみ記録',
    },
    {
      resourceKey: 'open_meteo',
      name: 'Open-Meteo 気象API',
      used: 320,
      softLimit: 5000,
      hardLimit: 8000, // 非商用10,000に対し8,000
      unit: '回/日',
      state: 'normal',
      fallbackDescription: '閲覧中の優先セルのみ更新間隔を30分から2時間へ自動延長',
    },
    {
      resourceKey: 'bluesky',
      name: 'Bluesky 公開検索',
      used: 68,
      softLimit: 80,
      hardLimit: 96,
      unit: '回/日',
      state: 'normal',
      fallbackDescription: '4検索語を15分ごとにローテーション。429検知時は12時間自動休止',
    },
    {
      resourceKey: 'mastodon',
      name: 'Mastodon ハッシュタグ',
      used: 142,
      softLimit: 200,
      hardLimit: 288,
      unit: '回/日',
      state: 'normal',
      fallbackDescription: '許可リスト登録の3インスタンス間を指数バックオフで分散取得',
    },
    {
      resourceKey: 'youtube',
      name: 'YouTube Data API',
      used: 8,
      softLimit: 15,
      hardLimit: 20,
      unit: '回/日',
      state: 'normal',
      fallbackDescription: 'クォータ消耗防止のため1日最大20回。超過時は他SNSで代替',
    },
    {
      resourceKey: 'workers_ai',
      name: 'Workers AI / LLM構造化',
      used: 3420,
      softLimit: 6000,
      hardLimit: 8000, // 無料上限10,000 neuronsに対し8,000
      unit: 'Neurons/日',
      state: 'normal',
      fallbackDescription: '上限到達時は辞書・正規表現ルール分類器へ100%自動フォールバック',
    },
  ],
  sources: [
    {
      sourceName: 'p2pquake',
      displayName: 'P2P地震情報 API v2',
      enabled: true,
      priority: 10,
      dailyCallsUsed: 280,
      dailyCallsLimit: 1000,
      lastSuccessAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
      latencyMs: 142,
      status: 'ok',
    },
    {
      sourceName: 'open_meteo',
      displayName: 'Open-Meteo Weather API',
      enabled: true,
      priority: 10,
      dailyCallsUsed: 320,
      dailyCallsLimit: 8000,
      lastSuccessAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      latencyMs: 230,
      status: 'ok',
    },
    {
      sourceName: 'bluesky',
      displayName: 'Bluesky Public AppView',
      enabled: true,
      priority: 30,
      dailyCallsUsed: 68,
      dailyCallsLimit: 96,
      lastSuccessAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      latencyMs: 310,
      status: 'ok',
    },
    {
      sourceName: 'mastodon',
      displayName: 'Mastodon Fediverse Timeline',
      enabled: true,
      priority: 40,
      dailyCallsUsed: 142,
      dailyCallsLimit: 288,
      lastSuccessAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
      latencyMs: 290,
      status: 'ok',
    },
    {
      sourceName: 'youtube',
      displayName: 'YouTube Data API (Optional)',
      enabled: false,
      priority: 60,
      dailyCallsUsed: 8,
      dailyCallsLimit: 20,
      lastSuccessAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      latencyMs: 420,
      status: 'disabled',
    },
    {
      sourceName: 'workers_ai',
      displayName: 'Workers AI (Llama-3.2 / Qwen)',
      enabled: true,
      priority: 10,
      dailyCallsUsed: 42,
      dailyCallsLimit: 100,
      lastSuccessAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      latencyMs: 510,
      status: 'ok',
    },
  ],
  killSwitches: DEFAULT_KILL_SWITCHES,
};

export function getFreeTierStatus(): FreeTierStatus {
  return currentUsageState;
}

export function updateKillSwitch(key: keyof KillSwitchSettings, value: boolean): FreeTierStatus {
  currentUsageState = {
    ...currentUsageState,
    killSwitches: {
      ...currentUsageState.killSwitches,
      [key]: value,
    },
    sources: currentUsageState.sources.map(src => {
      if (src.sourceName === key || (key === 'workersAi' && src.sourceName === 'workers_ai') || (key === 'openMeteo' && src.sourceName === 'open_meteo') || (key === 'p2pQuake' && src.sourceName === 'p2pquake')) {
        return {
          ...src,
          enabled: value,
          status: value ? 'ok' : 'disabled',
        };
      }
      return src;
    }),
  };
  return currentUsageState;
}

/**
 * リソース使用量の安全チェック
 */
export function checkResourceAvailable(resourceKey: string, requestAmount: number = 1): {
  available: boolean;
  state: 'normal' | 'soft_limit' | 'hard_limit';
} {
  const res = currentUsageState.resources.find(r => r.resourceKey === resourceKey);
  if (!res) return { available: true, state: 'normal' };

  if (res.used + requestAmount > res.hardLimit) {
    return { available: false, state: 'hard_limit' };
  }
  if (res.used + requestAmount > res.softLimit) {
    return { available: true, state: 'soft_limit' };
  }
  return { available: true, state: 'normal' };
}

/**
 * リソース利用量を記録
 */
export function incrementResourceUsage(resourceKey: string, amount: number = 1): void {
  currentUsageState = {
    ...currentUsageState,
    resources: currentUsageState.resources.map(r => {
      if (r.resourceKey === resourceKey) {
        const newUsed = r.used + amount;
        let newState: 'normal' | 'soft_limit_exceeded' | 'stopped_for_today' = 'normal';
        if (newUsed >= r.hardLimit) {
          newState = 'stopped_for_today';
        } else if (newUsed >= r.softLimit) {
          newState = 'soft_limit_exceeded';
        }
        return {
          ...r,
          used: newUsed,
          state: newState,
        };
      }
      return r;
    }),
  };
}
