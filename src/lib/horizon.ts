import { ApiLimitError, friendlyApiError } from './apiErrors';

// Horizont-Profil: Gelände (Copernicus DEM GLO-90 über die Open-Meteo Elevation API) + vor Ort erfasste Punkte.

// Die kostenlose Open-Meteo-API zählt jeden Koordinatenpunkt als Aufruf (Limit 600/min, 5000/h, 10 000/Tag je IP).
// Daher dreistufig: 36 Richtungen × 9 Entfernungen (grob), dann je 4 und 3 Punkte rund um den jeweils
// höchsten Fund (fein) + Standort = 577 Punkte. Zwischen den Richtungen wird interpoliert.
export const TERRAIN_STEP = 10; // Grad je Richtung → 36 Richtungen
export const TERRAIN_DIRS = 360 / TERRAIN_STEP;
const EARTH_R = 6371000; // m
const REFRACTION_K = 0.13; // übliche terrestrische Refraktion
const EYE_HEIGHT = 1.7; // m über Gelände

/** Grobe Abstände der Abtastpunkte je Richtung (m), bis 34 km. */
export const SAMPLE_DISTANCES: number[] = [300, 800, 1600, 3000, 5000, 8000, 12500, 20000, 33000];
/** Verfeinerungsstufen: zusätzliche Punkte je Richtung rund um den bisher höchsten Fund. */
export const REFINE_STAGES = [4, 3];
/** Gesamtzahl der Abfragepunkte je Berechnung. */
export const TOTAL_POINTS = 1 + TERRAIN_DIRS * (SAMPLE_DISTANCES.length + REFINE_STAGES.reduce((a, b) => a + b, 0));

export interface ManualPoint {
  az: number; // Grad
  alt: number; // Grad
  at: number; // Zeitstempel der Erfassung
}

export interface HorizonProfile {
  terrain: number[] | null; // TERRAIN_DIRS Werte in Grad, Index i ↔ Azimut i·TERRAIN_STEP
  terrainAt?: number; // Zeitpunkt der Berechnung
  manual: ManualPoint[];
}

export type HorizonFn = (az: number) => number;

const norm = (az: number) => ((az % 360) + 360) % 360;

/** Zielpunkt in Entfernung d (m) und Richtung az (Grad) auf der Kugel. */
export function destination(lat: number, lon: number, az: number, d: number): [number, number] {
  const r = Math.PI / 180;
  const φ1 = lat * r;
  const λ1 = lon * r;
  const θ = az * r;
  const δ = d / EARTH_R;
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return [φ2 / r, ((((λ2 / r) + 540) % 360) - 180)];
}

/** Höhenwinkel eines Geländepunkts inkl. Erdkrümmung und Refraktion. */
export function elevationAngle(hObs: number, hTarget: number, d: number): number {
  const drop = ((d * d) / (2 * EARTH_R)) * (1 - REFRACTION_K);
  return (Math.atan2(hTarget - hObs - drop, d) * 180) / Math.PI;
}

export type ElevationFetcher = (points: [number, number][], signal?: AbortSignal) => Promise<number[]>;

/** Open-Meteo Elevation API: bis zu 100 Koordinaten pro Anfrage. */
export const fetchElevations: ElevationFetcher = async (points, signal) => {
  const out: number[] = [];
  for (let i = 0; i < points.length; i += 100) {
    const chunk = points.slice(i, i + 100);
    const params = new URLSearchParams({
      latitude: chunk.map((p) => p[0].toFixed(5)).join(','),
      longitude: chunk.map((p) => p[1].toFixed(5)).join(','),
    });
    const res = await fetch(`https://api.open-meteo.com/v1/elevation?${params}`, { signal });
    if (!res.ok) {
      let reason = `HTTP ${res.status}`;
      try {
        const j = await res.json();
        if (j?.reason) reason = j.reason;
      } catch {
        /* ignorieren */
      }
      throw friendlyApiError(reason, 'Geländedaten');
    }
    const j = (await res.json()) as { elevation: number[] };
    out.push(...j.elevation);
  }
  return out;
};

export interface TerrainProgress {
  done: number;
  total: number;
  /** > 0: Wartezeit in Sekunden wegen Minutenlimit */
  waitSec?: number;
}

const defaultSleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(id);
      reject(new DOMException('Abgebrochen', 'AbortError'));
    });
  });

/**
 * Berechnet das Gelände-Horizontprofil: je Richtung der größte Höhenwinkel über alle Abtastpunkte.
 * Liefert zusätzlich die Geländehöhe am Standort.
 */
