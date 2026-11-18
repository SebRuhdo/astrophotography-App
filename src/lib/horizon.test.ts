import { describe, expect, it } from 'vitest';
import { computeTerrainHorizon, destination, elevationAngle, makeHorizon, TERRAIN_DIRS, type ElevationFetcher } from './horizon';
import { computeNight } from './astro';
import { localNoon } from './time';

const R = 6371000;
const dist = (a: [number, number], b: [number, number]) => {
  const r = Math.PI / 180;
  const dφ = (b[0] - a[0]) * r;
  const dλ = (b[1] - a[1]) * r;
  const h = Math.sin(dφ / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dλ / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

describe('Geometrie', () => {
  it('destination: 10 km nach Osten', () => {
    const p = destination(48, 11, 90, 10000);
    expect(dist([48, 11], p)).toBeCloseTo(10000, -1);
    expect(p[1]).toBeGreaterThan(11);
  });
  it('Höhenwinkel: 1000 m Berg in 10 km ≈ 5,7°, Erdkrümmung senkt leicht', () => {
    const a = elevationAngle(0, 1000, 10000);
    expect(a).toBeGreaterThan(5.6);
    expect(a).toBeLessThan(5.72);
  });
});

describe('computeTerrainHorizon (simuliertes Gelände)', () => {
  const lat = 47.5;
  const lon = 11;
  const peak = destination(lat, lon, 90, 10000); // Bergkegel 10 km östlich
  const fetcher: ElevationFetcher = async (pts) =>
    pts.map((p) => {
      const d = dist(p, peak);
      return 500 + Math.max(0, 1500 * (1 - d / 3000)); // 2000 m Gipfel, Radius 3 km, Tal 500 m
    });

  it('Berg im Osten, freie Sicht im Westen', async () => {
    const { terrain, groundElevation } = await computeTerrainHorizon(lat, lon, fetcher);
    expect(terrain).toHaveLength(TERRAIN_DIRS);
    expect(groundElevation).toBeCloseTo(500, 0);
    const east = terrain[90 / 5];
    const west = terrain[270 / 5];
    expect(east).toBeGreaterThan(7.5); // ≈ atan(1500/10000) ≈ 8,5°
    expect(east).toBeLessThan(9);
    expect(west).toBeLessThan(0.1);
  });
});

describe('makeHorizon', () => {
  it('ohne Daten → undefined', () => {
    expect(makeHorizon(null)).toBeUndefined();
    expect(makeHorizon({ terrain: null, manual: [] })).toBeUndefined();
  });
  it('Gelände wird interpoliert, manuelle Punkte heben an', () => {
    const terrain = Array.from({ length: TERRAIN_DIRS }, (_, i) => (i === 18 ? 10 : 0)); // 90° = 10°
    const hz = makeHorizon({ terrain, manual: [{ az: 200, alt: 15, at: 0 }, { az: 210, alt: 12, at: 0 }] })!;
    expect(hz(90)).toBeCloseTo(10);
    expect(hz(92.5)).toBeCloseTo(5);
    expect(hz(205)).toBeCloseTo(13.5); // zwischen zwei manuellen Punkten
    expect(hz(300)).toBeCloseTo(0);
    expect(hz(201)).toBeGreaterThan(14);
  });
  it('einzelner manueller Punkt wirkt nur ±2,5°', () => {
    const hz = makeHorizon({ terrain: null, manual: [{ az: 0, alt: 8, at: 0 }] })!;
    expect(hz(359)).toBe(8);
    expect(hz(2)).toBe(8);
    expect(hz(10)).toBe(0);
  });
  it('über 0°/360° hinweg verbunden', () => {
    const hz = makeHorizon({ terrain: null, manual: [{ az: 355, alt: 10, at: 0 }, { az: 5, alt: 20, at: 0 }] })!;
    expect(hz(0)).toBeCloseTo(15);
  });
});

describe('computeNight mit Horizont', () => {
  const iso = '2027-07-08';
  const t0 = localNoon(iso, 'Europe/Berlin');
  it('Bergkette im Süden verdeckt den Milchstraßen-Kern', () => {
    const free = computeNight(48.14, 11.58, 520, t0, iso, { planets: false });
    const south = computeNight(48.14, 11.58, 520, t0, iso, { planets: false, horizon: (az) => (az > 120 && az < 240 ? 15 : 0) });
    expect(free.milkyWay.visible.length).toBeGreaterThan(0);
    expect(south.milkyWay.visible.length).toBe(0); // Kern kulminiert in München bei ~13°
  });
  it('Sonne verschwindet hinter Bergen im Westen früher', () => {
    const n = computeNight(48.14, 11.58, 520, t0, iso, { planets: false, horizon: (az) => (az > 270 && az < 330 ? 5 : 0) });
    expect(n.sun.terrainSet).not.toBeNull();
    expect(n.sun.terrainSet!.getTime()).toBeLessThan(n.sun.sunset!.getTime());
    const diffMin = (n.sun.sunset!.getTime() - n.sun.terrainSet!.getTime()) / 60000;
    expect(diffMin).toBeGreaterThan(20); // 5° ≈ 30–45 min im Sommer
    expect(diffMin).toBeLessThan(70);
  });
});
