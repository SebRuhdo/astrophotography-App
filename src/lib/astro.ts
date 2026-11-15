import * as A from 'astronomy-engine';

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

/** Sgr A* / galaktisches Zentrum (J2000): RA 17h45m40.04s, Dec −29°00′28.1″ */
const GC_RA_HOURS = 17 + 45 / 60 + 40.04 / 3600;
const GC_DEC_DEG = -(29 + 0 / 60 + 28.1 / 3600);
A.DefineStar(A.Body.Star1, GC_RA_HOURS, GC_DEC_DEG, 26000);

const STEP_MIN = 5;
const DAY_MS = 86400000;

export const PLANETS: { body: A.Body; name: string }[] = [
  { body: A.Body.Mercury, name: 'Merkur' },
  { body: A.Body.Venus, name: 'Venus' },
  { body: A.Body.Mars, name: 'Mars' },
  { body: A.Body.Jupiter, name: 'Jupiter' },
  { body: A.Body.Saturn, name: 'Saturn' },
  { body: A.Body.Uranus, name: 'Uranus' },
  { body: A.Body.Neptune, name: 'Neptun' },
];

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

export interface Interval {
  start: Date;
  end: Date;
}

export type DarkType = 'astronomisch' | 'nautisch' | 'bürgerlich' | 'keine';

export interface Sample {
  t: Date;
  sunAlt: number;
  sunAz: number;
  moonAlt: number;
  moonAz: number;
  gcAlt: number;
  gcAz: number;
}

export interface SunInfo {
  sunset: Date | null;
  sunrise: Date | null;
  civil: Interval | null; // Ende bürgerliche Dämmerung abends → Beginn morgens (Sonne < −6°)
  nautical: Interval | null; // Sonne < −12°
  astronomical: Interval | null; // Sonne < −18°
  goldenEvening: Interval | null;
  blueEvening: Interval | null;
  blueMorning: Interval | null;
  goldenMorning: Interval | null;
  minAltitude: number;
  dark: Interval | null; // dunkelster verfügbarer Zeitraum
  darkType: DarkType;
}

export interface MoonInfo {
  rise: Date | null;
  set: Date | null;
  illumination: number; // 0..1, zur Mitte der Nacht
  phaseAngle: number; // 0 = Neumond, 180 = Vollmond
  phaseName: string;
  waxing: boolean;
  upDuringDark: number; // ms
  moonFreeDark: Interval[];
  nextNew: Date | null;
  nextFull: Date | null;
  midnightAlt: number;
  midnightAz: number;
}

export interface PlanetInfo {
  name: string;
  rise: Date | null;
  set: Date | null;
  transit: Date | null;
  transitAlt: number | null;
  visible: Interval[]; // über Mindesthöhe und Sonne < −6°
  bestTime: Date | null;
  bestAlt: number | null;
  bestAz: number | null;
  magnitude: number | null;
  constellation: string | null;
}

export interface MilkyWayInfo {
  /** Kern über Mindesthöhe während der Dunkelheit */
  visible: Interval[];
  /** zusätzlich Mond unter dem Horizont */
  moonFree: Interval[];
  bestTime: Date | null;
  bestAlt: number | null;
  bestAz: number | null;
  startAz: number | null;
  endAz: number | null;
  maxAlt24h: number; // höchster Stand innerhalb 24 h (unabhängig von Dunkelheit)
  rise: Date | null;
  set: Date | null;
}

export interface NightAstro {
  dateIso: string;
  t0: Date; // lokaler Mittag
  t1: Date; // lokaler Mittag am Folgetag
  samples: Sample[];
  sun: SunInfo;
  moon: MoonInfo;
  milkyWay: MilkyWayInfo;
  planets: PlanetInfo[];
}

