import type { NightAstro } from './astro';
import { hoursIn, type WeatherData } from './weather';
import { DEFAULT_RATING, deepSkyFactor, type RatingOptions } from './rating';

export interface NightScore {
  score: number | null; // 0..100, null wenn keine Wetterdaten
  level: 'gut' | 'mittel' | 'schlecht' | 'unbekannt';
  cloudAvg: number | null; // % im Dunkel-Zeitraum
  moonFactor: number; // 0..1 (1 = mondfrei)
  darkHours: number;
  dewRisk: boolean; // Temperatur nahe Taupunkt
  minSpread: number | null; // kleinster Abstand Temp − Taupunkt
}

/**
 * Nacht-Score (transparent, bewusst einfach gehalten):
 *   Wolkenfaktor = 1 − mittlere Gesamtbewölkung im Dunkel-Zeitraum
 *   Mondfaktor   = 1 − Anteil der Dunkelzeit mit Mond über Horizont × Mondbeleuchtung
 *   Score        = 100 × Wolkenfaktor × (0,5 + 0,5 × Mondfaktor) [× Ø Deep-Sky-Faktor aus Wind & Jetstream]
 * → Bedeckt = 0, klar + Vollmond die ganze Nacht = 50, klar + mondfrei = 100.
 */
export function scoreNight(n: NightAstro, w: WeatherData | null, o: RatingOptions = DEFAULT_RATING): NightScore {
  const dark = n.sun.dark;
  const darkMs = dark ? dark.end.getTime() - dark.start.getTime() : 0;
  const moonFraction = darkMs > 0 ? n.moon.upDuringDark / darkMs : 0;
  const moonFactor = 1 - moonFraction * n.moon.illumination;

  const hrs = dark ? hoursIn(w, dark.start, dark.end) : [];
  let cloudAvg: number | null = null;
  let minSpread: number | null = null;
  if (hrs.length > 0) {
    cloudAvg = hrs.reduce((s, h) => s + h.cloud, 0) / hrs.length;
    minSpread = Math.min(...hrs.map((h) => h.temp - h.dewPoint).filter((v) => !Number.isNaN(v)));
    if (!Number.isFinite(minSpread)) minSpread = null;
  }

  const dsf = hrs.length ? hrs.reduce((a, h) => a + deepSkyFactor(h, o), 0) / hrs.length : 1;
  let score: number | null = null;
  let level: NightScore['level'] = 'unbekannt';
  if (cloudAvg !== null && dark) {
    score = Math.round(100 * (1 - cloudAvg / 100) * (0.5 + 0.5 * moonFactor) * dsf);
    level = score >= 70 ? 'gut' : score >= 40 ? 'mittel' : 'schlecht';
  }
  return {
    score,
    level,
    cloudAvg,
    moonFactor,
    darkHours: darkMs / 3600000,
    dewRisk: minSpread !== null && minSpread < o.thresholds.dewSpread,
    minSpread,
  };
}
