// Gemeinsame Bewertungsregeln für Wetter-Anzeige, Nacht-Score, bestes Fenster und Spot-Vergleich.
import type { WeatherHour } from './weather';

export type Profile = 'landscape' | 'deepsky';

export const PROFILE_LABELS: Record<Profile, string> = {
  landscape: 'Landschaft & Milchstraße',
  deepsky: 'Deep-Sky (Teleskop)',
};

export interface Thresholds {
  cloudGood: number; // % – bis hier „gut“
  cloudBad: number; // % – ab hier „schlecht“
  dewSpread: number; // °C – Abstand Temperatur/Taupunkt, darunter Taugefahr
  windGood: number; // km/h
  windBad: number; // km/h
  jetGood: number; // km/h (250 hPa)
  jetBad: number; // km/h
}

/** Faustregel-Standardwerte (in den Einstellungen änderbar). */
export const DEFAULT_THRESHOLDS: Thresholds = {
  cloudGood: 20,
  cloudBad: 60,
  dewSpread: 2.5,
  windGood: 15,
  windBad: 30,
  jetGood: 70,
  jetBad: 130,
};

export interface RatingOptions {
  profile: Profile;
  thresholds: Thresholds;
}

export const DEFAULT_RATING: RatingOptions = { profile: 'landscape', thresholds: DEFAULT_THRESHOLDS };

export type Level = 'gut' | 'mittel' | 'schlecht';

/** Höhere Werte = schlechter (Wolken, Wind, Jetstream). */
export function classify(v: number | null | undefined, good: number, bad: number): Level | null {
  if (v === null || v === undefined || Number.isNaN(v)) return null;
  if (v <= good) return 'gut';
  if (v < bad) return 'mittel';
  return 'schlecht';
}

const LEVEL_FACTOR: Record<Level, number> = { gut: 1, mittel: 0.85, schlecht: 0.65 };

/** Zusatzfaktor für Deep-Sky: Wind (Nachführung, Verwacklung) und Jetstream (Seeing). 1 im Landschaftsprofil. */
export function deepSkyFactor(h: WeatherHour, o: RatingOptions): number {
  if (o.profile !== 'deepsky') return 1;
  const t = o.thresholds;
  const w = classify(Math.max(h.wind, Number.isNaN(h.gusts) ? 0 : h.gusts * 0.6), t.windGood, t.windBad);
  const j = classify(h.jet, t.jetGood, t.jetBad);
  return (w ? LEVEL_FACTOR[w] : 1) * (j ? LEVEL_FACTOR[j] : 1);
}

/** Qualität einer Wetterstunde 0..1 (ohne Mond). */
export function hourQuality(h: WeatherHour, o: RatingOptions): number {
  return (1 - Math.max(0, Math.min(100, h.cloud)) / 100) * deepSkyFactor(h, o);
}

export const dewRisk = (h: WeatherHour, o: RatingOptions) => h.temp - h.dewPoint < o.thresholds.dewSpread;

export const LEVEL_COLOR: Record<Level, string> = { gut: 'var(--good)', mittel: 'var(--mid)', schlecht: 'var(--bad)' };
