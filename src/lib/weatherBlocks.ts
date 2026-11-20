import type { NightAstro } from './astro';
import { classify, dewRisk, type Level, type RatingOptions } from './rating';
import { zonedParts } from './time';
import type { WeatherData, WeatherHour } from './weather';

export type Cell = Level | null;

export interface HourCells {
  h: WeatherHour;
  sunAlt: number;
  cloud: Cell;
  rain: Cell;
  dew: Cell;
  wind: Cell;
  jet: Cell;
}

const ORDER: Record<Level, number> = { gut: 0, mittel: 1, schlecht: 2 };
export const worst = (cells: Cell[]): Level | null =>
  cells.reduce<Level | null>((w, c) => (c && (!w || ORDER[c] > ORDER[w]) ? c : w), null);

/** Regenrisiko: ab 30 % gelb, ab 60 % rot (feste Faustregel). */
export const rainLevel = (p: number | null): Cell => (p === null ? null : p >= 60 ? 'schlecht' : p >= 30 ? 'mittel' : 'gut');

function sunAltAt(night: NightAstro, t: Date): number {
  let best = night.samples[0];
  for (const s of night.samples) if (Math.abs(s.t.getTime() - t.getTime()) < Math.abs(best.t.getTime() - t.getTime())) best = s;
  return best.sunAlt;
}

/** Stunden von 1 h vor Sonnenuntergang bis 1 h nach Sonnenaufgang mit Ampel-Bewertung je Kriterium. */
export function hourCells(night: NightAstro, w: WeatherData | null, o: RatingOptions): HourCells[] {
  if (!w) return [];
  const s = night.sun;
  const start = s.sunset ? s.sunset.getTime() - 3600000 : night.t0.getTime() + 5 * 3600000;
  const end = s.sunrise ? s.sunrise.getTime() + 3600000 : night.t1.getTime() - 5 * 3600000;
  const t = o.thresholds;
  return w.hours
    .filter((h) => h.t.getTime() >= start - 1800000 && h.t.getTime() <= end + 1800000)
    .map((h) => ({
      h,
      sunAlt: sunAltAt(night, h.t),
      cloud: classify(h.cloud, t.cloudGood, t.cloudBad),
      rain: rainLevel(h.precipProb),
      dew: Number.isNaN(h.temp - h.dewPoint) ? null : dewRisk(h, o) ? (h.temp - h.dewPoint < t.dewSpread / 2 ? 'schlecht' : 'mittel') : 'gut',
      wind: classify(h.wind, t.windGood, t.windBad),
      jet: o.profile === 'deepsky' ? classify(h.jet, t.jetGood, t.jetBad) : null,
    }));
}

export interface Block {
  from: Date;
  to: Date;
  phase: 'tag' | 'dämmerung' | 'nacht';
  level: Level;
  label: string;
  cloudAvg: number;
  rainMax: number;
  tempMin: number;
  tempMax: number;
  dew: boolean;
  windMax: number;
  jetMax: number | null;
}

const LABEL: Record<Level, string> = { gut: 'klar', mittel: 'wechselnd', schlecht: 'bewölkt' };

/** Zeitblöcke à 3 h (ausgerichtet an 0/3/6 … Uhr Ortszeit) mit Gesamt-Ampel. */
export function buildBlocks(cells: HourCells[], o: RatingOptions, tz: string): Block[] {
  const groups = new Map<number, HourCells[]>();
  for (const c of cells) {
    const p = zonedParts(c.h.t, tz);
    const key = c.h.t.getTime() - ((p.hour % 3) * 3600000 + p.minute * 60000);
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  const t = o.thresholds;
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([key, cs]) => {
      const avg = (f: (c: HourCells) => number) => cs.reduce((a, c) => a + f(c), 0) / cs.length;
      const cloudAvg = avg((c) => c.h.cloud);
      const rainMax = Math.max(...cs.map((c) => c.h.precipProb ?? 0));
      const windMax = Math.max(...cs.map((c) => (Number.isNaN(c.h.wind) ? 0 : c.h.wind)));
      const jets = cs.map((c) => c.h.jet).filter((v): v is number => v !== null && !Number.isNaN(v));
      const jetMax = jets.length ? Math.max(...jets) : null;
      const temps = cs.map((c) => c.h.temp).filter((v) => !Number.isNaN(v));
      const cloudL = classify(cloudAvg, t.cloudGood, t.cloudBad)!;
      const parts: Cell[] = [cloudL, rainLevel(rainMax)];
      const windL = o.profile === 'deepsky' ? classify(windMax, t.windGood, t.windBad) : null;
      const jetL = o.profile === 'deepsky' ? classify(jetMax, t.jetGood, t.jetBad) : null;
      parts.push(windL, jetL);
      const level = worst(parts) ?? 'gut';
      const minSun = Math.min(...cs.map((c) => c.sunAlt));
      const maxSun = Math.max(...cs.map((c) => c.sunAlt));
      const phase: Block['phase'] = maxSun < -18 ? 'nacht' : minSun > 0 ? 'tag' : 'dämmerung';
      let label = LABEL[cloudL];
      const rainL = rainLevel(rainMax)!;
      // Regen nur als Bezeichnung, wenn er mindestens so schlecht wie die Bewölkung ist
      if (rainL !== 'gut' && ORDER[rainL] >= ORDER[cloudL]) label = 'Regenrisiko';
      else if (o.profile === 'deepsky' && ORDER[level] > ORDER[cloudL]) {
        // Grund für die schlechtere Deep-Sky-Bewertung nennen
        const why = [jetL && ORDER[jetL] > ORDER[cloudL] ? 'unruhig' : null, windL && ORDER[windL] > ORDER[cloudL] ? 'windig' : null].filter(Boolean).join(', ');
        label = cloudL === 'gut' ? `klar, aber ${why}` : `${label}, ${why}`;
      }
      return {
        from: new Date(key),
        to: new Date(key + 3 * 3600000),
        phase,
        level,
        label,
        cloudAvg,
        rainMax,
        tempMin: temps.length ? Math.min(...temps) : NaN,
        tempMax: temps.length ? Math.max(...temps) : NaN,
        dew: cs.some((c) => c.dew !== 'gut' && c.dew !== null),
        windMax,
        jetMax,
      };
    });
}
