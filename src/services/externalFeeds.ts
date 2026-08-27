/**
 * EarthSignal - External Data Feeds Pipeline
 * Implements Section 14 of Requirements Document v1.0
 * P2P Earthquake API v2 & Open-Meteo Weather Integration
 */

import { Earthquake, WeatherObservation } from '../types';

export interface EarthquakeFeedResult {
  earthquakes: Earthquake[];
  isLive: boolean;
  fetchedAt: string;
  error?: string;
}

export interface WeatherFeedResult {
  weather: WeatherObservation | null;
  isLive: boolean;
  fetchedAt: string;
  error?: string;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function medianAndMad(values: number[]): { median: number; mad: number } {
  const center = median(values);
  const mad = median(values.map(value => Math.abs(value - center)));
  return {
    median: Math.round(center * 10) / 10,
    mad: Math.max(0.1, Math.round(mad * 10) / 10),
  };
}

export function normalizeP2PTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const trimmed = value.trim();
  const jstMatch = trimmed.match(/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  const normalized = jstMatch
    ? `${jstMatch[1]}-${jstMatch[2]}-${jstMatch[3]}T${jstMatch[4]}:${jstMatch[5]}:${jstMatch[6]}+09:00`
    : trimmed;
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

/**
 * P2P地震情報 API v2 (/v2/history?codes=551) から最新地震データを取得
 */
export async function fetchP2PEarthquakesFromSource(
  limit = 100,
  signal?: AbortSignal
): Promise<EarthquakeFeedResult> {
  try {
    const url = `https://api.p2pquake.net/v2/history?codes=551&limit=${limit}`;
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal,
    });

    if (!response.ok) {
      throw new Error(`P2P API returned ${response.status}`);
    }

    const rawData = await response.json();
    if (!Array.isArray(rawData)) {
      throw new Error('Invalid response structure from P2P Earthquake API');
    }

    const earthquakes: Earthquake[] = rawData
      .filter((item: any) =>
        item.code === 551
        && item.earthquake
        && Number.isFinite(item.earthquake.hypocenter?.latitude)
        && Number.isFinite(item.earthquake.hypocenter?.longitude)
        && item.earthquake.hypocenter.latitude >= -90
        && item.earthquake.hypocenter.latitude <= 90
        && item.earthquake.hypocenter.longitude >= -180
        && item.earthquake.hypocenter.longitude <= 180
        && normalizeP2PTimestamp(item.earthquake.time || item.time)
      )
      .map((item: any) => {
        const eq = item.earthquake;
        const hyp = eq.hypocenter || {};
        
        let maxIntStr: string | null = null;
        if (Number.isFinite(eq.maxScale) && eq.maxScale > 0) {
          // P2P maxScale: 10->1, 20->2, 30->3, 40->4, 45->5弱, 50->5強, 55->6弱, 60->6強, 70->7
          const scaleMap: Record<number, string> = {
            10: '1',
            20: '2',
            30: '3',
            40: '4',
            45: '5弱',
            50: '5強',
            55: '6弱',
            60: '6強',
            70: '7',
          };
          maxIntStr = scaleMap[eq.maxScale] || String(eq.maxScale / 10);
        }

        let tsunami: Earthquake['tsunamiStatus'] = 'none';
        if (eq.domesticTsunami === 'Warning') tsunami = 'warning';
        else if (eq.domesticTsunami === 'Watch') tsunami = 'watch';
        else if (eq.domesticTsunami === 'Checking') tsunami = 'checking';
        else if (eq.domesticTsunami === 'NonEffective') tsunami = 'non_effective';

        return {
          id: item.id || `eq_${item._id || Date.now()}`,
          occurredAt: normalizeP2PTimestamp(eq.time || item.time)!,
          hypocenterName: hyp.name || '震源地情報取得中',
          latitude: hyp.latitude,
          longitude: hyp.longitude,
          depthKm: hyp.depth !== undefined && hyp.depth >= 0 ? hyp.depth : null,
          magnitude: hyp.magnitude !== undefined && hyp.magnitude > 0 ? hyp.magnitude : null,
          maxIntensity: maxIntStr,
          tsunamiStatus: tsunami,
          source: 'p2pquake',
          sourceEventId: item.id,
          revision: item.issue?.type === 'Correction' ? 2 : 1,
          updatedAt: normalizeP2PTimestamp(item.created_at || item.time || eq.time) || new Date().toISOString(),
        };
      });

    return {
      earthquakes,
      isLive: true,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    console.warn('P2P Earthquake fetch failed:', err.message);
    return {
      earthquakes: [],
      isLive: false,
      fetchedAt: new Date().toISOString(),
      error: err.message,
    };
  }
}

/**
 * Open-Meteo API から指定座標のリアルタイム気象・雲量・気圧データを取得
 */
export async function fetchOpenMeteoWeatherFromSource(
  cellId: string,
  latitude: number,
  longitude: number,
  signal?: AbortSignal
): Promise<WeatherFeedResult> {
  try {
    const hourlyVariables = 'pressure_msl,cloud_cover_high,temperature_2m';
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,pressure_msl&hourly=${hourlyVariables}&past_days=30&forecast_days=1&timezone=Asia%2FTokyo`;

    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`Open-Meteo returned status ${res.status}`);

    const data = await res.json();
    const curr = data.current || {};
    const requiredCurrent = [
      'temperature_2m', 'relative_humidity_2m', 'precipitation', 'weather_code',
      'surface_pressure', 'wind_speed_10m', 'wind_direction_10m', 'cloud_cover',
      'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high', 'pressure_msl',
    ];
    if (!curr.time || requiredCurrent.some(key => !Number.isFinite(curr[key]))) {
      throw new Error('Open-Meteo response is missing required current fields');
    }

    const hourlyTimes: string[] = Array.isArray(data.hourly?.time) ? data.hourly.time : [];
    const pressureValues: number[] = Array.isArray(data.hourly?.pressure_msl) ? data.hourly.pressure_msl : [];
    const highCloudValues: number[] = Array.isArray(data.hourly?.cloud_cover_high) ? data.hourly.cloud_cover_high : [];
    const temperatureValues: number[] = Array.isArray(data.hourly?.temperature_2m) ? data.hourly.temperature_2m : [];
    const currentTime = String(curr.time || '');
    // current は15分刻み、hourly は毎正時になる場合があるため「同じ年月日・時」で対応付ける。
    const currentHour = currentTime.slice(0, 13);
    const currentIndex = hourlyTimes.findIndex(time => time.slice(0, 13) === currentHour);
    if (currentIndex < 0) {
      throw new Error('Open-Meteo current observation could not be matched to hourly history');
    }

    // 現在時刻と24時間前の同時刻を比較する。
    let pressureChange24h = 0;
    if (currentIndex >= 24 && Number.isFinite(pressureValues[currentIndex]) && Number.isFinite(pressureValues[currentIndex - 24])) {
      pressureChange24h = Math.round((pressureValues[currentIndex] - pressureValues[currentIndex - 24]) * 10) / 10;
    }

    // 過去30日の同じ時刻だけを抽出し、日内変動を混ぜない平常値を作る。
    const sameHourIndices = hourlyTimes
      .map((time, index) => ({ time, index }))
      .filter(({ time, index }) => time.slice(11, 13) === currentTime.slice(11, 13) && index < currentIndex)
      .map(({ index }) => index)
      .slice(-30);
    const cloudBaseline = sameHourIndices.map(index => highCloudValues[index]).filter(Number.isFinite);
    const temperatureBaseline = sameHourIndices.map(index => temperatureValues[index]).filter(Number.isFinite);
    const pressureDeltaBaseline = sameHourIndices
      .filter(index => index >= 24)
      .map(index => pressureValues[index] - pressureValues[index - 24])
      .filter(Number.isFinite);

    const weather: WeatherObservation = {
      cellId,
      observedAt: curr.time || new Date().toISOString(),
      cloudCoverTotal: curr.cloud_cover,
      cloudCoverLow: curr.cloud_cover_low,
      cloudCoverMid: curr.cloud_cover_mid,
      cloudCoverHigh: curr.cloud_cover_high,
      pressureMsl: curr.pressure_msl,
      surfacePressure: curr.surface_pressure,
      pressureChange24h,
      relativeHumidity: curr.relative_humidity_2m,
      precipitation: curr.precipitation,
      windSpeed: curr.wind_speed_10m,
      windDirection: curr.wind_direction_10m,
      temperature: curr.temperature_2m,
      weatherCode: curr.weather_code,
      fetchedAt: new Date().toISOString(),
      isStale: false,
      baseline: {
        periodDays: 30,
        sampleCount: Math.min(cloudBaseline.length, temperatureBaseline.length, pressureDeltaBaseline.length),
        cloudCoverHigh: medianAndMad(cloudBaseline),
        pressureChange24h: medianAndMad(pressureDeltaBaseline),
        temperature: medianAndMad(temperatureBaseline),
      },
    };
    return { weather, isLive: true, fetchedAt: weather.fetchedAt };
  } catch (err: any) {
    console.warn(`Open-Meteo fetch failed for cell ${cellId}:`, err.message);
    return {
      weather: null,
      isLive: false,
      fetchedAt: new Date().toISOString(),
      error: err.message,
    };
  }
}

/** ブラウザ用: 同一オリジンのサーバープロキシから取得する。 */
export async function fetchP2PEarthquakes(limit = 100): Promise<EarthquakeFeedResult> {
  const response = await fetch(`/api/data/earthquakes?limit=${Math.min(100, Math.max(1, limit))}`);
  if (!response.ok) throw new Error(`地震情報APIが ${response.status} を返しました`);
  return response.json();
}

/** ブラウザ用: 座標は送らず、サーバー側の許可済みセルIDだけを指定する。 */
export async function fetchOpenMeteoWeather(cellId: string): Promise<WeatherFeedResult> {
  const response = await fetch(`/api/data/weather/${encodeURIComponent(cellId)}`);
  if (!response.ok) throw new Error(`気象情報APIが ${response.status} を返しました`);
  return response.json();
}
