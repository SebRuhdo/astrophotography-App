import { describe, expect, it } from 'vitest';
import { computeNight } from './astro';
import { DEFAULT_RATING } from './rating';
import { localNoon } from './time';
import type { WeatherData, WeatherHour } from './weather';
import { buildBlocks, hourCells, worst } from './weatherBlocks';

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

describe('Ampel-Raster und Zeitblöcke', () => {
  it('worst', () => {
    expect(worst(['gut', 'mittel', null])).toBe('mittel');
    expect(worst([null])).toBeNull();
  });

  it('Blöcke à 3 h, an 0/3/6 Uhr ausgerichtet, mit Ampel', () => {
    const cloudyUntil = night.sun.dark!.start.getTime() + 2 * 3600000;
    const cells = hourCells(night, wx((t) => ({ cloud: t.getTime() < cloudyUntil ? 90 : 5 })), DEFAULT_RATING);
    const blocks = buildBlocks(cells, DEFAULT_RATING, TZ);
    expect(blocks.length).toBeGreaterThanOrEqual(5); // Dezember: ~16 h Nacht
    for (const b of blocks) expect(new Intl.DateTimeFormat('de-DE', { timeZone: TZ, hour: 'numeric', hourCycle: 'h23' }).format(b.from).replace(/\D/g, '') as unknown as number % 3).toBe(0);
    expect(blocks[0].level).toBe('schlecht');
    expect(blocks[blocks.length - 2].level).toBe('gut');
    expect(blocks.some((b) => b.phase === 'nacht')).toBe(true);
  });

  it('Regen färbt den Block, Tau wird markiert', () => {
    const cells = hourCells(night, wx(() => ({ precipProb: 70, dewPoint: 4.5 })), DEFAULT_RATING);
    const b = buildBlocks(cells, DEFAULT_RATING, TZ)[0];
    expect(b.level).toBe('schlecht');
    expect(b.label).toBe('Regenrisiko'); // klar, aber 70 % Regenrisiko
    const cloudy = buildBlocks(hourCells(night, wx(() => ({ cloud: 90, precipProb: 45 })), DEFAULT_RATING), DEFAULT_RATING, TZ)[0];
    expect(cloudy.label).toBe('bewölkt');
    expect(b.dew).toBe(true);
    expect(cells[0].dew).toBe('schlecht'); // Abstand 0,5 °C < 2,5/2
  });

  it('Jetstream nur im Deep-Sky-Profil', () => {
    const w = wx(() => ({ jet: 200 }));
    expect(hourCells(night, w, DEFAULT_RATING)[0].jet).toBeNull();
    const ds = { ...DEFAULT_RATING, profile: 'deepsky' as const };
    expect(hourCells(night, w, ds)[0].jet).toBe('schlecht');
    expect(buildBlocks(hourCells(night, w, ds), ds, TZ)[0].label).toBe('klar, aber unruhig');
  });
});
