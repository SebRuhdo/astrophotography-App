import { useMemo, useState } from 'react';
import { Card, fmtDeg } from '../components/ui';
import { MapView, type Ray } from '../components/MapView';
import { compass } from '../lib/astro';
import { fmtTime } from '../lib/time';
import type { CardProps } from './types';

const BORTLE: Record<number, string> = {
  1: 'Exzellent dunkel',
  2: 'Typisch dunkel',
  3: 'Ländlicher Himmel',
  4: 'Übergang ländlich/vorstädtisch',
  5: 'Vorstädtischer Himmel',
  6: 'Heller vorstädtischer Himmel',
  7: 'Übergang vorstädtisch/städtisch',
  8: 'Stadthimmel',
  9: 'Innenstadthimmel',
};

const COLORS = { gc: '#b9a2ff', moon: '#e8e3c9', sun: '#ffb347' };

export function LightPollutionCard({ place, night, tz, pickLocation, updatePlace }: CardProps) {
  const [overlay, setOverlay] = useState(true);
  const [opacity, setOpacity] = useState(0.7);
  const [showRays, setShowRays] = useState(true);

  // Zeitachse: 1 h vor Sonnenuntergang bis 1 h nach Sonnenaufgang
  const s = night.sun;
  const start = s.sunset ? s.sunset.getTime() - 3600000 : night.t0.getTime() + 4 * 3600000;
  const end = s.sunrise ? s.sunrise.getTime() + 3600000 : night.t1.getTime() - 4 * 3600000;
  const samples = useMemo(() => night.samples.filter((p) => p.t.getTime() >= start && p.t.getTime() <= end), [night, start, end]);

  // Startwert: beste Zeit für den MS-Kern, sonst jetzt (falls in der Nacht), sonst Beginn der Dunkelheit
  const defaultIdx = useMemo(() => {
    const target = night.milkyWay.bestTime?.getTime() ?? (Date.now() >= start && Date.now() <= end ? Date.now() : (s.dark?.start.getTime() ?? start));
    let best = 0;
    samples.forEach((p, i) => {
      if (Math.abs(p.t.getTime() - target) < Math.abs(samples[best].t.getTime() - target)) best = i;
    });
    return best;
  }, [samples, night, start, end, s.dark]);
  const [idx, setIdx] = useState<number | null>(null);
  const i = Math.min(idx ?? defaultIdx, samples.length - 1);
  const cur = samples[i];

  const rays: Ray[] = [];
  if (cur && showRays) {
    if (cur.gcAlt > -5) rays.push({ id: 'gc', label: `MS-Kern ${Math.round(cur.gcAlt)}°`, color: COLORS.gc, az: cur.gcAz, dashed: !cur.gcVis });
    if (cur.moonAlt > -5) rays.push({ id: 'moon', label: `Mond ${Math.round(cur.moonAlt)}°`, color: COLORS.moon, az: cur.moonAz, dashed: cur.moonAlt < 0 });
    if (cur.sunAlt > -18) rays.push({ id: 'sun', label: `Sonne ${Math.round(cur.sunAlt)}°`, color: COLORS.sun, az: cur.sunAz, dashed: cur.sunAlt < 0 });
  }

  return (
    <Card title="Karte, Richtungen & Lichtverschmutzung" icon="🗺️" wide>
      <div className="row" style={{ marginBottom: 8 }}>
        <label className="row small" style={{ gap: 6 }}>
          <input type="checkbox" checked={showRays} onChange={(e) => setShowRays(e.target.checked)} />
          Richtungen
        </label>
        <label className="row small" style={{ gap: 6 }}>
          <input type="checkbox" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} />
          Nachtlichter-Ebene
        </label>
        <label className="row small" style={{ gap: 6, flex: '1 1 140px' }}>
          Deckkraft
          <input type="range" min={0.1} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} style={{ flex: 1 }} />
        </label>
      </div>

      {showRays && cur && (
        <>
          <div className="row" style={{ gap: 10 }}>
            <strong className="tabular" style={{ minWidth: 48 }}>
              {fmtTime(cur.t, tz)}
            </strong>
            <input
              type="range"
              min={0}
              max={samples.length - 1}
              step={1}
              value={i}
              onChange={(e) => setIdx(Number(e.target.value))}
              aria-label="Uhrzeit für Richtungen"
              style={{ flex: 1 }}
            />
            <button className="btn small" onClick={() => setIdx(null)} title="Zurück zur besten Zeit">
              ↺
            </button>
          </div>
          {rays.length === 0 && (
            <p className="tiny muted" style={{ margin: '6px 0 0' }}>
              Um {fmtTime(cur.t, tz)} steht keines der Objekte über dem Horizont – Regler verschieben, um die Richtungen zu sehen.
            </p>
          )}
          <div className="ray-legend">
            <div style={{ ['--c' as string]: COLORS.gc }}>
              MS-Kern: {fmtDeg(cur.gcAlt)} · {compass(cur.gcAz)} ({fmtDeg(cur.gcAz)})
            </div>
            <div style={{ ['--c' as string]: COLORS.moon }}>
              Mond: {fmtDeg(cur.moonAlt)} · {compass(cur.moonAz)} ({fmtDeg(cur.moonAz)})
            </div>
            <div style={{ ['--c' as string]: COLORS.sun }}>
              Sonne: {fmtDeg(cur.sunAlt)} · {compass(cur.sunAz)} ({fmtDeg(cur.sunAz)})
            </div>
          </div>
        </>
      )}

      <MapView lat={place.lat} lon={place.lon} overlay={overlay} opacity={opacity} onPick={pickLocation} rays={rays} />
      <p className="tiny faint">
        Linien zeigen die Richtung (Azimut) vom Standort aus zur gewählten Uhrzeit, Höhe über dem Horizont in der Beschriftung. Gestrichelt = unter dem Horizont bzw.
        unter der Mindesthöhe. Klick in die Karte → Ort als Standort übernehmen. Die Nachtlichter-Ebene (NASA VIIRS Black Marble 2016; beim Hineinzoomen grob
        aufgelöst) ist ein Indikator für Lichtverschmutzung, keine gemessene Himmelshelligkeit. Für SQM-/Bortle-Werte siehe{' '}
        <a href="https://www.lightpollutionmap.info" target="_blank" rel="noreferrer">
          lightpollutionmap.info
        </a>
        .
      </p>
      <div className="row" style={{ marginTop: 8 }}>
        <div className="field" style={{ maxWidth: 320 }}>
          <label htmlFor="bortle">Bortle-Klasse dieses Standorts (manuell)</label>
          <select id="bortle" value={place.bortle ?? ''} onChange={(e) => updatePlace({ bortle: e.target.value ? Number(e.target.value) : null })}>
            <option value="">– nicht angegeben –</option>
            {Object.entries(BORTLE).map(([k, v]) => (
              <option key={k} value={k}>
                {k} – {v}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Card>
  );
}
