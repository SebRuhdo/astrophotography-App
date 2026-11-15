import { describe, expect, it } from 'vitest';
import { computeNight, moonPhaseName, compass } from './astro';
import { localNoon, zonedParts, addDaysIso } from './time';

const TZ = 'Europe/Berlin';

describe('Zeitzonen-Helfer', () => {
  it('lokaler Mittag in Berlin (Winterzeit = UTC+1)', () => {
    expect(localNoon('2026-01-15', TZ).toISOString()).toBe('2026-01-15T11:00:00.000Z');
  });
  it('lokaler Mittag in Berlin (Sommerzeit = UTC+2)', () => {
    expect(localNoon('2026-07-15', TZ).toISOString()).toBe('2026-07-15T10:00:00.000Z');
  });
  it('addDaysIso über Monatsgrenze', () => {
    expect(addDaysIso('2026-02-28', 1)).toBe('2026-03-01');
  });
});

describe('computeNight', () => {
  it('Reihenfolge der Dämmerungen im Winter (München)', () => {
    const iso = '2026-01-15';
    const n = computeNight(48.14, 11.58, 520, localNoon(iso, TZ), iso);
    const s = n.sun;
    expect(s.darkType).toBe('astronomisch');
    const seq = [s.sunset, s.civil!.start, s.nautical!.start, s.astronomical!.start, s.astronomical!.end, s.nautical!.end, s.civil!.end, s.sunrise];
    for (let i = 1; i < seq.length; i++) expect(seq[i]!.getTime()).toBeGreaterThan(seq[i - 1]!.getTime());
    // Sonnenuntergang im Januar in München zwischen 16 und 17 Uhr Ortszeit
    expect(zonedParts(s.sunset!, TZ).hour).toBe(16);
    // Goldene Stunde endet vor der Blauen Stunde
    expect(s.goldenEvening!.end.getTime()).toBeLessThanOrEqual(s.blueEvening!.start.getTime() + 1000);
  });

  it('Berlin zur Sommersonnenwende: keine astronomische Dunkelheit', () => {
    const iso = '2026-06-21';
    const n = computeNight(52.52, 13.405, 34, localNoon(iso, TZ), iso, { planets: false });
    expect(n.sun.astronomical).toBeNull();
    expect(n.sun.darkType).toBe('nautisch');
    expect(n.sun.minAltitude).toBeGreaterThan(-18);
  });

  it('Tromsø im Juni: Mitternachtssonne', () => {
    const iso = '2026-06-21';
    const n = computeNight(69.65, 18.96, 10, localNoon(iso, 'Europe/Oslo'), iso, { planets: false });
    expect(n.sun.sunset).toBeNull();
    expect(n.sun.darkType).toBe('keine');
    expect(n.sun.minAltitude).toBeGreaterThan(0);
  });

  it('Milchstraßenkern im Juli nachts sichtbar, im Dezember nicht (München)', () => {
    const jul = computeNight(48.14, 11.58, 520, localNoon('2026-07-20', TZ), '2026-07-20', { planets: false });
    expect(jul.milkyWay.visible.length).toBeGreaterThan(0);
    expect(jul.milkyWay.bestAz!).toBeGreaterThan(130);
    expect(jul.milkyWay.bestAz!).toBeLessThan(230);
    // max. Kulminationshöhe ≈ 90 − 48.14 − 29.01 ≈ 12.9°
    expect(jul.milkyWay.maxAlt24h).toBeGreaterThan(11);
    expect(jul.milkyWay.maxAlt24h).toBeLessThan(15);
    const dec = computeNight(48.14, 11.58, 520, localNoon('2026-12-20', TZ), '2026-12-20', { planets: false });
    expect(dec.milkyWay.visible.length).toBe(0);
  });

  it('liefert alle sieben Planeten', () => {
    const iso = '2026-11-14';
    const n = computeNight(48.14, 11.58, 520, localNoon(iso, TZ), iso);
    expect(n.planets.map((p) => p.name)).toEqual(['Merkur', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptun']);
    for (const p of n.planets) expect(p.magnitude).not.toBeNull();
  });
});

describe('Hilfsfunktionen', () => {
  it('Mondphasen-Namen', () => {
    expect(moonPhaseName(0)).toBe('Neumond');
    expect(moonPhaseName(90)).toBe('Erstes Viertel');
    expect(moonPhaseName(180)).toBe('Vollmond');
    expect(moonPhaseName(270)).toBe('Letztes Viertel');
    expect(moonPhaseName(359)).toBe('Neumond');
  });
  it('Himmelsrichtungen', () => {
    expect(compass(0)).toBe('N');
    expect(compass(90)).toBe('O');
    expect(compass(180)).toBe('S');
    expect(compass(247)).toBe('WSW');
    expect(compass(350)).toBe('N');
  });
});