export async function computeTerrainHorizon(
  lat: number,
  lon: number,
  fetcher: ElevationFetcher = fetchElevations,
  onProgress?: (p: TerrainProgress) => void,
  signal?: AbortSignal,
  sleep: (ms: number, signal?: AbortSignal) => Promise<void> = defaultSleep,
): Promise<{ terrain: number[]; groundElevation: number }> {
  const total = TOTAL_POINTS;
  let done = 0;
  // Abruf in Blöcken zu 100; bei Minutenlimit warten und den Block wiederholen
  const fetchAll = async (points: [number, number][]): Promise<number[]> => {
    const out: number[] = [];
    for (let i = 0; i < points.length; ) {
      try {
        out.push(...(await fetcher(points.slice(i, i + 100), signal)));
        done += Math.min(100, points.length - i);
        i += 100;
        onProgress?.({ done, total });
      } catch (e) {
        if (!(e instanceof ApiLimitError) || e.kind !== 'minute' || signal?.aborted) throw e;
        for (let sec = 65; sec > 0; sec--) {
          onProgress?.({ done, total, waitSec: sec });
          await sleep(1000, signal);
        }
      }
    }
    return out;
  };

  // Stufe 1: grob
  const coarsePts: [number, number][] = [[lat, lon]];
  for (let i = 0; i < TERRAIN_DIRS; i++) for (const d of SAMPLE_DISTANCES) coarsePts.push(destination(lat, lon, i * TERRAIN_STEP, d));
  const coarse = await fetchAll(coarsePts);
  const ground = coarse[0];
  const hObs = ground + EYE_HEIGHT;
  const angle = (h: number, d: number) => (Number.isFinite(h) && h > -1000 ? elevationAngle(hObs, h, d) : -90);

  // je Richtung: abgetastete (Entfernung, Winkel)-Paare, nach Entfernung sortiert
  const n = SAMPLE_DISTANCES.length;
  const prof: { d: number; a: number }[][] = Array.from({ length: TERRAIN_DIRS }, (_, i) =>
    SAMPLE_DISTANCES.map((d, j) => ({ d, a: angle(coarse[1 + i * n + j], d) })),
  );

  // Stufen 2+: rund um den bisher höchsten Fund zwischen dessen Nachbarn verdichten
  for (const m of REFINE_STAGES) {
    const ds: number[][] = prof.map((p) => {
      let k = 0;
      p.forEach((x, j) => x.a > p[k].a && (k = j));
      const lo = k > 0 ? p[k - 1].d : p[0].d * 0.4;
      const hi = k < p.length - 1 ? p[k + 1].d : p[k].d * 1.3;
      return Array.from({ length: m }, (_, j) => lo + ((hi - lo) * (j + 1)) / (m + 1));
    });
    const pts: [number, number][] = [];
    ds.forEach((list, i) => list.forEach((d) => pts.push(destination(lat, lon, i * TERRAIN_STEP, d))));
    const el = await fetchAll(pts);
    ds.forEach((list, i) => {
      list.forEach((d, j) => prof[i].push({ d, a: angle(el[i * m + j], d) }));
      prof[i].sort((x, y) => x.d - y.d);
    });
  }

  const terrain = prof.map((p) => Math.round(Math.max(...p.map((x) => x.a)) * 10) / 10);
  return { terrain, groundElevation: ground };
}

/** Horizonthöhe aus dem Geländeprofil (linear zwischen den 5°-Richtungen). */
function terrainAt(terrain: number[], az: number): number {
  const n = terrain.length;
  const a = norm(az) / (360 / n);
  const i = Math.floor(a) % n;
  const j = (i + 1) % n;
  const f = a - Math.floor(a);
  return terrain[i] * (1 - f) + terrain[j] * f;
}

const MANUAL_JOIN = 20; // Grad: benachbarte Punkte bis zu diesem Abstand werden verbunden
const MANUAL_SPREAD = 2.5; // Grad: Einzelpunkt wirkt ± so weit

/** Horizonthöhe aus vor Ort erfassten Punkten (−∞, wo keine Punkte liegen). */
function manualAt(points: ManualPoint[], az: number): number {
  if (!points.length) return -Infinity;
  const a = norm(az);
  const sorted = [...points].sort((p, q) => p.az - q.az);
  let best = -Infinity;
  for (let k = 0; k < sorted.length; k++) {
    const p = sorted[k];
    const q = sorted[(k + 1) % sorted.length];
    // Einzelpunkt
    const dp = Math.abs(((a - p.az + 540) % 360) - 180);
    if (dp <= MANUAL_SPREAD) best = Math.max(best, p.alt);
    // Verbindung p → q (im Uhrzeigersinn)
    if (sorted.length > 1) {
      const gap = norm(q.az - p.az);
      const off = norm(a - p.az);
      if (gap > 0 && gap <= MANUAL_JOIN && off <= gap) best = Math.max(best, p.alt + ((q.alt - p.alt) * off) / gap);
    }
  }
  return best;
}

/** Wirksamer Horizont: Maximum aus Gelände und manuellen Punkten (0°, wenn nichts bekannt ist). */
export function makeHorizon(profile: HorizonProfile | null | undefined): HorizonFn | undefined {
  if (!profile || (!profile.terrain && !profile.manual.length)) return undefined;
  const { terrain, manual } = profile;
  return (az: number) => {
    const t = terrain ? terrainAt(terrain, az) : 0;
    return Math.max(t, manualAt(manual, az));
  };
}
