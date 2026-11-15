import { useState } from 'react';
import { Card, cloudStyle, fmtNum } from '../components/ui';
import { fmtTime } from '../lib/time';
import { jetClass, sevenTimerImageUrl } from '../lib/weather';
import type { CardProps } from './types';

const JET_COLOR = { gut: 'var(--good)', mittel: 'var(--mid)', schlecht: 'var(--bad)' } as const;

export function WeatherCard({ night, tz, weather, weatherError, weatherLoading, place }: CardProps) {
  const [show7t, setShow7t] = useState(false);
  const s = night.sun;
  const start = s.sunset ? s.sunset.getTime() - 3600000 : night.t0.getTime() + 5 * 3600000;
  const end = s.sunrise ? s.sunrise.getTime() + 3600000 : night.t1.getTime() - 5 * 3600000;
  const hours = weather ? weather.hours.filter((h) => h.t.getTime() >= start && h.t.getTime() <= end) : [];
  const inDark = (t: Date) => !!s.dark && t >= s.dark.start && t <= s.dark.end;
  const hasJet = hours.some((h) => h.jet !== null);

  return (
    <Card title="Wetter & Seeing" icon="☁️" wide>
      {weatherLoading && <p className="muted">Lade Wetterdaten …</p>}
      {weatherError && <div className="alert error">Wetterdaten konnten nicht geladen werden: {weatherError}</div>}
      {weather && hours.length === 0 && <div className="alert info">Für diese Nacht liegt noch keine stündliche Vorhersage vor (Open-Meteo: ca. 7 Tage).</div>}
      {hours.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Zeit</th>
                <th>Wolken</th>
                <th title="tiefe Wolken (bis ca. 2 km)">tief</th>
                <th title="mittelhohe Wolken (ca. 2–6 km)">mittel</th>
                <th title="hohe Wolken (ab ca. 6 km)">hoch</th>
                <th>Temp.</th>
                <th>Taupunkt</th>
                <th>Feuchte</th>
                <th>Wind</th>
                <th>Böen</th>
                <th>Sicht</th>
                <th>Regen</th>
                {hasJet && <th title="Windgeschwindigkeit in 250 hPa (~10 km Höhe)">Jetstream</th>}
              </tr>
            </thead>
            <tbody>
              {hours.map((h) => {
                const spread = h.temp - h.dewPoint;
                const jc = jetClass(h.jet);
                return (
                  <tr key={h.t.getTime()} className={inDark(h.t) ? 'dark' : ''}>
                    <td>{fmtTime(h.t, tz)}</td>
                    <td>
                      <span className="cell-bar" style={cloudStyle(h.cloud)}>
                        {fmtNum(h.cloud, ' %')}
                      </span>
                    </td>
                    <td>{fmtNum(h.cloudLow, ' %')}</td>
                    <td>{fmtNum(h.cloudMid, ' %')}</td>
                    <td>{fmtNum(h.cloudHigh, ' %')}</td>
                    <td>{fmtNum(h.temp, ' °C', 1)}</td>
                    <td style={spread < 2.5 ? { color: 'var(--mid)' } : undefined} title={spread < 2.5 ? 'Taugefahr' : undefined}>
                      {fmtNum(h.dewPoint, ' °C', 1)}
                    </td>
                    <td>{fmtNum(h.humidity, ' %')}</td>
                    <td>{fmtNum(h.wind, ' km/h')}</td>
                    <td>{fmtNum(h.gusts, ' km/h')}</td>
                    <td>{h.visibility === null ? '–' : fmtNum(h.visibility / 1000, ' km', h.visibility < 10000 ? 1 : 0)}</td>
                    <td>{fmtNum(h.precipProb, ' %')}</td>
                    {hasJet && <td style={jc ? { color: JET_COLOR[jc] } : undefined}>{fmtNum(h.jet, ' km/h')}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="tiny faint">
        Violetter Rand = Dunkelphase. Taupunkt gelb = Abstand zur Temperatur &lt; 2,5 °C (Taugefahr).
        {hasJet && ' Jetstream (Faustregel für Seeing): grün < 70 km/h, gelb < 130 km/h, rot darüber.'}
      </p>

      <h3>Seeing & Transparenz (7Timer! ASTRO, nächste 3 Tage)</h3>
      {show7t ? (
        <>
          <img
            className="seven-timer"
            src={sevenTimerImageUrl(place.lat, place.lon)}
            alt="7Timer ASTRO-Vorhersage: Bewölkung, Seeing, Transparenz"
            loading="lazy"
          />
          <p className="tiny faint">
            Grafik von <a href="https://www.7timer.info" target="_blank" rel="noreferrer">7timer.info</a>. Seeing-Skala 1 (&lt; 0,5″, sehr gut) bis 8 (&gt; 2,5″);
            Transparenz 1 (sehr klar) bis 8. Zeiten in der Grafik: lokale Zeitzone laut 7Timer.
          </p>
        </>
      ) : (
        <button className="btn small" onClick={() => setShow7t(true)}>
          Seeing-Grafik laden
        </button>
      )}
    </Card>
  );
}
