import { useState } from 'react';
import { Card, fmtNum } from '../components/ui';
import { WeatherChart } from '../components/WeatherChart';
import { classify, dewRisk, LEVEL_COLOR, PROFILE_LABELS, type Profile } from '../lib/rating';
import { fmtTime } from '../lib/time';
import { ageText, sevenTimerImageUrl } from '../lib/weather';
import { summarizeWeather } from '../lib/weatherSummary';
import type { CardProps } from './types';

export function WeatherCard({ night, tz, weather, weatherError, weatherLoading, place, rating, setProfile }: CardProps) {
  const [showTable, setShowTable] = useState(false);
  const [show7t, setShow7t] = useState(false);
  const s = night.sun;
  const t = rating.thresholds;
  const deep = rating.profile === 'deepsky';
  const start = s.sunset ? s.sunset.getTime() - 3600000 : night.t0.getTime() + 5 * 3600000;
  const end = s.sunrise ? s.sunrise.getTime() + 3600000 : night.t1.getTime() - 5 * 3600000;
  const hours = weather ? weather.hours.filter((h) => h.t.getTime() >= start - 1800000 && h.t.getTime() <= end + 1800000) : [];
  const inDark = (d: Date) => !!s.dark && d >= s.dark.start && d <= s.dark.end;
  const summary = summarizeWeather(night, weather, rating, tz);
  const color = (v: number | null, good: number, bad: number) => {
    const l = classify(v, good, bad);
    return l && l !== 'gut' ? { color: LEVEL_COLOR[l] } : undefined;
  };

  const profileSwitch = (
    <div className="seg" role="group" aria-label="Profil">
      {(['landscape', 'deepsky'] as Profile[]).map((p) => (
        <button key={p} aria-pressed={rating.profile === p} onClick={() => setProfile(p)} title={PROFILE_LABELS[p]}>
          {p === 'landscape' ? '🏞️ Landschaft' : '🔭 Deep-Sky'}
        </button>
      ))}
    </div>
  );

  return (
    <Card title="Wetter & Seeing" icon="☁️" wide>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: -4, marginBottom: 10 }}>
        <span className="tiny muted">Profil:</span>
        {profileSwitch}
      </div>
      {weatherLoading && <p className="muted">Lade Wetterdaten …</p>}
      {weatherError && <div className="alert error">Wetterdaten konnten nicht geladen werden: {weatherError}</div>}
      {weather && hours.length < 2 && <div className="alert info">Für diese Nacht liegt noch keine stündliche Vorhersage vor (Open-Meteo: ca. 7 Tage).</div>}

      {summary.length > 0 && (
        <ul className="wx-summary">
          {summary.map((it) => (
            <li key={it.text} style={{ ['--c' as string]: LEVEL_COLOR[it.level] }}>
              <span aria-hidden>{it.icon}</span> {it.text}
            </li>
          ))}
        </ul>
      )}

      {hours.length >= 2 && <WeatherChart hours={hours} night={night} tz={tz} rating={rating} />}

      {weather && (
        <p className="tiny faint">
          {weather.stale ? '📴 Offline – zwischengespeicherte Daten, ' : ''}Stand {ageText(weather.fetchedAt)} · Tippe ins Diagramm für die Werte einer Stunde. Grenzwerte in den
          Einstellungen (⚙️) änderbar.
          {deep
            ? ' Deep-Sky: Wind und Jetstream fließen in Score und bestes Fenster ein.'
            : ' Landschaft: Bewertung nach Wolken und Mond; Jetstream/Seeing ausgeblendet.'}
        </p>
      )}

      <div className="row" style={{ marginTop: 6 }}>
        {hours.length > 0 && (
          <button className="btn small" aria-expanded={showTable} onClick={() => setShowTable((v) => !v)}>
            {showTable ? '▾' : '▸'} Stundenwerte als Tabelle
          </button>
        )}
        <button className="btn small" aria-expanded={show7t} onClick={() => setShow7t((v) => !v)}>
          {show7t ? '▾' : '▸'} Seeing & Transparenz (7Timer!)
        </button>
      </div>

      {showTable && hours.length > 0 && (
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
              {hours.map((h) => (
                <tr key={h.t.getTime()} className={inDark(h.t) ? 'dark' : ''}>
                  <td>{fmtTime(h.t, tz)}</td>
                  <td style={color(h.cloud, t.cloudGood, t.cloudBad)}>{fmtNum(h.cloud, ' %')}</td>
                  <td>{fmtNum(h.cloudLow, ' %')}</td>
                  <td>{fmtNum(h.cloudMid, ' %')}</td>
                  <td>{fmtNum(h.cloudHigh, ' %')}</td>
                  <td>{fmtNum(h.precipProb, ' %')}</td>
                  <td>{fmtNum(h.temp, ' °C', 1)}</td>
                  <td style={dewRisk(h, rating) ? { color: 'var(--mid)' } : undefined}>{fmtNum(h.dewPoint, ' °C', 1)}</td>
                  <td>{fmtNum(h.humidity, ' %')}</td>
                  <td style={color(h.wind, t.windGood, t.windBad)}>{fmtNum(h.wind, ' km/h')}</td>
                  <td>{fmtNum(h.gusts, ' km/h')}</td>
                  <td>{h.visibility === null ? '–' : fmtNum(h.visibility / 1000, ' km', h.visibility < 10000 ? 1 : 0)}</td>
                  {deep && <td style={color(h.jet, t.jetGood, t.jetBad)}>{fmtNum(h.jet, ' km/h')}</td>}
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
