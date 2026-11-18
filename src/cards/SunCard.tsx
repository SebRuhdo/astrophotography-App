import { Card } from '../components/ui';
import type { Interval } from '../lib/astro';
import { fmtTime } from '../lib/time';
import type { CardProps } from './types';

export function SunCard({ night, tz }: CardProps) {
  const s = night.sun;
  const iv = (i: Interval | null) => (i ? `${fmtTime(i.start, tz)}–${fmtTime(i.end, tz)}` : '–');
  return (
    <Card title="Sonne & Dämmerung" icon="🌅">
      <dl className="kv">
        <dt>Goldene Stunde (abends)</dt>
        <dd>{iv(s.goldenEvening)}</dd>
        <dt>☀️ Sonnenuntergang</dt>
        <dd>{fmtTime(s.sunset, tz)}</dd>
        <dt>Blaue Stunde (abends)</dt>
        <dd>{iv(s.blueEvening)}</dd>
        <dt>Ende bürgerl. Dämmerung (−6°)</dt>
        <dd>{fmtTime(s.civil?.start, tz)}</dd>
        <dt>Ende naut. Dämmerung (−12°)</dt>
        <dd>{fmtTime(s.nautical?.start, tz)}</dd>
        <dt>Ende astron. Dämmerung (−18°)</dt>
        <dd>{fmtTime(s.astronomical?.start, tz)}</dd>
        <div className="sep" />
        <dt>Beginn astron. Dämmerung</dt>
        <dd>{fmtTime(s.astronomical?.end, tz)}</dd>
        <dt>Beginn naut. Dämmerung</dt>
        <dd>{fmtTime(s.nautical?.end, tz)}</dd>
        <dt>Beginn bürgerl. Dämmerung</dt>
        <dd>{fmtTime(s.civil?.end, tz)}</dd>
        <dt>Blaue Stunde (morgens)</dt>
        <dd>{iv(s.blueMorning)}</dd>
        <dt>☀️ Sonnenaufgang</dt>
        <dd>{fmtTime(s.sunrise, tz)}</dd>
        <dt>Goldene Stunde (morgens)</dt>
        <dd>{iv(s.goldenMorning)}</dd>
        {(s.terrainSet || s.terrainRise) && (
          <>
            <div className="sep" />
            <dt>⛰️ Hinter Gelände (abends)</dt>
            <dd>{fmtTime(s.terrainSet, tz)}</dd>
            <dt>⛰️ Über Gelände (morgens)</dt>
            <dd>{fmtTime(s.terrainRise, tz)}</dd>
          </>
        )}
        <div className="sep" />
        <dt>Tiefster Sonnenstand</dt>
        <dd>{s.minAltitude.toFixed(1)}°</dd>
      </dl>
      <p className="tiny faint">Goldene Stunde: Sonne +6° bis −4°, Blaue Stunde: −4° bis −8° (gängige Fotografen-Definition).</p>
    </Card>
  );
}
