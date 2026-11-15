// Wetterdaten von Open-Meteo (https://open-meteo.com, CC BY 4.0, kostenlos für nicht-kommerzielle Nutzung)

export interface WeatherHour {
  t: Date;
  cloud: number; // %
  cloudLow: number;
  cloudMid: number;
  cloudHigh: number;
  temp: number; // °C
  dewPoint: number; // °C
  humidity: number; // %
  wind: number; // km/h
  gusts: number; // km/h
  visibility: number | null; // m
  precipProb: number | null; // %
  jet: number | null; // km/h, Wind in 250 hPa (~10 km Höhe)
}

export interface WeatherData {
  fetchedAt: number;
  /** true = Netzwerk nicht erreichbar, es werden zwischengespeicherte Daten angezeigt */
  stale?: boolean;
  staleReason?: string;
  timezone: string;
  elevation: number;
  hours: WeatherHour[];
}

const BASE_VARS = [
  'cloud_cover',
  'cloud_cover_low',
  'cloud_cover_mid',
  'cloud_cover_high',
  'temperature_2m',
  'dew_point_2m',
  'relative_humidity_2m',
  'wind_speed_10m',
  'wind_gusts_10m',
  'visibility',
  'precipitation_probability',
];
const JET_VAR = 'wind_speed_250hPa';

const CACHE_MIN = 30; // danach neu laden
const STALE_MAX_H = 7 * 24; // ältere Daten auch offline nicht mehr anzeigen
const cacheKey = (lat: number, lon: number) => `wx:${lat.toFixed(3)},${lon.toFixed(3)}`;

function buildUrl(lat: number, lon: number, withJet: boolean): string {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    hourly: [...BASE_VARS, ...(withJet ? [JET_VAR] : [])].join(','),
    forecast_days: '8',
    timezone: 'auto',
    timeformat: 'unixtime',
    wind_speed_unit: 'kmh',
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

type Raw = {
  timezone: string;
  elevation: number;
  hourly: Record<string, (number | null)[]>;
};

function parse(raw: Raw): WeatherData {
  const h = raw.hourly;
  const n = (k: string, i: number) => (h[k]?.[i] ?? null) as number | null;
  const hours: WeatherHour[] = (h.time as number[]).map((sec, i) => ({
    t: new Date(sec * 1000),
    cloud: n('cloud_cover', i) ?? 0,
    cloudLow: n('cloud_cover_low', i) ?? 0,
    cloudMid: n('cloud_cover_mid', i) ?? 0,
    cloudHigh: n('cloud_cover_high', i) ?? 0,
    temp: n('temperature_2m', i) ?? NaN,
    dewPoint: n('dew_point_2m', i) ?? NaN,
    humidity: n('relative_humidity_2m', i) ?? NaN,
    wind: n('wind_speed_10m', i) ?? NaN,
    gusts: n('wind_gusts_10m', i) ?? NaN,
    visibility: n('visibility', i),
    precipProb: n('precipitation_probability', i),
    jet: n(JET_VAR, i),
  }));
  return { fetchedAt: Date.now(), timezone: raw.timezone, elevation: raw.elevation, hours };
}

function readCache(lat: number, lon: number): { fetchedAt: number; raw: Raw } | null {
  try {
    const cached = localStorage.getItem(cacheKey(lat, lon));
    return cached ? (JSON.parse(cached) as { fetchedAt: number; raw: Raw }) : null;
  } catch {
    return null;
  }
}

export async function fetchWeather(lat: number, lon: number, signal?: AbortSignal): Promise<WeatherData> {
  const cache = readCache(lat, lon);
  const age = cache ? Date.now() - cache.fetchedAt : Infinity;
  if (cache && age < CACHE_MIN * 60000) return { ...parse(cache.raw), fetchedAt: cache.fetchedAt };

  const fallback = (reason: string): WeatherData => {
    if (cache && age < STALE_MAX_H * 3600000) return { ...parse(cache.raw), fetchedAt: cache.fetchedAt, stale: true, staleReason: reason };
    throw new Error(reason);
  };

  if (typeof navigator !== 'undefined' && navigator.onLine === false) return fallback('Keine Internetverbindung');

  let res: Response;
  try {
    res = await fetch(buildUrl(lat, lon, true), { signal });
    if (res.status === 400) res = await fetch(buildUrl(lat, lon, false), { signal }); // Fallback ohne Höhenwind
  } catch (e) {
    if (signal?.aborted) throw e;
    return fallback('Keine Verbindung zum Wetterdienst');
  }
  if (!res.ok) {
    let reason = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j?.reason) reason = j.reason;
    } catch {
      /* ignorieren */
    }
    return fallback(reason);
  }
  const raw = (await res.json()) as Raw;
  try {
    localStorage.setItem(cacheKey(lat, lon), JSON.stringify({ fetchedAt: Date.now(), raw }));
  } catch {
    /* Cache optional */
  }
  return parse(raw);
}

/** „vor 3 h“, „vor 25 min“ … */
export function ageText(fetchedAt: number): string {
  const min = Math.max(0, Math.round((Date.now() - fetchedAt) / 60000));
  if (min < 60) return `vor ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `vor ${h} h`;
  return `vor ${Math.round(h / 24)} Tagen`;
}

/** Stunden, deren Zeitstempel im Intervall liegt. */
export function hoursIn(w: WeatherData | null, start: Date, end: Date): WeatherHour[] {
  if (!w) return [];
  return w.hours.filter((h) => h.t >= start && h.t <= end);
}

/** URL der 7Timer!-ASTRO-Grafik (Seeing, Transparenz; 3 Tage). Als Bild einbettbar. */
export function sevenTimerImageUrl(lat: number, lon: number): string {
  const p = new URLSearchParams({
    lon: lon.toFixed(3),
    lat: lat.toFixed(3),
    ac: '0',
    lang: 'en',
    unit: 'metric',
    output: 'internal',
    tzshift: '0',
  });
  return `https://www.7timer.info/bin/astro.php?${p}`;
}

/** Faustregel: starker Höhenwind (Jetstream) verschlechtert das Seeing. */
export function jetClass(kmh: number | null): 'gut' | 'mittel' | 'schlecht' | null {
  if (kmh === null || Number.isNaN(kmh)) return null;
  if (kmh < 70) return 'gut';
  if (kmh < 130) return 'mittel';
  return 'schlecht';
}
