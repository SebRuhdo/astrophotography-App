import { Card, fmtDeg } from '../components/ui';
import { compass } from '../lib/astro';
import { fmtTime, fmtTimeDay } from '../lib/time';
import type { CardProps } from './types';

export function PlanetsCard({ night, tz, minAlt }: CardProps) {
  return (
    <Card title="Planeten" icon="🪐" wide>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Planet</th>
              <th>Aufgang</th>
              <th>Untergang</th>
              <th>Kulmination</th>
              <th>Sichtbar (Nacht)</th>
              <th>Beste Zeit</th>
              <th>Höhe / Richtung</th>
              <th>Hellig&shy;keit</th>
              <th>Sternbild</th>
            </tr>
          </thead>
          <tbody>
            {night.planets.map((p) => (
              <tr key={p.name} className={p.visible.length ? 'dark' : ''}>
                <td>
                  <strong>{p.name}</strong>
                </td>
                <td>{fmtTimeDay(p.rise, tz)}</td>
                <td>{fmtTimeDay(p.set, tz)}</td>
                <td>
                  {fmtTimeDay(p.transit, tz)} <span className="faint">{fmtDeg(p.transitAlt)}</span>
                </td>
                <td>{p.visible.length ? p.visible.map((i) => `${fmtTime(i.start, tz)}–${fmtTime(i.end, tz)}`).join(', ') : <span className="faint">nicht sichtbar</span>}</td>
                <td>{fmtTime(p.bestTime, tz)}</td>
                <td>{p.bestAlt !== null ? `${fmtDeg(p.bestAlt)} ${compass(p.bestAz)}` : '–'}</td>
                <td>{p.magnitude !== null ? `${p.magnitude.toFixed(1)} mag` : '–'}</td>
                <td>{p.constellation ?? '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="tiny faint">
        Sichtbar = Planet über {minAlt}° und Sonne unter −6°. Je kleiner die Magnitude, desto heller. Mit bloßem Auge unter dunklem Himmel bis ca. 6 mag – Neptun nur mit Optik.
      </p>
    </Card>
  );
}
