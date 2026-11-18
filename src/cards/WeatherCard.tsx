import { useMemo, useState } from 'react';
import { Card, fmtNum } from '../components/ui';
import { LEVEL_COLOR, PROFILE_LABELS, dewRisk, type Profile } from '../lib/rating';
import { fmtTime, zonedParts } from '../lib/time';
import { ageText, sevenTimerImageUrl } from '../lib/weather';
import { buildBlocks, hourCells, type Cell, type HourCells } from '../lib/weatherBlocks';
import { summarizeWeather } from '../lib/weatherSummary';
import type { CardProps } from './types';

const DOT: Record<string, string> = { gut: '🟢', mittel: '🟡', schlecht: '🔴' };
const PHASE: Record<string, string> = { tag: '☀️', dämmerung: '🌆', nacht: '🌑' };
const hh = (t: Date, tz: string) => String(zonedParts(t, tz).hour).padStart(2, '0');

function skyColor(alt: number): string {
  if (alt > 0) return '#4a78c8';
  if (alt > -6) return '#2c4782';
  if (alt > -12) return '#1b2c5a';
  if (alt > -18) return '#111b3b';
  return '#04060e';
}

function cellStyle(c: Cell) {
  return c ? { background: `color-mix(in srgb, ${LEVEL_COLOR[c]} 55%, transparent)` } : { background: 'rgba(255,255,255,0.04)' };
}

