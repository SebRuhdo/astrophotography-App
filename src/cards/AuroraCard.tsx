import { useEffect, useState } from 'react';
import { Card, Stat, fmtDeg } from '../components/ui';
import {
  fetchKpForecast,
  fetchOvation,
  geomagneticLatitude,
  kpColor,
  kpLabel,
  kpThreshold,
  ovationImageUrl,
  requiredStorm,
  type KpEntry,
  type OvationData,
} from '../lib/aurora';
import { fmtHour, fmtTime, zonedParts } from '../lib/time';
import type { CardProps } from './types';

const W = 1000;
const H = 170;
const PAD_L = 28;
const PAD_B = 34;
const PAD_T = 10;
const KP_MAX = 9;

function KpChart({ entries, tz, threshold, night }: { entries: KpEntry[]; tz: string; threshold: number | null; night: CardProps['night'] }) {
  const start = entries[0].t.getTime();
  const end = entries[entries.length - 1].t.getTime() + 3 * 3600000;
  const x = (t: number) => PAD_L + ((t - start) / (end - start)) * (W - PAD_L);
  const y = (kp: number) => PAD_T + (1 - kp / KP_MAX) * (H - PAD_T - PAD_B);
  const bw = x(start + 3 * 3600000) - x(start) - 2;
  const now = Date.now();
  const dark = night.sun.dark;
  const dayFmt = new Intl.DateTimeFormat('de-DE', { timeZone: tz, weekday: 'short', day: '2-digit', month: '2-digit' });

  // Tageswechsel (Mitternacht Ortszeit) für Beschriftung
  const days: number[] = [];
  for (let t = start; t <= end; t += 3600000) {
    const p = zonedParts(new Date(t), tz);
    if (p.hour === 0) days.push(t);
  }

  return (
    <svg className="kp-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Kp-Index-Vorhersage">
      {[0, 3, 5, 7, 9].map((k) => (
        <g key={k}>
          <line x1={PAD_L} x2={W} y1={y(k)} y2={y(k)} stroke="rgba(255,255,255,0.07)" />
          <text x={PAD_L - 6} y={y(k) + 4} textAnchor="end">
            {k}
          </text>
        </g>
      ))}
      {dark && dark.end.getTime() > start && dark.start.getTime() < end && (
        <rect
          x={x(Math.max(start, dark.start.getTime()))}
          y={PAD_T}
          width={x(Math.min(end, dark.end.getTime())) - x(Math.max(start, dark.start.getTime()))}
          height={H - PAD_T - PAD_B}
          fill="rgba(185,162,255,0.10)"
        />
      )}
      {entries.map((e) => (
        <rect
          key={e.t.getTime()}
          x={x(e.t.getTime()) + 1}
          y={y(e.kp)}
          width={bw}
          height={Math.max(1, y(0) - y(e.kp))}
          fill={kpColor(e.kp)}
          opacity={e.kind === 'predicted' ? 0.95 : 0.5}
        >
          <title>
            {`${dayFmt.format(e.t)} ${fmtTime(e.t, tz)}: Kp ${kpLabel(e.kp)} (${e.kp.toFixed(2)})${e.gScale ? ` (${e.gScale})` : ''} – ${
              e.kind === 'predicted' ? 'Vorhersage' : e.kind === 'estimated' ? 'geschätzt' : 'beobachtet'
            }`}
          </title>
        </rect>
      ))}
      {threshold !== null && threshold <= KP_MAX && (
        <g>
          <line x1={PAD_L} x2={W} y1={y(kpThreshold(threshold))} y2={y(kpThreshold(threshold))} stroke="var(--bad)" strokeDasharray="6 4" />
          <text x={W - 4} y={y(kpThreshold(threshold)) - 4} textAnchor="end" style={{ fill: 'var(--bad)' }}>
            nötig für deinen Standort
          </text>
        </g>
      )}
      {days.map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={PAD_T} y2={H - PAD_B + 4} stroke="rgba(255,255,255,0.2)" />
          <text x={x(t) + 4} y={H - PAD_B + 16}>
            {dayFmt.format(new Date(t))}
          </text>
        </g>
      ))}
      {entries
        .filter((_, i) => i % 2 === 1)
        .map((e) => (
          <text key={`h${e.t.getTime()}`} x={x(e.t.getTime())} y={H - 4} textAnchor="middle" className="tiny">
            {fmtHour(e.t, tz)}
          </text>
        ))}
      {now >= start && now <= end && <line x1={x(now)} x2={x(now)} y1={PAD_T} y2={H - PAD_B} stroke="#fff" strokeWidth={2} />}
    </svg>
  );
}

