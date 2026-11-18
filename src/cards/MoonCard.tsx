import { Card, Stat, fmtDeg } from '../components/ui';
import { compass, intervalMs } from '../lib/astro';
import { fmtDuration, fmtTime, fmtTimeDay } from '../lib/time';
import type { CardProps } from './types';

function MoonIcon({ angle, size = 64 }: { angle: number; size?: number }) {
  // einfache Darstellung der beleuchteten Fläche (Nordhalbkugel-Ansicht)
  const a = ((angle % 360) + 360) % 360;
  const r = size / 2 - 2;
  const c = size / 2;
  const k = Math.cos((a * Math.PI) / 180); // 1 = neu, −1 = voll
  const waxing = a < 180;
  const rx = Math.abs(k) * r;
  // Pfad: Halbkreis auf der beleuchteten Seite + Ellipsenbogen (Terminator)
  const sweepOuter = waxing ? 1 : 0;
  const sweepInner = k > 0 ? (waxing ? 0 : 1) : waxing ? 1 : 0;
  const d = `M ${c} ${c - r} A ${r} ${r} 0 0 ${sweepOuter} ${c} ${c + r} A ${rx} ${r} 0 0 ${sweepInner} ${c} ${c - r} Z`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle cx={c} cy={c} r={r} fill="#1d2440" stroke="#39436b" />
      <path d={d} fill="var(--moon)" />
    </svg>
  );
}

export function MoonCard({ night, tz }: CardProps) {
  const m = night.moon;
  return (
    <Card title="Mond" icon="🌙">
      <div className="row" style={{ alignItems: 'center', gap: 14 }}>
        <MoonIcon angle={m.phaseAngle} />
        <div>
          <div style={{ fontWeight: 650, fontSize: '1.05rem' }}>{m.phaseName}</div>
          <div className="muted small">{Math.round(m.illumination * 100)} % beleuchtet · {m.waxing ? 'zunehmend' : 'abnehmend'}</div>
        </div>
      </div>
      <div className="stats">
        <Stat label="Mondaufgang" value={fmtTimeDay(m.rise, tz)} />
        <Stat label="Monduntergang" value={fmtTimeDay(m.set, tz)} />
        <Stat label="Mond in Dunkelheit" value={fmtDuration(m.upDuringDark)} />
        <Stat label="Mondfrei & dunkel" value={fmtDuration(intervalMs(m.moonFreeDark))} />
      </div>
      <dl className="kv">
        <dt>Mondfreie Dunkelheit</dt>
        <dd>{m.moonFreeDark.length ? m.moonFreeDark.map((i) => `${fmtTime(i.start, tz)}–${fmtTime(i.end, tz)}`).join(', ') : '–'}</dd>
        {(m.terrainRise || m.terrainSet) && (
          <>
            <dt>⛰️ Über Gelände</dt>
            <dd>{fmtTimeDay(m.terrainRise, tz)}</dd>
            <dt>⛰️ Hinter Gelände</dt>
            <dd>{fmtTimeDay(m.terrainSet, tz)}</dd>
          </>
        )}
        <dt>Stand um Mitternacht</dt>
        <dd>
          {fmtDeg(m.midnightAlt)} Höhe, {compass(m.midnightAz)}
        </dd>
        <dt>Nächster Neumond</dt>
        <dd>{m.nextNew ? new Intl.DateTimeFormat('de-DE', { timeZone: tz, dateStyle: 'medium', timeStyle: 'short' }).format(m.nextNew) : '–'}</dd>
        <dt>Nächster Vollmond</dt>
        <dd>{m.nextFull ? new Intl.DateTimeFormat('de-DE', { timeZone: tz, dateStyle: 'medium', timeStyle: 'short' }).format(m.nextFull) : '–'}</dd>
      </dl>
    </Card>
  );
}
