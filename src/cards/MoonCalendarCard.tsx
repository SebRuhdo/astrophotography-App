import { useMemo } from 'react';
import { Card } from '../components/ui';
import { moonQuarters, QUARTER_NAMES, type MoonQuarterEvent } from '../lib/astro';
import { zonedParts } from '../lib/time';
import type { CardProps } from './types';

const ICONS = ['🌑', '🌓', '🌕', '🌗'];
const SHORT = ['Neumond', '1. Viertel', 'Vollmond', 'Letztes V.'];

/** Datum der Nacht, in die ein Ereignis fällt (vor 12 Uhr → vorige Nacht). */
function nightIsoOf(t: Date, tz: string): string {
  const p = zonedParts(t, tz);
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day - (p.hour < 12 ? 1 : 0)));
  return d.toISOString().slice(0, 10);
}

export function MoonCalendarCard({ tz, night, selectDate }: CardProps) {
  // ca. 6 Monate = 26 Viertel
  const rows = useMemo(() => {
    const events = moonQuarters(new Date(), 26);
    const out: (MoonQuarterEvent | null)[][] = [];
    let row: (MoonQuarterEvent | null)[] = [null, null, null, null];
    for (const e of events) {
      if (e.quarter === 0 && row.some(Boolean)) {
        out.push(row);
        row = [null, null, null, null];
      }
      row[e.quarter] = e;
    }
    if (row.some(Boolean)) out.push(row);
    return out;
  }, []);

  const day = new Intl.DateTimeFormat('de-DE', { timeZone: tz, weekday: 'short', day: '2-digit', month: '2-digit' });
  const time = new Intl.DateTimeFormat('de-DE', { timeZone: tz, hour: '2-digit', minute: '2-digit' });

  return (
    <Card title="Mondkalender" icon="📆">
      <div className="table-wrap">
        <table className="moon-cal">
          <thead>
            <tr>
              {QUARTER_NAMES.map((n, i) => (
                <th key={n} title={n}>
                  <div>{ICONS[i]}</div>
                  {SHORT[i]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((e, q) =>
                  e ? (
                    <td
                      key={q}
                      className={`clickable-cell${q === 0 ? ' newmoon' : ''}${nightIsoOf(e.time, tz) === night.dateIso ? ' selected' : ''}`}
                      onClick={() => selectDate(nightIsoOf(e.time, tz))}
                      title={`${QUARTER_NAMES[q]} – Nacht anzeigen`}
                    >
                      <div>{day.format(e.time)}</div>
                      <div className="tiny muted">{time.format(e.time)}</div>
                    </td>
                  ) : (
                    <td key={q} className="faint">
                      –
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="tiny faint">Die nächsten ca. 6 Monate. Neumond-Termine (hervorgehoben) sind ideal für Milchstraße und Deep-Sky. Klick auf ein Datum zeigt diese Nacht.</p>
    </Card>
  );
}