export function AuroraCard({ place, tz, night }: CardProps) {
  const [kp, setKp] = useState<KpEntry[] | null>(null);
  const [ov, setOv] = useState<OvationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showImg, setShowImg] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    fetchKpForecast(ac.signal)
      .then(setKp)
      .catch((e) => !ac.signal.aborted && setError((e as Error).message));
    fetchOvation(ac.signal)
      .then(setOv)
      .catch((e) => !ac.signal.aborted && setError((e as Error).message));
    return () => ac.abort();
  }, []);

  const mlat = geomagneticLatitude(place.lat, place.lon);
  const need = requiredStorm(mlat);

  // ab 24 h vor jetzt bis Ende der Vorhersage
  const shown = kp?.filter((e) => e.t.getTime() >= Date.now() - 24 * 3600000) ?? [];
  const future = shown.filter((e) => e.t.getTime() + 3 * 3600000 > Date.now());
  const maxFuture = future.reduce<KpEntry | null>((m, e) => (!m || e.kp > m.kp ? e : m), null);

  // OVATION: Wert am Standort + stärkster Wert polwärts (gleiche Länge, bis 20° Richtung Pol)
  const here = ov ? ov.get(place.lat, place.lon) : null;
  let pole: { lat: number; p: number } | null = null;
  if (ov) {
    const dir = place.lat >= 0 ? 1 : -1;
    for (let d = 1; d <= 20; d++) {
      const la = Math.round(place.lat) + dir * d;
      if (Math.abs(la) > 90) break;
      const p = ov.get(la, place.lon);
      if (!pole || p > pole.p) pole = { lat: la, p };
    }
  }

  return (
    <Card title="Polarlicht (Aurora)" icon="🌠" wide>
      {error && <div className="alert error">Daten von NOAA konnten nicht geladen werden: {error}</div>}

      <div className="stats">
        <Stat
          label="Geomagnetische Breite"
          value={fmtDeg(mlat, 1)}
          sub={need ? `Polarlicht hier typ. ab ${need.g} (Kp ${need.kp}−)` : 'Polarlicht hier sehr unwahrscheinlich'}
        />
        <Stat
          label="Max. Kp (nächste 3 Tage)"
          value={maxFuture ? <span style={{ color: kpColor(maxFuture.kp) }}>{kpLabel(maxFuture.kp)}</span> : '–'}
          sub={maxFuture ? `${new Intl.DateTimeFormat('de-DE', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(maxFuture.t)}${maxFuture.gScale ? ` · ${maxFuture.gScale}` : ''}` : undefined}
        />
        <Stat
          label="Aurora-Chance jetzt (am Standort)"
          value={here === null ? '–' : `${here} %`}
          sub={ov ? `OVATION, gültig ca. ${fmtTime(ov.forecastTime, tz)}` : undefined}
        />
        <Stat
          label={place.lat >= 0 ? 'Höchste Chance nördlich' : 'Höchste Chance südlich'}
          value={pole ? `${pole.p} %` : '–'}
          sub={pole && pole.p > 0 ? `bei ${Math.abs(pole.lat)}° ${pole.lat >= 0 ? 'N' : 'S'} (gleiche Länge)` : undefined}
        />
      </div>

      {need && maxFuture && maxFuture.kp >= kpThreshold(need.kp) && (
        <div className="alert">
          🌠 Die Vorhersage erreicht Kp {kpLabel(maxFuture.kp)} – das reicht laut NOAA-Skala typischerweise für Polarlicht an deiner geomagnetischen Breite. Klaren Nordhorizont suchen!
        </div>
      )}

      <h3>Kp-Index: letzte 24 h und Vorhersage</h3>
      {shown.length > 0 ? (
        <div className="timeline-wrap">
          <KpChart entries={shown} tz={tz} threshold={need?.kp ?? null} night={night} />
        </div>
      ) : (
        !error && <p className="muted small">Lade Kp-Daten …</p>
      )}
      <p className="tiny faint">
        Blasse Balken = beobachtet/geschätzt, kräftige = Vorhersage (3-h-Blöcke). Violetter Bereich = Dunkelphase der gewählten Nacht. Kp 5− = G1, 6− = G2, 7− = G3, 8− = G4,
        9− = G5 (Zuordnung wie NOAA). Die nötige Stufe beruht auf den NOAA Space Weather Scales (Breite, bis zu der Polarlicht typischerweise gesehen wurde) und einer Dipol-Näherung
        der geomagnetischen Breite.
      </p>

      <h3>Aktuelle Polarlicht-Karte (OVATION, 30–90 min)</h3>
      {showImg ? (
        <img className="ovation-img" src={ovationImageUrl(place.lat)} alt="NOAA OVATION Polarlicht-Vorhersage" loading="lazy" />
      ) : (
        <button className="btn small" onClick={() => setShowImg(true)}>
          Karte laden
        </button>
      )}
      <p className="tiny faint">
        Daten: <a href="https://www.swpc.noaa.gov/products/aurora-30-minute-forecast" target="_blank" rel="noreferrer">NOAA SWPC</a>. Die Chance gilt für Polarlicht
        direkt über dem Ort; ist sie weiter polwärts hoch, kann Polarlicht tief am Horizont sichtbar sein.
      </p>
    </Card>
  );
}
