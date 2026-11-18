import { useMemo } from 'react';
import { Card, Stat, fmtDeg } from '../components/ui';
import { compass, intervalMs, nextMilkyWayNight } from '../lib/astro';
import { fmtDuration, fmtTime, fmtTimeDay, zonedParts } from '../lib/time';
import type { CardProps } from './types';

export function MilkyWayCard({ night, tz, place, minAlt, selectDate, horizon }: CardProps) {
  const mw = night.milkyWay;
  const visible = mw.visible.length > 0;
  const next = useMemo(
    () => (visible ? null : nextMilkyWayNight(place.lat, place.lon, place.elevation ?? 0, night.t0, minAlt, horizon)),
    [visible, place.lat, place.lon, place.elevation, night.t0, minAlt, horizon],
  );
  const nextIso = next
    ? (() => {
        const p = zonedParts(next, tz);
        return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
      })()
    : null;

  return (
    <Card title="Milchstraße (galaktisches Zentrum)" icon="✨">
      {visible ? (
        <>
          <div className="stats">
            <Stat label="Sichtbar (dunkel)" value={mw.visible.map((i) => `${fmtTime(i.start, tz)}–${fmtTime(i.end, tz)}`).join(', ')} sub={fmtDuration(intervalMs(mw.visible))} />
            <Stat
              label="davon mondfrei"
              value={mw.moonFree.length ? mw.moonFree.map((i) => `${fmtTime(i.start, tz)}–${fmtTime(i.end, tz)}`).join(', ') : '–'}
              sub={mw.moonFree.length ? fmtDuration(intervalMs(mw.moonFree)) : 'Mond stört'}
            />
            <Stat label="Beste Zeit" value={fmtTime(mw.bestTime, tz)} sub={`${fmtDeg(mw.bestAlt)} Höhe · ${compass(mw.bestAz)} (${fmtDeg(mw.bestAz)})`} />
          </div>
          <dl className="kv">
            <dt>Richtung zu Beginn</dt>
            <dd>
              {compass(mw.startAz)} ({fmtDeg(mw.startAz)})
            </dd>
            <dt>Richtung am Ende</dt>
            <dd>
              {compass(mw.endAz)} ({fmtDeg(mw.endAz)})
            </dd>
          </dl>
        </>
      ) : (
        <div className="alert info">
          Der Kern der Milchstraße steht in dieser Nacht während der Dunkelheit nicht über {minAlt}° Höhe{horizon ? ' bzw. über dem Horizont-Profil' : ''}.
          {nextIso && (
            <>
              {' '}
              Nächste Nacht mit sichtbarem Kern:{' '}
              <button className="btn small" onClick={() => selectDate(nextIso)}>
                {new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeZone: tz }).format(next!)}
              </button>
            </>
          )}
          {!next && ' An diesem Standort steigt der Kern bei astronomischer Dunkelheit nie über die Mindesthöhe.'}
        </div>
      )}
      <dl className="kv" style={{ marginTop: 10 }}>
        <dt>Aufgang Kern</dt>
        <dd>{fmtTimeDay(mw.rise, tz)}</dd>
        <dt>Untergang Kern</dt>
        <dd>{fmtTimeDay(mw.set, tz)}</dd>
        <dt>Max. Höhe (24 h)</dt>
        <dd>{fmtDeg(mw.maxAlt24h, 1)}</dd>
      </dl>
      <p className="tiny faint">
        Galaktisches Zentrum (Sgr A*, Schütze). Sichtbar = über {minAlt}° Mindesthöhe{horizon ? ' und über dem Horizont-Profil des Spots' : ''} bei astronomischer Dunkelheit.
      </p>
    </Card>
  );
}