export interface ComputeOptions {
  /** Mindesthöhe in Grad, ab der ein Objekt als „sichtbar“ gilt (Horizont-Hindernisse) */
  minAltitude?: number;
  planets?: boolean;
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

const toDate = (t: A.AstroTime | null | undefined): Date | null => (t ? t.date : null);

function altAz(body: A.Body, t: Date, obs: A.Observer): { alt: number; az: number; ra: number; dec: number } {
  const eq = A.Equator(body, t, obs, true, true);
  const hor = A.Horizon(t, obs, eq.ra, eq.dec, 'normal');
  return { alt: hor.altitude, az: hor.azimuth, ra: eq.ra, dec: eq.dec };
}

/** Zusammenhängende Intervalle, in denen `pred` für die Samples gilt. */
export function intervalsWhere<T extends { t: Date }>(samples: T[], pred: (s: T) => boolean): Interval[] {
  const out: Interval[] = [];
  let start: Date | null = null;
  let last: Date | null = null;
  for (const s of samples) {
    if (pred(s)) {
      if (!start) start = s.t;
      last = s.t;
    } else if (start && last) {
      out.push({ start, end: last });
      start = null;
    }
  }
  if (start && last) out.push({ start, end: last });
  return out;
}

export const intervalMs = (iv: Interval[]): number => iv.reduce((s, i) => s + (i.end.getTime() - i.start.getTime()), 0);

export function clipIntervals(iv: Interval[], window: Interval | null): Interval[] {
  if (!window) return [];
  const out: Interval[] = [];
  for (const i of iv) {
    const s = Math.max(i.start.getTime(), window.start.getTime());
    const e = Math.min(i.end.getTime(), window.end.getTime());
    if (e > s) out.push({ start: new Date(s), end: new Date(e) });
  }
  return out;
}

/** Zeitraum, in dem die Sonne unter `alt` steht (die Nacht um Mitternacht herum). */
function sunBelow(obs: A.Observer, t0: Date, t1: Date, samples: Sample[], alt: number): Interval | null {
  // Sample-basierte Grobsuche um Mitternacht, danach exakte Verfeinerung
  const mid = Math.floor(samples.length / 2);
  let idx = -1;
  for (let k = 0; k < samples.length / 2; k++) {
    if (samples[mid + k] && samples[mid + k].sunAlt < alt) { idx = mid + k; break; }
    if (samples[mid - k] && samples[mid - k].sunAlt < alt) { idx = mid - k; break; }
  }
  if (idx < 0) return null;
  let a = idx;
  while (a > 0 && samples[a - 1].sunAlt < alt) a--;
  let b = idx;
  while (b < samples.length - 1 && samples[b + 1].sunAlt < alt) b++;

  let start = samples[a].t;
  let end = samples[b].t;
  const stepDays = (STEP_MIN * 2) / 1440;
  if (a > 0) {
    const s = A.SearchAltitude(A.Body.Sun, obs, -1, new Date(samples[a - 1].t.getTime() - 60000), stepDays, alt);
    if (s) start = s.date;
  } else start = t0;
  if (b < samples.length - 1) {
    const e = A.SearchAltitude(A.Body.Sun, obs, +1, new Date(samples[b].t.getTime() - 60000), stepDays, alt);
    if (e) end = e.date;
  } else end = t1;
  return { start, end };
}

function between(obs: A.Observer, t0: Date, dir: 1 | -1, altFrom: number, altTo: number): Interval | null {
  const a = A.SearchAltitude(A.Body.Sun, obs, dir, t0, 1, altFrom);
  const b = A.SearchAltitude(A.Body.Sun, obs, dir, t0, 1, altTo);
  if (!a || !b || b.date <= a.date) return null;
  return { start: a.date, end: b.date };
}

export function moonPhaseName(angle: number): string {
  const a = ((angle % 360) + 360) % 360;
  if (a < 7 || a >= 353) return 'Neumond';
  if (a < 83) return 'Zunehmende Sichel';
  if (a < 97) return 'Erstes Viertel';
  if (a < 173) return 'Zunehmender Mond';
  if (a < 187) return 'Vollmond';
  if (a < 263) return 'Abnehmender Mond';
  if (a < 277) return 'Letztes Viertel';
  return 'Abnehmende Sichel';
}

const COMPASS = ['N', 'NNO', 'NO', 'ONO', 'O', 'OSO', 'SO', 'SSO', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export function compass(az: number | null | undefined): string {
  if (az === null || az === undefined) return '–';
  return COMPASS[Math.round((((az % 360) + 360) % 360) / 22.5) % 16];
}

function sampleNight(obs: A.Observer, t0: Date): Sample[] {
  const n = Math.round(1440 / STEP_MIN);
  const samples: Sample[] = [];
  for (let i = 0; i <= n; i++) {
    const t = new Date(t0.getTime() + i * STEP_MIN * 60000);
    const sun = altAz(A.Body.Sun, t, obs);
    const moon = altAz(A.Body.Moon, t, obs);
    const gc = altAz(A.Body.Star1, t, obs);
    samples.push({ t, sunAlt: sun.alt, sunAz: sun.az, moonAlt: moon.alt, moonAz: moon.az, gcAlt: gc.alt, gcAz: gc.az });
  }
  return samples;
}

// ---------------------------------------------------------------------------
// Hauptberechnung
// ---------------------------------------------------------------------------

export function computeNight(
  lat: number,
  lon: number,
  elevation: number,
  t0: Date,
  dateIso: string,
  opts: ComputeOptions = {},
): NightAstro {
  const minAlt = opts.minAltitude ?? 5;
  const obs = new A.Observer(lat, lon, elevation);
  const t1 = new Date(t0.getTime() + DAY_MS);
  const samples = sampleNight(obs, t0);

  // ---- Sonne -------------------------------------------------------------
  const civil = sunBelow(obs, t0, t1, samples, -6);
  const nautical = sunBelow(obs, t0, t1, samples, -12);
  const astronomical = sunBelow(obs, t0, t1, samples, -18);
  const minAltitude = Math.min(...samples.map((s) => s.sunAlt));
  let dark: Interval | null = null;
  let darkType: DarkType = 'keine';
  if (astronomical) { dark = astronomical; darkType = 'astronomisch'; }
  else if (nautical) { dark = nautical; darkType = 'nautisch'; }
  else if (civil) { dark = civil; darkType = 'bürgerlich'; }

  const sunset = A.SearchRiseSet(A.Body.Sun, obs, -1, t0, 1);
  const sunrise = A.SearchRiseSet(A.Body.Sun, obs, +1, t0, 1);
  const sun: SunInfo = {
    sunset: toDate(sunset),
    sunrise: sunrise && (!sunset || sunrise.date > sunset.date) ? sunrise.date : null,
    civil,
    nautical,
    astronomical,
    // Fotografische Definition: Goldene Stunde +6° … −4°, Blaue Stunde −4° … −8°
    goldenEvening: between(obs, t0, -1, 6, -4),
    blueEvening: between(obs, t0, -1, -4, -8),
    blueMorning: between(obs, t0, +1, -8, -4),
    goldenMorning: between(obs, t0, +1, -4, 6),
    minAltitude,
    dark,
    darkType,
  };

  // ---- Mond --------------------------------------------------------------
  const midT = dark ? new Date((dark.start.getTime() + dark.end.getTime()) / 2) : new Date(t0.getTime() + DAY_MS / 2);
  const ill = A.Illumination(A.Body.Moon, midT);
  const phaseAngle = A.MoonPhase(midT);
  const moonUpDark = clipIntervals(intervalsWhere(samples, (s) => s.moonAlt > 0), dark);
  const moonFreeDark = clipIntervals(intervalsWhere(samples, (s) => s.moonAlt <= 0), dark);
  const midnight = altAz(A.Body.Moon, new Date(t0.getTime() + DAY_MS / 2), obs);
  const moon: MoonInfo = {
    // nächster Auf-/Untergang ab Mittag (kann wegen der ~50-min-Verspätung pro Tag auch nach dem Folgemittag liegen)
    rise: toDate(A.SearchRiseSet(A.Body.Moon, obs, +1, t0, 2)),
    set: toDate(A.SearchRiseSet(A.Body.Moon, obs, -1, t0, 2)),
    illumination: ill.phase_fraction,
    phaseAngle,
    phaseName: moonPhaseName(phaseAngle),
    waxing: phaseAngle < 180,
    upDuringDark: intervalMs(moonUpDark),
    moonFreeDark,
    nextNew: toDate(A.SearchMoonPhase(0, t0, 35)),
    nextFull: toDate(A.SearchMoonPhase(180, t0, 35)),
    midnightAlt: midnight.alt,
    midnightAz: midnight.az,
  };

  // ---- Milchstraße (galaktisches Zentrum) ---------------------------------
  const inDark = (t: Date) => !!dark && t >= dark.start && t <= dark.end;
  const mwVisible = intervalsWhere(samples, (s) => inDark(s.t) && s.gcAlt >= minAlt);
  const mwMoonFree = intervalsWhere(samples, (s) => inDark(s.t) && s.gcAlt >= minAlt && s.moonAlt <= 0);
  let best: Sample | null = null;
  for (const s of samples) if (inDark(s.t) && s.gcAlt >= minAlt && (!best || s.gcAlt > best.gcAlt)) best = s;
  const sampleAt = (t: Date | undefined) => (t ? samples.find((s) => s.t.getTime() === t.getTime()) ?? null : null);
  const milkyWay: MilkyWayInfo = {
    visible: mwVisible,
    moonFree: mwMoonFree,
    bestTime: best?.t ?? null,
    bestAlt: best?.gcAlt ?? null,
    bestAz: best?.gcAz ?? null,
    startAz: sampleAt(mwVisible[0]?.start)?.gcAz ?? null,
    endAz: sampleAt(mwVisible[mwVisible.length - 1]?.end)?.gcAz ?? null,
    maxAlt24h: Math.max(...samples.map((s) => s.gcAlt)),
    rise: toDate(A.SearchRiseSet(A.Body.Star1, obs, +1, t0, 1)),
    set: toDate(A.SearchRiseSet(A.Body.Star1, obs, -1, t0, 1)),
  };

  // ---- Planeten ----------------------------------------------------------
  const planets: PlanetInfo[] = [];
  if (opts.planets !== false) {
    const step = 2; // jedes 2. Sample → 10 min
    for (const p of PLANETS) {
      const ps: { t: Date; alt: number; az: number; sunAlt: number }[] = [];
      for (let i = 0; i < samples.length; i += step) {
        const s = samples[i];
        const h = altAz(p.body, s.t, obs);
        ps.push({ t: s.t, alt: h.alt, az: h.az, sunAlt: s.sunAlt });
      }
      const visible = intervalsWhere(ps, (s) => s.sunAlt < -6 && s.alt >= minAlt);
      let pb: (typeof ps)[number] | null = null;
      for (const s of ps) if (s.sunAlt < -6 && s.alt >= minAlt && (!pb || s.alt > pb.alt)) pb = s;
      const transit = A.SearchHourAngle(p.body, obs, 0, t0, +1);
      let magnitude: number | null = null;
      let constellation: string | null = null;
      const refT = pb?.t ?? transit.time.date;
      try {
        magnitude = A.Illumination(p.body, refT).mag;
        const eq = A.Equator(p.body, refT, obs, false, true); // J2000 für Sternbild-Bestimmung
        constellation = A.Constellation(eq.ra, eq.dec).name;
      } catch {
        /* ignorieren */
      }
      planets.push({
        name: p.name,
        rise: toDate(A.SearchRiseSet(p.body, obs, +1, t0, 1)),
        set: toDate(A.SearchRiseSet(p.body, obs, -1, t0, 1)),
        transit: transit.time.date <= t1 ? transit.time.date : null,
        transitAlt: transit.time.date <= t1 ? transit.hor.altitude : null,
        visible,
        bestTime: pb?.t ?? null,
        bestAlt: pb?.alt ?? null,
        bestAz: pb?.az ?? null,
        magnitude,
        constellation,
      });
    }
  }

  return { dateIso, t0, t1, samples, sun, moon, milkyWay, planets };
}

/**
 * Sucht ab `t0` die nächste Nacht, in der der Kern der Milchstraße bei astronomischer
 * Dunkelheit über `minAlt` steht. Grobe Suche (30-min-Raster), max. 400 Tage.
 */
export function nextMilkyWayNight(lat: number, lon: number, elevation: number, t0: Date, minAlt = 5): Date | null {
  const obs = new A.Observer(lat, lon, elevation);
  const stepMs = 30 * 60000;
  for (let d = 1; d <= 400; d++) {
    const base = t0.getTime() + d * DAY_MS;
    for (let k = 0; k < 48; k++) {
      const t = new Date(base + k * stepMs);
      if (altAz(A.Body.Sun, t, obs).alt < -18 && altAz(A.Body.Star1, t, obs).alt >= minAlt) return new Date(base);
    }
  }
  return null;
}

export interface MoonQuarterEvent {
  quarter: 0 | 1 | 2 | 3; // 0 Neumond, 1 Erstes Viertel, 2 Vollmond, 3 Letztes Viertel
  time: Date;
}

export const QUARTER_NAMES = ['Neumond', 'Erstes Viertel', 'Vollmond', 'Letztes Viertel'] as const;

/** Die nächsten `count` Mondphasen (Viertel) ab `start`. */
export function moonQuarters(start: Date, count: number): MoonQuarterEvent[] {
  const out: MoonQuarterEvent[] = [];
  let mq = A.SearchMoonQuarter(start);
  for (let i = 0; i < count; i++) {
    out.push({ quarter: mq.quarter as MoonQuarterEvent['quarter'], time: mq.time.date });
    mq = A.NextMoonQuarter(mq);
  }
  return out;
}

export interface SkyObject {
  id: 'sun' | 'moon' | 'gc' | string;
  name: string;
  alt: number;
  az: number;
  magnitude?: number;
}

/** Aktuelle Positionen von Sonne, Mond, Milchstraßen-Kern und Planeten (für den Kompass). */
export function skyPositions(lat: number, lon: number, elevation: number, t: Date): SkyObject[] {
  const obs = new A.Observer(lat, lon, elevation);
  const out: SkyObject[] = [];
  const sun = altAz(A.Body.Sun, t, obs);
  out.push({ id: 'sun', name: 'Sonne', alt: sun.alt, az: sun.az });
  const moon = altAz(A.Body.Moon, t, obs);
  out.push({ id: 'moon', name: 'Mond', alt: moon.alt, az: moon.az });
  const gc = altAz(A.Body.Star1, t, obs);
  out.push({ id: 'gc', name: 'Milchstraßen-Kern', alt: gc.alt, az: gc.az });
  for (const p of PLANETS) {
    const h = altAz(p.body, t, obs);
    let magnitude: number | undefined;
    try {
      magnitude = A.Illumination(p.body, t).mag;
    } catch {
      /* ignorieren */
    }
    out.push({ id: p.name, name: p.name, alt: h.alt, az: h.az, magnitude });
  }
  return out;
}