export function WeatherCard({ night, tz, weather, weatherError, weatherLoading, place, rating, setProfile }: CardProps) {
  const [showTable, setShowTable] = useState(false);
  const [show7t, setShow7t] = useState(false);
  const [sel, setSel] = useState<number | null>(null);
  const deep = rating.profile === 'deepsky';
  const cells = useMemo(() => hourCells(night, weather, rating), [night, weather, rating]);
  const blocks = useMemo(() => buildBlocks(cells, rating, tz), [cells, rating, tz]);
  const summary = summarizeWeather(night, weather, rating, tz);
  const s = night.sun;
  const inDark = (d: Date) => !!s.dark && d >= s.dark.start && d <= s.dark.end;
  const selCell: HourCells | null = sel !== null ? (cells[sel] ?? null) : null;

  const rows: { key: keyof HourCells; label: string; value: (c: HourCells) => string }[] = [
    { key: 'cloud', label: 'Wolken', value: (c) => fmtNum(c.h.cloud) },
    { key: 'rain', label: 'Regen', value: (c) => (c.h.precipProb ? fmtNum(c.h.precipProb) : '') },
    { key: 'dew', label: 'Tau', value: (c) => (c.dew && c.dew !== 'gut' ? '💧' : '') },
    { key: 'wind', label: 'Wind', value: (c) => fmtNum(c.h.wind) },
    ...(deep ? [{ key: 'jet' as const, label: 'Jetstr.', value: (c: HourCells) => (c.h.jet === null ? '' : fmtNum(c.h.jet / 10)) }] : []),
  ];

  return (
    <Card title="Wetter & Seeing" icon="☁️" wide>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: -4, marginBottom: 10 }}>
        <span className="tiny muted">Profil:</span>
        <div className="seg" role="group" aria-label="Profil">
          {(['landscape', 'deepsky'] as Profile[]).map((p) => (
            <button key={p} aria-pressed={rating.profile === p} onClick={() => setProfile(p)} title={PROFILE_LABELS[p]}>
              {p === 'landscape' ? '🏞️ Landschaft' : '🔭 Deep-Sky'}
            </button>
          ))}
        </div>
      </div>

      {weatherLoading && <p className="muted">Lade Wetterdaten …</p>}
      {weatherError && <div className="alert error">Wetterdaten konnten nicht geladen werden: {weatherError}</div>}
      {weather && cells.length < 2 && <div className="alert info">Für diese Nacht liegt noch keine stündliche Vorhersage vor (Open-Meteo: ca. 7 Tage).</div>}

      {summary.length > 0 && (
        <ul className="wx-summary">
          {summary.map((it) => (
            <li key={it.text} style={{ ['--c' as string]: LEVEL_COLOR[it.level] }}>
              <span aria-hidden>{it.icon}</span> {it.text}
            </li>
          ))}
        </ul>
      )}

      {blocks.length > 0 && (
        <div className="wx-tiles">
          {blocks.map((b) => (
            <div key={b.from.getTime()} className="wx-tile" style={{ ['--c' as string]: LEVEL_COLOR[b.level] }}>
              <div className="wx-tile-head">
                <span>
                  {PHASE[b.phase]} {hh(b.from, tz)}–{hh(b.to, tz)} Uhr
                </span>
              </div>
              <div className="wx-tile-level">
                {DOT[b.level]} {b.label}
              </div>
              <div className="wx-tile-vals">
                <span>☁️ {fmtNum(b.cloudAvg, ' %')}</span>
                {b.rainMax >= 10 && <span>🌧️ {fmtNum(b.rainMax, ' %')}</span>}
                <span>
                  🌡️ {fmtNum(b.tempMin, '', 0)}…{fmtNum(b.tempMax, ' °C', 0)}
                </span>
                <span>🌬️ {fmtNum(b.windMax, ' km/h')}</span>
                {b.dew && <span style={{ color: 'var(--mid)' }}>💧 Tau</span>}
                {deep && b.jetMax !== null && <span>🔭 Jet {fmtNum(b.jetMax, ' km/h')}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {cells.length > 0 && (
        <>
          <h3>Stündlich</h3>
          <div className="table-wrap">
            <div className="wx-grid" style={{ gridTemplateColumns: `64px repeat(${cells.length}, minmax(30px, 1fr))` }} role="grid" aria-label="Stündliche Ampel">
              <div className="wx-grid-label" />
              {cells.map((c, i) => (
                <button key={`t${i}`} className={`wx-grid-time${sel === i ? ' sel' : ''}`} onClick={() => setSel(sel === i ? null : i)}>
                  {hh(c.h.t, tz)}
                </button>
              ))}
              <div className="wx-grid-label">Himmel</div>
              {cells.map((c, i) => (
                <div key={`s${i}`} className="wx-grid-sky" style={{ background: skyColor(c.sunAlt) }} title={inDark(c.h.t) ? 'dunkel' : 'hell/Dämmerung'} />
              ))}
              {rows.map((r) => (
                <div key={r.key} style={{ display: 'contents' }}>
                  <div className="wx-grid-label">{r.label}</div>
                  {cells.map((c, i) => (
                    <button
                      key={`${r.key}${i}`}
                      className={`wx-grid-cell${sel === i ? ' sel' : ''}`}
                      style={cellStyle(c[r.key] as Cell)}
                      onClick={() => setSel(sel === i ? null : i)}
                      aria-label={`${fmtTime(c.h.t, tz)} ${r.label}`}
                    >
                      {r.value(c)}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
          {selCell ? (
            <div className="wx-readout">
              <strong>{fmtTime(selCell.h.t, tz)}</strong>
              <span>
                ☁️ {fmtNum(selCell.h.cloud, ' %')}{' '}
                <span className="faint">
                  (tief {fmtNum(selCell.h.cloudLow)} · mittel {fmtNum(selCell.h.cloudMid)} · hoch {fmtNum(selCell.h.cloudHigh)})
                </span>
              </span>
              <span>🌧️ {fmtNum(selCell.h.precipProb, ' %')}</span>
              <span>
                🌡️ {fmtNum(selCell.h.temp, ' °C', 1)} / Tau {fmtNum(selCell.h.dewPoint, ' °C', 1)}
                {dewRisk(selCell.h, rating) && <span style={{ color: 'var(--mid)' }}> 💧</span>}
              </span>
              <span>
                🌬️ {fmtNum(selCell.h.wind)} <span className="faint">(Böen {fmtNum(selCell.h.gusts)})</span> km/h
              </span>
              {deep && selCell.h.jet !== null && <span>🔭 Jetstream {fmtNum(selCell.h.jet, ' km/h')}</span>}
            </div>
          ) : (
            <p className="tiny muted" style={{ margin: '4px 0 0' }}>
              Tippe auf eine Stunde für alle Werte.
            </p>
          )}
        </>
      )}

      {weather && (
        <p className="tiny faint">
          {weather.stale ? '📴 Offline – zwischengespeicherte Daten, ' : ''}Stand {ageText(weather.fetchedAt)}. Zahlen im Raster: Wolken in %, Regenrisiko in %, Wind in km/h
          {deep ? ', Jetstream in 10 km/h' : ''}. Grün/Gelb/Rot nach den Grenzwerten in den Einstellungen (⚙️); Regen ab 30/60 %.
          {deep ? ' Deep-Sky: Wind und Jetstream fließen in Score und bestes Fenster ein.' : ' Landschaft: Bewertung nach Wolken und Mond.'}
        </p>
      )}

      <div className="row" style={{ marginTop: 6 }}>
        {cells.length > 0 && (
          <button className="btn small" aria-expanded={showTable} onClick={() => setShowTable((v) => !v)}>
            {showTable ? '▾' : '▸'} Alle Werte als Tabelle
          </button>
        )}
        <button className="btn small" aria-expanded={show7t} onClick={() => setShow7t((v) => !v)}>
          {show7t ? '▾' : '▸'} Seeing & Transparenz (7Timer!)
        </button>
      </div>

      {showTable && cells.length > 0 && (
        <div className="table-wrap" style={{ marginTop: 10 }}>
          <table>
            <thead>
              <tr>
                <th>Zeit</th>
                <th>Wolken</th>
                <th title="tiefe Wolken (bis ca. 2 km)">tief</th>
                <th title="mittelhohe Wolken (ca. 2–6 km)">mittel</th>
                <th title="hohe Wolken (ab ca. 6 km)">hoch</th>
                <th>Regen</th>
                <th>Temp.</th>
                <th>Taupunkt</th>
                <th>Feuchte</th>
                <th>Wind</th>
                <th>Böen</th>
                <th>Sicht</th>
                {deep && <th title="Windgeschwindigkeit in 250 hPa (~10 km Höhe)">Jetstream</th>}
              </tr>
            </thead>
            <tbody>
              {cells.map(({ h }) => (
                <tr key={h.t.getTime()} className={inDark(h.t) ? 'dark' : ''}>
                  <td>{fmtTime(h.t, tz)}</td>
                  <td>{fmtNum(h.cloud, ' %')}</td>
                  <td>{fmtNum(h.cloudLow, ' %')}</td>
                  <td>{fmtNum(h.cloudMid, ' %')}</td>
                  <td>{fmtNum(h.cloudHigh, ' %')}</td>
                  <td>{fmtNum(h.precipProb, ' %')}</td>
                  <td>{fmtNum(h.temp, ' °C', 1)}</td>
                  <td>{fmtNum(h.dewPoint, ' °C', 1)}</td>
                  <td>{fmtNum(h.humidity, ' %')}</td>
                  <td>{fmtNum(h.wind, ' km/h')}</td>
                  <td>{fmtNum(h.gusts, ' km/h')}</td>
                  <td>{h.visibility === null ? '–' : fmtNum(h.visibility / 1000, ' km', h.visibility < 10000 ? 1 : 0)}</td>
                  {deep && <td>{fmtNum(h.jet, ' km/h')}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {show7t && (
        <div style={{ marginTop: 10 }}>
          <img className="seven-timer" src={sevenTimerImageUrl(place.lat, place.lon)} alt="7Timer ASTRO-Vorhersage: Bewölkung, Seeing, Transparenz" loading="lazy" />
          <p className="tiny faint">
            Grafik von <a href="https://www.7timer.info" target="_blank" rel="noreferrer">7timer.info</a> (nächste 3 Tage, eigenes Modell). Seeing-Skala 1 (&lt; 0,5″, sehr gut)
            bis 8 (&gt; 2,5″); Transparenz 1 (sehr klar) bis 8.
          </p>
        </div>
      )}
    </Card>
  );
}
