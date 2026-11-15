import { describe, expect, it } from 'vitest';
import { validElevation } from './geocode';
import { computeNight } from './astro';
import { localNoon } from './time';

describe('validElevation', () => {
  it('verwirft den Platzhalter −9999 der Geocoding-API', () => {
    expect(validElevation(-9999)).toBeNull();
  });
  it('akzeptiert reale Höhen', () => {
    expect(validElevation(-430)).toBe(-430); // Totes Meer
    expect(validElevation(0)).toBe(0);
    expect(validElevation(2962)).toBe(2962); // Zugspitze
  });
  it('null/undefined/NaN → null', () => {
    expect(validElevation(null)).toBeNull();
    expect(validElevation(undefined)).toBeNull();
    expect(validElevation(NaN)).toBeNull();
  });
  it('Tromsø (Rückfall auf 0 m) lässt sich berechnen', () => {
    const iso = '2026-11-15';
    const n = computeNight(69.6489, 18.955, validElevation(-9999) ?? 0, localNoon(iso, 'Europe/Oslo'), iso);
    expect(n.sun.darkType).toBe('astronomisch');
  });
});
