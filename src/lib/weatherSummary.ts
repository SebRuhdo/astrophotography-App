import type { NightAstro } from './astro';
import { classify, dewRisk, type Level, type RatingOptions } from './rating';
import { zonedParts } from './time';
import type { WeatherData, WeatherHour } from './weather';

export interface SummaryItem {
  icon: string;
  text: string;
  level: Level;
}

/** Stunde zweistellig („07“) in der Zeitzone des Standorts. */
const hh = (t: Date, tz: string) => String(zonedParts(t, tz).hour).padStart(2, '0');

/** Zusammenhängende Stundenbereiche als „22–04 Uhr“. */
function ranges(hours: WeatherHour[], pred: (h: WeatherHour) => boolean, tz: string): string[] {
  const out: string[] = [];
  let start: WeatherHour | null = null;
  let last: WeatherHour | null = null;
  const flush = () => {
    if (start && last) out.push(`${hh(start.t, tz)}–${hh(new Date(last.t.getTime() + 3600000), tz)} Uhr`);
    start = last = null;
  };
  for (const h of hours) {
    if (pred(h)) {
      if (!start) start = h;
      last = h;
    } else flush();
  }
  flush();
  return out;
}

/**
 * Kurze Zusammenfassung der Wetterlage in der Dunkelphase (bzw. zwischen Sonnenunter- und -aufgang,
 * falls es nicht richtig dunkel wird).
 */
export function summarizeWeather(night: NightAstro, w: WeatherData | null, o: RatingOptions, tz: string): SummaryItem[] {
  if (!w) return [];
  const s = night.sun;
  const from = s.dark?.start ?? s.sunset ?? night.t0;
  const to = s.dark?.end ?? s.sunrise ?? night.t1;
  // volle Stunden, die die Dunkelphase berühren
  const hours = w.hours.filter((h) => h.t.getTime() + 3600000 > from.getTime() && h.t.getTime() < to.getTime());
  if (!hours.length) return [];
  const t = o.thresholds;
  const items: SummaryItem[] = [];

  // Wolken
  const clear = ranges(hours, (h) => h.cloud <= t.cloudGood, tz);
  const avg = hours.reduce((a, h) => a + h.cloud, 0) / hours.length;
  if (hours.every((h) => h.cloud <= t.cloudGood)) items.push({ icon: '✨', text: 'Die ganze Nacht klar', level: 'gut' });
  else if (clear.length) items.push({ icon: '🌤️', text: `Klar ${clear.join(', ')}`, level: 'gut' });
  else if (avg < t.cloudBad) items.push({ icon: '⛅', text: `Wechselnd bewölkt (Ø ${Math.round(avg)} %)`, level: 'mittel' });
  else items.push({ icon: '☁️', text: `Bewölkt (Ø ${Math.round(avg)} %)`, level: 'schlecht' });

  // Niederschlag
  const maxRain = Math.max(...hours.map((h) => h.precipProb ?? 0));
  if (maxRain >= 30) items.push({ icon: '🌧️', text: `Regenrisiko bis ${Math.round(maxRain)} %`, level: maxRain >= 60 ? 'schlecht' : 'mittel' });

  // Tau
  const dewIdx = hours.findIndex((h) => dewRisk(h, o));
  if (dewIdx < 0) items.push({ icon: '💧', text: 'Keine Taugefahr', level: 'gut' });
  else items.push({ icon: '💧', text: dewIdx === 0 ? 'Taugefahr die ganze Nacht' : `Taugefahr ab ${hh(hours[dewIdx].t, tz)} Uhr`, level: 'mittel' });

  // Wind
  const maxWind = Math.max(...hours.map((h) => h.wind).filter((v) => !Number.isNaN(v)));
  const maxGust = Math.max(...hours.map((h) => h.gusts).filter((v) => !Number.isNaN(v)));
  const wl = classify(maxWind, t.windGood, t.windBad);
  if (wl) {
    const word = wl === 'gut' ? 'schwach' : wl === 'mittel' ? 'mäßig' : 'stark';
    items.push({ icon: '🌬️', text: `Wind ${word} (bis ${Math.round(maxWind)} km/h${Number.isFinite(maxGust) ? `, Böen ${Math.round(maxGust)}` : ''})`, level: wl });
  }

  // Seeing-Indikator (nur Deep-Sky)
  if (o.profile === 'deepsky') {
    const jets = hours.map((h) => h.jet).filter((v): v is number => v !== null && !Number.isNaN(v));
    if (jets.length) {
      const maxJet = Math.max(...jets);
      const jl = classify(maxJet, t.jetGood, t.jetBad)!;
      items.push({ icon: '🔭', text: `Seeing ${jl === 'gut' ? 'voraussichtlich gut' : jl === 'mittel' ? 'mittel' : 'eher schlecht'} (Jetstream bis ${Math.round(maxJet)} km/h)`, level: jl });
    }
  }
  return items;
}
