// Horizont-Profil: Gelände (Copernicus DEM GLO-90 über die Open-Meteo Elevation API) + vor Ort erfasste Punkte.

export const TERRAIN_STEP = 5; // Grad je Richtung → 72 Richtungen
export const TERRAIN_DIRS = 360 / TERRAIN_STEP;
const EARTH_R = 6371000; // m
const REFRACTION_K = 0.13; // übliche terrestrische Refraktion
const EYE_HEIGHT = 1.7; // m über Gelände

/** Abstände der Abtastpunkte je Richtung (m): dicht in der Nähe, weiter entfernt gröber, bis 40 km. */
export const SAMPLE_DISTANCES: number[] = (() => {
  const out: number[] = [];
  let d = 150;
  while (d <= 40000) {
    out.push(Math.round(d));
    d *= 1.3;
  }
  return out;
})();

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
      throw new Error(`Geländedaten: ${reason}`);
    }
    const j = (await res.json()) as { elevation: number[] };
    out.push(...j.elevation);
  }
  return out;
};

/**
 * Berechnet das Gelände-Horizontprofil: je Richtung der größte Höhenwinkel über alle Abtastpunkte.
 * Liefert zusätzlich die Geländehöhe am Standort.
 */
export async function computeTerrainHorizon(
  lat: number,
  lon: number,
  fetcher: ElevationFetcher = fetchElevations,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<{ terrain: number[]; groundElevation: number }> {
  const points: [number, number][] = [[lat, lon]];
  for (let i = 0; i < TERRAIN_DIRS; i++) for (const d of SAMPLE_DISTANCES) points.push(destination(lat, lon, i * TERRAIN_STEP, d));

  // in Blöcken abrufen, damit ein Fortschritt angezeigt werden kann
  const elev: number[] = [];
  const BLOCK = 400;
  for (let i = 0; i < points.length; i += BLOCK) {
    elev.push(...(await fetcher(points.slice(i, i + BLOCK), signal)));
    onProgress?.(Math.min(points.length, i + BLOCK), points.length);
  }
  const ground = elev[0];
  const hObs = ground + EYE_HEIGHT;
  const terrain: number[] = [];
  let k = 1;
  for (let i = 0; i < TERRAIN_DIRS; i++) {
    let best = -90;
    for (const d of SAMPLE_DISTANCES) {
      const h = elev[k++];
      if (Number.isFinite(h) && h > -1000) best = Math.max(best, elevationAngle(hObs, h, d));
    }
    terrain.push(Math.round(best * 10) / 10);
  }
  return { terrain, groundElevation: ground };
}

/** Horizonthöhe aus dem Geländeprofil (linear zwischen den 5°-Richtungen). */
function terrainAt(terrain: number[], az: number): number {
  const a = norm(az) / TERRAIN_STEP;
  const i = Math.floor(a) % TERRAIN_DIRS;
  const j = (i + 1) % TERRAIN_DIRS;
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
