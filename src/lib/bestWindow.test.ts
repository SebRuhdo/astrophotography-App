import { describe, expect, it } from 'vitest';
import { computeNight } from './astro';
import { findBestWindow } from './bestWindow';
import { localNoon } from './time';
import type { WeatherData } from './weather';

const TZ = 'Europe/Berlin';
function weatherFor(start: Date, cloud: (t: Date) => number): WeatherData {
  const hours = Array.from({ length: 30 }, (_, i) => {
    const t = new Date(start.getTime() + i * 3600000);
    return { t, cloud: cloud(t), cloudLow: 0, cloudMid: 0, cloudHigh: 0, temp: 0, dewPoint: -5, humidity: 70, wind: 5, gusts: 10, visibility: 20000, precipProb: 0, jet: null };
  });
  return { fetchedAt: Date.now(), timezone: TZ, elevation: 500, hours };
}

describe('findBestWindow', () => {
  // Neumond am 09.12.2026 → Nacht 08./09.12. praktisch mondfrei
  const iso = '2026-12-08';
  const t0 = localNoon(iso, TZ);
  const night = computeNight(48.14, 11.58, 520, t0, iso, { planets: false });

  it('klare Neumondnacht → gut, fast die ganze Dunkelphase', () => {
    const w = findBestWindow(night, weatherFor(t0, () => 0), 5);
    expect(w.level).toBe('gut');
    const darkMs = night.sun.dark!.end.getTime() - night.sun.dark!.start.getTime();
    expect(w.interval!.end.getTime() - w.interval!.start.getTime()).toBeGreaterThan(darkMs * 0.9);
    expect(w.withWeather).toBe(true);
    expect(w.cloudAvg).toBe(0);
  });

  it('bedeckt → schlecht mit Begründung', () => {
    const w = findBestWindow(night, weatherFor(t0, () => 100), 5);
    expect(w.level).toBe('schlecht');
    expect(w.interval).toBeNull();
    expect(w.reason).toMatch(/bewölkt/);
  });

  it('Wolkenlücke → Fenster liegt in der Lücke', () => {
    const gapStart = night.sun.dark!.start.getTime() + 3 * 3600000;
    const gapEnd = gapStart + 3 * 3600000;
    const w = findBestWindow(night, weatherFor(t0, (t) => (t.getTime() >= gapStart && t.getTime() <= gapEnd ? 5 : 95)), 5);
    expect(w.level).toBe('gut');
    expect(w.interval!.start.getTime()).toBeGreaterThanOrEqual(gapStart - 3600000);
    expect(w.interval!.end.getTime()).toBeLessThanOrEqual(gapEnd + 3600000);
  });

  it('ohne Wetterdaten → nur nach Mond/Dunkelheit', () => {
    const w = findBestWindow(night, null, 5);
    expect(w.withWeather).toBe(false);
    expect(w.level).toBe('gut');
  });

  it('Mitternachtssonne → keine Dunkelheit', () => {
    const n = computeNight(69.65, 18.96, 10, localNoon('2026-06-21', 'Europe/Oslo'), '2026-06-21', { planets: false });
    expect(findBestWindow(n, null, 5).level).toBe('keine-dunkelheit');
  });
});

describe('findBestWindow – Profile', () => {
  const iso2 = '2026-12-08';
  const t02 = localNoon(iso2, TZ);
  const n2 = computeNight(48.14, 11.58, 520, t02, iso2, { planets: false });
  it('starker Jetstream verschlechtert nur im Deep-Sky-Profil', () => {
    const w = weatherFor(t02, () => 0);
    w.hours.forEach((h) => (h.jet = 200));
    const base = { thresholds: { cloudGood: 20, cloudBad: 60, dewSpread: 2.5, windGood: 15, windBad: 30, jetGood: 70, jetBad: 130 } };
    expect(findBestWindow(n2, w, 5, { ...base, profile: 'landscape' }).level).toBe('gut');
    expect(findBestWindow(n2, w, 5, { ...base, profile: 'deepsky' }).level).toBe('mittel');
  });
});
