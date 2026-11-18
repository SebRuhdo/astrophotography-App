import { describe, expect, it } from 'vitest';
import { computeNight } from './astro';
import { DEFAULT_RATING } from './rating';
import { localNoon } from './time';
import type { WeatherData, WeatherHour } from './weather';
import { summarizeWeather } from './weatherSummary';

const TZ = 'Europe/Berlin';
const iso = '2026-12-08';
const t0 = localNoon(iso, TZ);
const night = computeNight(48.14, 11.58, 520, t0, iso, { planets: false });

function wx(f: (t: Date) => Partial<WeatherHour>): WeatherData {
  const hours = Array.from({ length: 30 }, (_, i) => {
    const t = new Date(t0.getTime() + i * 3600000);
    return { t, cloud: 0, cloudLow: 0, cloudMid: 0, cloudHigh: 0, temp: 5, dewPoint: -2, humidity: 60, wind: 5, gusts: 10, visibility: 20000, precipProb: 0, jet: 50, ...f(t) };
  });
  return { fetchedAt: Date.now(), timezone: TZ, elevation: 500, hours };
}

describe('summarizeWeather', () => {
  it('klare, ruhige Nacht', () => {
    const s = summarizeWeather(night, wx(() => ({})), DEFAULT_RATING, TZ);
    expect(s.map((x) => x.text)).toEqual(['Die ganze Nacht klar', 'Keine Taugefahr', 'Wind schwach (bis 5 km/h, Böen 10)']);
  });

  it('Aufklaren, Tau und Regen werden erkannt', () => {
    const clearFrom = night.sun.dark!.start.getTime() + 4 * 3600000;
    const dewFrom = night.sun.dark!.start.getTime() + 6 * 3600000;
    const s = summarizeWeather(
      night,
      wx((t) => ({ cloud: t.getTime() >= clearFrom ? 5 : 90, precipProb: t.getTime() < clearFrom ? 70 : 0, dewPoint: t.getTime() >= dewFrom ? 4 : -2 })),
      DEFAULT_RATING,
      TZ,
    );
    const texts = s.map((x) => x.text).join(' | ');
    expect(texts).toMatch(/^Klar \d\d–\d\d Uhr/);
    expect(texts).toMatch(/Regenrisiko bis 70 %/);
    expect(texts).toMatch(/Taugefahr ab \d\d Uhr/);
  });

  it('Seeing-Hinweis nur im Deep-Sky-Profil', () => {
    const w = wx(() => ({ jet: 150 }));
    expect(summarizeWeather(night, w, DEFAULT_RATING, TZ).some((x) => x.icon === '🔭')).toBe(false);
    const ds = summarizeWeather(night, w, { ...DEFAULT_RATING, profile: 'deepsky' }, TZ).find((x) => x.icon === '🔭');
    expect(ds?.level).toBe('schlecht');
  });

  it('ohne Wetterdaten leer', () => {
    expect(summarizeWeather(night, null, DEFAULT_RATING, TZ)).toEqual([]);
  });
});
