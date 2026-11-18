import type { Interval, NightAstro, Sample } from './astro';
import type { WeatherData, WeatherHour } from './weather';
import { DEFAULT_RATING, hourQuality, type RatingOptions } from './rating';

export interface BestWindow {
  level: 'gut' | 'mittel' | 'schlecht' | 'keine-dunkelheit';
  interval: Interval | null;
  cloudAvg: number | null; // Ø Bewölkung im Fenster
  moonUp: boolean; // Mond irgendwann im Fenster über dem Horizont
  withWeather: boolean; // Wetterdaten für die Nacht vorhanden
  mw: { time: Date; alt: number; az: number } | null; // höchster Stand MS-Kern im Fenster
  reason: string | null; // Begründung, wenn kein gutes Fenster
}

const MIN_MS = 30 * 60000;

function nearestHour(hours: WeatherHour[], t: Date): WeatherHour | null {
  let best: WeatherHour | null = null;
  let bestDt = Infinity;
  for (const h of hours) {
    const dt = Math.abs(h.t.getTime() - t.getTime());
    if (dt < bestDt) {
      bestDt = dt;
      best = h;
    }
  }
  return best && bestDt <= 30 * 60000 ? best : null;
}

interface Q {
  s: Sample;
  cloud: number | null;
  q: number;
}

function runs(qs: Q[], min: number): Q[][] {
  const out: Q[][] = [];
  let cur: Q[] = [];
  for (const x of qs) {
    if (x.q >= min) cur.push(x);
    else if (cur.length) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length) out.push(cur);
  return out.filter((r) => r[r.length - 1].s.t.getTime() - r[0].s.t.getTime() >= MIN_MS);
}

const len = (r: Q[]) => r[r.length - 1].s.t.getTime() - r[0].s.t.getTime();
const avgQ = (r: Q[]) => r.reduce((a, x) => a + x.q, 0) / r.length;

/**
 * Sucht den längsten zusammenhängenden Zeitraum in der Dunkelphase mit guter Qualität.
 * Qualität je 5-min-Schritt = Stundenqualität (1 − Bewölkung [× Deep-Sky-Faktor]) × Mondfaktor,
 * Mondfaktor = 1 − 0,7 × Beleuchtung (wenn Mond über Horizont).
 * „gut“ ab 1 − Wolken-Grenze „gut“ (Standard 0,8), „mittel“ ab 1 − Wolken-Grenze „schlecht“ (Standard 0,4).
 */
export function findBestWindow(night: NightAstro, weather: WeatherData | null, minAlt: number, o: RatingOptions = DEFAULT_RATING): BestWindow {
  const GOOD = 1 - o.thresholds.cloudGood / 100;
  const OK = 1 - o.thresholds.cloudBad / 100;
  const dark = night.sun.dark;
  const empty: BestWindow = { level: 'keine-dunkelheit', interval: null, cloudAvg: null, moonUp: false, withWeather: false, mw: null, reason: null };
  if (!dark) return { ...empty, reason: 'In dieser Nacht wird es nicht dunkel.' };

  const ill = night.moon.illumination;
  const hours = weather ? weather.hours.filter((h) => h.t.getTime() >= dark.start.getTime() - 3600000 && h.t.getTime() <= dark.end.getTime() + 3600000) : [];
  const qs: Q[] = night.samples
    .filter((s) => s.t >= dark.start && s.t <= dark.end)
    .map((s) => {
      const h = hours.length ? nearestHour(hours, s.t) : null;
      const cloud = h ? h.cloud : null;
      const moonF = s.moonAlt > 0 ? 1 - 0.7 * ill : 1;
      return { s, cloud, q: (h ? hourQuality(h, o) : 1) * moonF };
    });
  const withWeather = qs.some((x) => x.cloud !== null);

  const pick = (rs: Q[][]) => rs.sort((a, b) => len(b) - len(a) || avgQ(b) - avgQ(a))[0] ?? null;
  let level: BestWindow['level'] = 'gut';
  let run = pick(runs(qs, GOOD));
  if (!run) {
    level = 'mittel';
    run = pick(runs(qs, OK));
  }

  if (!run) {
    const clouds = qs.filter((x) => x.cloud !== null).map((x) => x.cloud as number);
    const cAvg = clouds.length ? clouds.reduce((a, b) => a + b, 0) / clouds.length : null;
    const moonAllNight = qs.every((x) => x.s.moonAlt > 0);
    const reason =
      cAvg !== null && cAvg >= o.thresholds.cloudBad
        ? `Die ganze Nacht stark bewölkt (Ø ${Math.round(cAvg)} %).`
        : moonAllNight && ill > 0.5
          ? `Heller Mond (${Math.round(ill * 100)} %) die ganze Nacht über dem Horizont.`
          : 'Wolken und Mondlicht lassen kein längeres gutes Zeitfenster zu.';
    return { ...empty, level: 'schlecht', withWeather, cloudAvg: cAvg, reason };
  }

  const clouds = run.filter((x) => x.cloud !== null).map((x) => x.cloud as number);
  let mw: BestWindow['mw'] = null;
  for (const x of run) if (x.s.gcAlt >= minAlt && (!mw || x.s.gcAlt > mw.alt)) mw = { time: x.s.t, alt: x.s.gcAlt, az: x.s.gcAz };

  return {
    level,
    interval: { start: run[0].s.t, end: run[run.length - 1].s.t },
    cloudAvg: clouds.length ? clouds.reduce((a, b) => a + b, 0) / clouds.length : null,
    moonUp: run.some((x) => x.s.moonAlt > 0),
    withWeather,
    mw,
    reason: null,
  };
}
