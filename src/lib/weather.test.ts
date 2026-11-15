import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchWeather } from './weather';

const raw = {
  timezone: 'Europe/Berlin',
  elevation: 520,
  hourly: { time: [1763200800], cloud_cover: [42], cloud_cover_low: [1], cloud_cover_mid: [2], cloud_cover_high: [3] },
};

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

describe('fetchWeather offline', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('nutzt veralteten Cache, wenn das Netz fehlt, und markiert ihn', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(raw), { status: 200 })));
    await fetchWeather(48.1, 11.6);
    // 2 h später, Netzwerk weg
    vi.useFakeTimers({ now: Date.now() + 2 * 3600000, toFake: ['Date'] });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const w = await fetchWeather(48.1, 11.6);
    expect(w.stale).toBe(true);
    expect(w.hours[0].cloud).toBe(42);
  });

  it('ohne Cache und ohne Netz → Fehler', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(fetchWeather(10, 10)).rejects.toThrow(/Verbindung/);
  });

  it('frischer Cache → kein Netzwerkzugriff', async () => {
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify(raw), { status: 200 }));
    vi.stubGlobal('fetch', f);
    await fetchWeather(1, 2);
    await fetchWeather(1, 2);
    expect(f).toHaveBeenCalledTimes(1);
  });
});
