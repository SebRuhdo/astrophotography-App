// Polarlicht-Daten von NOAA SWPC (https://www.swpc.noaa.gov), frei verfügbar, CORS erlaubt.

const BASE = 'https://services.swpc.noaa.gov';

export interface KpEntry {
  t: Date; // Beginn des 3-h-Blocks (UTC)
  kp: number;
  kind: 'observed' | 'estimated' | 'predicted';
  gScale: string | null; // z. B. "G1"
}

export interface OvationData {
  observationTime: Date;
  forecastTime: Date;
  /** Wahrscheinlichkeit (%) auf 1°-Raster: grid[lon 0..359][lat −90..90] */
  get: (lat: number, lon: number) => number;
}

const memo = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, maxAgeMin: number, load: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < maxAgeMin * 60000) return hit.value as T;
  const value = await load();
  memo.set(key, { at: Date.now(), value });
  return value;
}

async function getJson(path: string, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, { signal });
  if (!res.ok) throw new Error(`NOAA: HTTP ${res.status}`);
  return res.json();
}

/** Kp-Index: letzte beobachtete Werte + 3-Tage-Vorhersage (3-h-Blöcke). */
export function fetchKpForecast(signal?: AbortSignal): Promise<KpEntry[]> {
  return cached('kp', 15, async () => {
    const raw = (await getJson('/products/noaa-planetary-k-index-forecast.json', signal)) as {
      time_tag: string;
      kp: number;
      observed: string;
      noaa_scale: string | null;
    }[];
    return raw.map((r) => ({
      t: new Date(`${r.time_tag}Z`),
      kp: Number(r.kp),
      kind: (['observed', 'estimated', 'predicted'].includes(r.observed) ? r.observed : 'predicted') as KpEntry['kind'],
      gScale: r.noaa_scale,
    }));
  });
}

/** OVATION-Modell: Polarlicht-Wahrscheinlichkeit für die nächsten ~30–90 Minuten. */
export function fetchOvation(signal?: AbortSignal): Promise<OvationData> {
  return cached('ovation', 10, async () => {
    const raw = (await getJson('/json/ovation_aurora_latest.json', signal)) as {
      'Observation Time': string;
      'Forecast Time': string;
      coordinates: [number, number, number][];
    };
    const grid = new Uint8Array(360 * 181);
    for (const [lo, la, v] of raw.coordinates) grid[(((Math.round(lo) % 360) + 360) % 360) * 181 + (Math.round(la) + 90)] = v;
    return {
      observationTime: new Date(raw['Observation Time']),
      forecastTime: new Date(raw['Forecast Time']),
      get: (lat, lon) => {
        const la = Math.max(-90, Math.min(90, Math.round(lat)));
        const lo = ((Math.round(lon) % 360) + 360) % 360;
        return grid[lo * 181 + (la + 90)];
      },
    };
  });
}

export const ovationImageUrl = (lat: number) =>
  `${BASE}/images/animations/ovation/${lat >= 0 ? 'north' : 'south'}/latest.jpg`;

// ---------------------------------------------------------------------------
// Geomagnetische Breite (zentrierter Dipol)
// Geomagnetischer Nordpol 2025.0 laut NOAA NCEI (WMM2025): 80,85° N, 72,76° W
// ---------------------------------------------------------------------------
const POLE_LAT = 80.85;
const POLE_LON = -72.76;
const rad = Math.PI / 180;

export function geomagneticLatitude(lat: number, lon: number): number {
  const s =
    Math.sin(lat * rad) * Math.sin(POLE_LAT * rad) +
    Math.cos(lat * rad) * Math.cos(POLE_LAT * rad) * Math.cos((lon - POLE_LON) * rad);
  return Math.asin(Math.max(-1, Math.min(1, s))) / rad;
}

/**
 * NOAA Space Weather Scales: geomagnetische Breite, bis zu der Polarlicht bei der jeweiligen
 * Sturmstufe typischerweise gesehen wurde. Kp 5 = G1, 6 = G2, 7 = G3, 8 = G4, 9 = G5.
 * NOAA zählt dabei bereits die „Minus“-Stufe mit (z. B. Kp 5− = 4,67 → G1), siehe `noaa_scale` in den Daten.
 */
export const G_SCALE = [
  { g: 'G1', kp: 5, geomagLat: 60 },
  { g: 'G2', kp: 6, geomagLat: 55 },
  { g: 'G3', kp: 7, geomagLat: 50 },
  { g: 'G4', kp: 8, geomagLat: 45 },
  { g: 'G5', kp: 9, geomagLat: 40 },
] as const;

/** Niedrigste Sturmstufe, bei der Polarlicht an dieser geomagn. Breite typischerweise sichtbar ist. */
export function requiredStorm(geomagLat: number): (typeof G_SCALE)[number] | null {
  const a = Math.abs(geomagLat);
  if (a >= 60) return G_SCALE[0];
  return G_SCALE.find((s) => a >= s.geomagLat) ?? null;
}

/** Kp-Wert ab dem eine Stufe gilt (inkl. „Minus“-Drittel, z. B. 5− = 4,67). */
export const kpThreshold = (kp: number) => kp - 1 / 3 - 1e-6;

/** Darstellung wie in der Kp-Notation: 4,67 → „5−“, 5,33 → „5+“. */
export function kpLabel(kp: number): string {
  const whole = Math.round(kp);
  const frac = kp - whole;
  return `${whole}${frac > 0.15 ? '+' : frac < -0.15 ? '−' : ''}`;
}

export function kpColor(kp: number): string {
  if (kp >= kpThreshold(7)) return 'var(--bad)';
  if (kp >= kpThreshold(6)) return '#ff9f43';
  if (kp >= kpThreshold(5)) return 'var(--mid)';
  if (kp >= kpThreshold(4)) return '#9ad16a';
  return 'var(--good)';
}
