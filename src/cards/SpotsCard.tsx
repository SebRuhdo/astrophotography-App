import { useEffect, useMemo, useState } from 'react';
import { Card, ScoreChip, cloudStyle, fmtNum } from '../components/ui';
import { BestWindowBanner } from '../components/BestWindowBanner';
import { computeNight } from '../lib/astro';
import { findBestWindow } from '../lib/bestWindow';
import { validElevation } from '../lib/geocode';
import { scoreNight } from '../lib/score';
import type { Place } from '../lib/settings';
import { browserTz, localNoon } from '../lib/time';
import { fetchWeather, type WeatherData } from '../lib/weather';
import type { CardProps } from './types';

type WxState = { data: WeatherData | null; error: string | null; loading: boolean };

export function SpotsCard({ place, favorites, night, minAlt, selectPlace, rating }: CardProps) {
  const spots = useMemo(() => {
    const list: Place[] = [...favorites];
    if (!list.some((f) => f.id === place.id)) list.unshift(place);
    return list;
  }, [favorites, place]);
  const key = spots.map((s) => `${s.id}:${s.lat.toFixed(3)},${s.lon.toFixed(3)}`).join('|');
  const [wx, setWx] = useState<Record<string, WxState>>({});

  // Wetter nacheinander laden (nutzt den Zwischenspeicher, schont das API-Kontingent)
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      for (const s of spots) {
        if (ac.signal.aborted) return;
        setWx((w) => ({ ...w, [s.id]: { data: w[s.id]?.data ?? null, error: null, loading: true } }));
        try {
          const data = await fetchWeather(s.lat, s.lon, ac.signal);
          setWx((w) => ({ ...w, [s.id]: { data, error: null, loading: false } }));
        } catch (e) {
          if (ac.signal.aborted) return;
          setWx((w) => ({ ...w, [s.id]: { data: null, error: (e as Error).message, loading: false } }));
        }
      }
    })();
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const rows = useMemo(
    () =>
      spots
        .map((s) => {
          const tz = s.tz ?? browserTz();
          const n = computeNight(s.lat, s.lon, validElevation(s.elevation) ?? 0, localNoon(night.dateIso, tz), night.dateIso, {
            minAltitude: minAlt,
            planets: false,
          });
          const w = wx[s.id];
          return { s, tz, n, w, score: scoreNight(n, w?.data ?? null, rating), best: findBestWindow(n, w?.data ?? null, minAlt, rating) };
        })
        .sort((a, b) => (b.score.score ?? -1) - (a.score.score ?? -1)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, night.dateIso, minAlt, wx, rating],
  );

  return (
    <Card title="Spot-Vergleich" icon="📍" wide>
      {favorites.length === 0 && (
        <div className="alert info" style={{ marginTop: 0, marginBottom: 10 }}>
          Speichere Fotospots als Lieblingsorte (📍 → ★ Favoriten), um sie hier für die gewählte Nacht zu vergleichen.
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Spot</th>
              <th>Score</th>
              <th>Bestes Fenster</th>
              <th>Wolken</th>
              <th>MS-Kern</th>
              <th>Bortle</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ s, tz, n, w, score, best }) => (
              <tr key={s.id} className={s.id === place.id ? 'selected' : ''}>
                <td>
                  <strong>{s.name}</strong>
                  {w?.data?.stale && <span className="tiny faint"> 📴</span>}
                </td>
                <td>{w?.loading && !w.data ? <span className="faint">…</span> : <ScoreChip score={score} />}</td>
                <td>
                  <BestWindowBanner bw={best} tz={tz} compact />
                </td>
                <td>
                  {w?.error ? (
                    <span className="faint" title={w.error}>
                      Fehler
                    </span>
                  ) : score.cloudAvg === null ? (
                    <span className="faint">–</span>
                  ) : (
                    <span className="cell-bar" style={cloudStyle(score.cloudAvg)}>
                      {fmtNum(score.cloudAvg, ' %')}
                    </span>
                  )}
                </td>
                <td>{n.milkyWay.visible.length ? '✓' : '–'}</td>
                <td>{s.bortle ?? <span className="faint">–</span>}</td>
                <td>
                  {s.id !== place.id && (
                    <button className="btn small" onClick={() => selectPlace(s)}>
                      Anzeigen
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="tiny faint">Sortiert nach Score für die gewählte Nacht. Das Wetter jedes Spots wird 30 min zwischengespeichert.</p>
    </Card>
  );
}
