/**
 * EarthSignal - External Data Feeds Pipeline
 * Implements Section 14 of Requirements Document v1.0
 * P2P Earthquake API v2 & Open-Meteo Weather Integration
 */

import { Earthquake, WeatherObservation } from '../types';
import { INITIAL_EARTHQUAKES } from './dataStore';

/**
 * P2P地震情報 API v2 (/v2/history?codes=551) から最新地震データを取得
 */
export async function fetchP2PEarthquakes(limit = 30): Promise<{ earthquakes: Earthquake[]; isLive: boolean; error?: string }> {
  try {
    const url = `https://api.p2pquake.net/v2/history?codes=551&limit=${limit}`;
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`P2P API returned ${response.status}`);
    }

    const rawData = await response.json();
    if (!Array.isArray(rawData)) {
      throw new Error('Invalid response structure from P2P Earthquake API');
    }

    const earthquakes: Earthquake[] = rawData
      .filter((item: any) => item.code === 551 && item.earthquake)
      .map((item: any) => {
        const eq = item.earthquake;
        const hyp = eq.hypocenter || {};
        
        let maxIntStr: string | null = null;
        if (eq.maxScale) {
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
          occurredAt: eq.time || item.time || new Date().toISOString(),
          hypocenterName: hyp.name || '震源地情報取得中',
          latitude: hyp.latitude > 0 ? hyp.latitude : 35.6,
          longitude: hyp.longitude > 0 ? hyp.longitude : 139.7,
          depthKm: hyp.depth !== undefined && hyp.depth >= 0 ? hyp.depth : null,
          magnitude: hyp.magnitude !== undefined && hyp.magnitude > 0 ? hyp.magnitude : null,
          maxIntensity: maxIntStr,
          tsunamiStatus: tsunami,
          source: 'p2pquake',
          sourceEventId: item.id,
          revision: item.issue?.type === 'Correction' ? 2 : 1,
          updatedAt: item.created_at || new Date().toISOString(),
        };
      });

    return {
      earthquakes: earthquakes.length > 0 ? earthquakes : INITIAL_EARTHQUAKES,
      isLive: true,
    };
  } catch (err: any) {
    console.warn('P2P Earthquake fetch fallback to cached/seed data:', err.message);
    return {
      earthquakes: INITIAL_EARTHQUAKES,
      isLive: false,
      error: err.message,
    };
  }
}

/**
 * Open-Meteo API から指定座標のリアルタイム気象・雲量・気圧データを取得
 */
export async function fetchOpenMeteoWeather(
  cellId: string,
  latitude: number,
  longitude: number
): Promise<WeatherObservation | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,pressure_msl&hourly=surface_pressure&past_days=1&forecast_days=1&timezone=Asia%2FTokyo`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open-Meteo returned status ${res.status}`);

    const data = await res.json();
    const curr = data.current || {};

    // 24時間前の気圧と現在気圧の差分
    let pressureChange24h = 0;
    if (data.hourly?.surface_pressure && Array.isArray(data.hourly.surface_pressure)) {
      const sp = data.hourly.surface_pressure;
      if (sp.length >= 25) {
        pressureChange24h = Math.round((sp[sp.length - 1] - sp[sp.length - 25]) * 10) / 10;
      }
    }

    return {
      cellId,
      observedAt: curr.time || new Date().toISOString(),
      cloudCoverTotal: curr.cloud_cover ?? 50,
      cloudCoverLow: curr.cloud_cover_low ?? 20,
      cloudCoverMid: curr.cloud_cover_mid ?? 30,
      cloudCoverHigh: curr.cloud_cover_high ?? 40,
      pressureMsl: curr.pressure_msl ?? 1013.25,
      surfacePressure: curr.surface_pressure ?? 1010.0,
      pressureChange24h,
      relativeHumidity: curr.relative_humidity_2m ?? 60,
      precipitation: curr.precipitation ?? 0.0,
      windSpeed: curr.wind_speed_10m ?? 2.5,
      windDirection: curr.wind_direction_10m ?? 180,
      temperature: curr.temperature_2m ?? 22.0,
      weatherCode: curr.weather_code ?? 0,
      fetchedAt: new Date().toISOString(),
      isStale: false,
    };
  } catch (err: any) {
    console.warn(`Open-Meteo fetch failed for cell ${cellId}:`, err.message);
    return null;
  }
}
