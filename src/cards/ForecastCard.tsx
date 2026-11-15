import { Card, ScoreChip, cloudStyle, fmtNum } from '../components/ui';
import { fmtDateShort, fmtTime } from '../lib/time';
import type { CardProps } from './types';

export function ForecastCard({ forecast, night, tz, selectDate }: CardProps) {
  return (
    <Card title="7-Nächte-Vorschau" icon="📅">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nacht</th>
              <th>Score</th>
              <th>Wolken</th>
              <th>Mond</th>
              <th>Dunkel</th>
              <th>MS-Kern</th>
            </tr>
          </thead>
          <tbody>
            {forecast.map((f) => (
              <tr
                key={f.dateIso}
                className={`clickable${f.dateIso === night.dateIso ? ' selected' : ''}`}
                onClick={() => selectDate(f.dateIso)}
                title="Diese Nacht anzeigen"
              >
                <td>{fmtDateShort(f.dateIso)}</td>
                <td>
                  <ScoreChip score={f.score} />
                </td>
                <td>{f.score.cloudAvg === null ? <span className="faint">–</span> : <span className="cell-bar" style={cloudStyle(f.score.cloudAvg)}>{fmtNum(f.score.cloudAvg, ' %')}</span>}</td>
                <td>{Math.round(f.night.moon.illumination * 100)} %</td>
                <td>{f.night.sun.dark ? `${fmtTime(f.night.sun.dark.start, tz)}–${fmtTime(f.night.sun.dark.end, tz)}` : '–'}</td>
                <td>{f.night.milkyWay.visible.length ? '✓' : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="tiny faint">
        Score = 100 × (1 − Bewölkung) × (0,5 + 0,5 × Mondfaktor). Grün ≥ 70, Gelb ≥ 40, Rot &lt; 40. Wettervorhersage reicht ca. 7 Tage.
      </p>
    </Card>
  );
}
