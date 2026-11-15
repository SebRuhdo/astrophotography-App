import { describe, expect, it } from 'vitest';
import { geomagneticLatitude, kpColor, kpLabel, kpThreshold, requiredStorm } from './aurora';

describe('geomagnetische Breite', () => {
  it('Pol ergibt 90°', () => {
    expect(geomagneticLatitude(80.85, -72.76)).toBeCloseTo(90, 5);
  });
  it('Mitteleuropa liegt geomagnetisch etwa auf gleicher Breite (Dipol-Näherung)', () => {
    const m = geomagneticLatitude(48.14, 11.58); // München
    expect(m).toBeGreaterThan(46);
    expect(m).toBeLessThan(50);
  });
  it('Nordamerika liegt geomagnetisch höher als geografisch', () => {
    expect(geomagneticLatitude(45, -93)).toBeGreaterThan(50);
  });
  it('Sturmstufe nach NOAA-Skala', () => {
    expect(requiredStorm(65)?.g).toBe('G1');
    expect(requiredStorm(56)?.g).toBe('G2');
    expect(requiredStorm(48)?.g).toBe('G4');
    expect(requiredStorm(30)).toBeNull();
  });
  it('Kp-Notation und NOAA-Schwellen', () => {
    expect(kpLabel(4.67)).toBe('5−');
    expect(kpLabel(5)).toBe('5');
    expect(kpLabel(5.33)).toBe('5+');
    expect(4.67 >= kpThreshold(5)).toBe(true); // 5− zählt als G1
    expect(4.33 >= kpThreshold(5)).toBe(false);
    expect(kpColor(4.67)).toBe(kpColor(5));
  });
});
