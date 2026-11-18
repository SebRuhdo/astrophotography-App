import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { Card, Stat, fmtDeg } from '../components/ui';
import { HorizonCaptureDialog } from '../components/HorizonCaptureDialog';
import { compass, intervalMs, type Sample } from '../lib/astro';
import { computeTerrainHorizon, makeHorizon, type HorizonProfile, type ManualPoint } from '../lib/horizon';
import { validElevation } from '../lib/geocode';
import { fmtDuration, fmtTime } from '../lib/time';
import type { CardProps } from './types';

const PAD_L = 34;
const PAD_R = 8;
const PAD_T = 10;
const PAD_B = 22;
const COL = { terrain: '#6b5a45', terrainLine: '#c9a97a', manual: '#ffffff', gc: '#b9a2ff', moon: '#e8e3c9', sun: '#ffb347' };

/** Bahn eines Objekts als Liniensegmente (Bruch beim Sprung über 0°/360°). */
function track(samples: Sample[], alt: (s: Sample) => number, az: (s: Sample) => number, x: (az: number) => number, y: (alt: number) => number, keep: (s: Sample) => boolean) {
  const segs: string[] = [];
  let cur: string[] = [];
  let prevAz: number | null = null;
  for (const s of samples) {
    if (!keep(s)) {
      if (cur.length > 1) segs.push(cur.join(' '));
      cur = [];
      prevAz = null;
      continue;
    }
    const a = az(s);
    if (prevAz !== null && Math.abs(a - prevAz) > 180) {
      if (cur.length > 1) segs.push(cur.join(' '));
      cur = [];
    }
    cur.push(`${cur.length ? 'L' : 'M'}${x(a).toFixed(1)},${y(alt(s)).toFixed(1)}`);
    prevAz = a;
  }
  if (cur.length > 1) segs.push(cur.join(' '));
  return segs;
}

export function HorizonCard({ place, night, tz, minAlt, updatePlace }: CardProps) {
  const profile: HorizonProfile | undefined = place.horizon;
  const hz = useMemo(() => makeHorizon(profile), [profile]);
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capture, setCapture] = useState(false);
  const [selAz, setSelAz] = useState<number | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const computeTerrain = async () => {
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    setError(null);
    setBusy({ done: 0, total: 1 });
    try {
      const { terrain, groundElevation } = await computeTerrainHorizon(place.lat, place.lon, undefined, (done, total) => setBusy({ done, total }), ac.signal);
      const patch: Partial<typeof place> = { horizon: { terrain, terrainAt: Date.now(), manual: profile?.manual ?? [] } };
      if (validElevation(place.elevation) === null && validElevation(groundElevation) !== null) patch.elevation = groundElevation;
      updatePlace(patch);
    } catch (e) {
      if (!ac.signal.aborted) setError((e as Error).message);
    } finally {
      if (!ac.signal.aborted) setBusy(null);
    }
  };

  const setManual = (manual: ManualPoint[]) =>
    updatePlace({ horizon: manual.length || profile?.terrain ? { terrain: profile?.terrain ?? null, terrainAt: profile?.terrainAt, manual } : undefined });

  // Diagramm
  const H = Math.round(Math.min(260, Math.max(170, width * 0.32)));
  const hzVals = hz ? Array.from({ length: 361 }, (_, a) => hz(a)) : [];
  const yMax = Math.max(15, Math.ceil(((hzVals.length ? Math.max(...hzVals) : 0) + 5) / 5) * 5);
  const yMin = -2;
  const x = (az: number) => PAD_L + (az / 360) * (width - PAD_L - PAD_R);
  const y = (alt: number) => PAD_T + (1 - (Math.max(yMin, Math.min(yMax, alt)) - yMin) / (yMax - yMin)) * (H - PAD_T - PAD_B);
  const inView = (alt: number) => alt >= yMin && alt <= yMax + 2;
  const dark = night.sun.dark;
  const inDark = (s: Sample) => !!dark && s.t >= dark.start && s.t <= dark.end;
  const gcDark = track(night.samples, (s) => s.gcAlt, (s) => s.gcAz, x, y, (s) => inDark(s) && inView(s.gcAlt));
  const gcAll = track(night.samples, (s) => s.gcAlt, (s) => s.gcAz, x, y, (s) => inView(s.gcAlt));
  const moonT = track(night.samples, (s) => s.moonAlt, (s) => s.moonAz, x, y, (s) => s.sunAlt < 0 && inView(s.moonAlt));
  const sunT = track(night.samples, (s) => s.sunAlt, (s) => s.sunAz, x, y, (s) => inView(s.sunAlt));
  const terrainPath = hz
    ? `M${x(0)},${y(yMin)} ` + hzVals.map((v, a) => `L${x(a).toFixed(1)},${y(v).toFixed(1)}`).join(' ') + ` L${x(360)},${y(yMin)} Z`
    : null;
  const onPointer = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * width;
    setSelAz(Math.round(Math.max(0, Math.min(359, ((px - PAD_L) / (width - PAD_L - PAD_R)) * 360))));
  };

  const mw = night.milkyWay;
  const manual = profile?.manual ?? [];

  return (
    <Card title="Horizont-Profil" icon="⛰️" wide>
      {!profile && (
        <div className="alert info" style={{ marginTop: 0, marginBottom: 10 }}>
          Noch kein Horizont für „{place.name}“. Berechne das Gelände (Berge, Hügel) automatisch und ergänze Bäume oder Gebäude vor Ort mit dem Handy. Danach rechnen
          Milchstraße, Planeten und Sonne/Mond mit dem echten Horizont.
        </div>
      )}

      <div className="row" style={{ marginBottom: 10 }}>
        <button className="btn primary small" onClick={computeTerrain} disabled={!!busy}>
          {busy ? `Lade Gelände … ${Math.round((busy.done / busy.total) * 100)} %` : profile?.terrain ? '⛰️ Gelände neu berechnen' : '⛰️ Gelände berechnen'}
        </button>
        <button className="btn small" onClick={() => setCapture(true)}>
          📱 Vor Ort erfassen
        </button>
        {profile && (
          <button
            className="btn small danger"
            onClick={() => {
              if (confirm(`Horizont-Profil für „${place.name}“ löschen?`)) updatePlace({ horizon: undefined });
            }}
          >
            Profil löschen
          </button>
        )}
      </div>
      {error && <div className="alert error">{error}</div>}

      <div ref={wrap}>
        <svg className="hz-chart" width={width} height={H} viewBox={`0 0 ${width} ${H}`} onPointerDown={onPointer} role="img" aria-label="Horizont-Panorama">
          <rect x={PAD_L} y={PAD_T} width={width - PAD_L - PAD_R} height={H - PAD_T - PAD_B} fill="rgba(255,255,255,0.02)" />
          {[0, 5, 10, 15, 20, 30, 40, 50, 60].filter((v) => v <= yMax).map((v) => (
            <g key={v}>
              <line x1={PAD_L} x2={width - PAD_R} y1={y(v)} y2={y(v)} stroke={v === 0 ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.06)'} />
              <text x={PAD_L - 5} y={y(v) + 4} textAnchor="end" className="wx-axis">
                {v}°
              </text>
            </g>
          ))}
          {minAlt > 0 && <line x1={PAD_L} x2={width - PAD_R} y1={y(minAlt)} y2={y(minAlt)} stroke="var(--mid)" strokeDasharray="3 4" opacity={0.6} />}
          {['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW', 'N'].map((l, i) => (
            <g key={i}>
              <line x1={x(i * 45)} x2={x(i * 45)} y1={PAD_T} y2={H - PAD_B} stroke="rgba(255,255,255,0.08)" />
              <text x={x(i * 45)} y={H - 6} textAnchor="middle" className="wx-axis" style={l.length === 1 ? { fill: 'var(--text)', fontWeight: 700 } : undefined}>
                {l}
              </text>
            </g>
          ))}
          {sunT.map((d, k) => (
            <path key={`s${k}`} d={d} fill="none" stroke={COL.sun} strokeWidth={2} opacity={0.8} />
          ))}
          {moonT.map((d, k) => (
            <path key={`m${k}`} d={d} fill="none" stroke={COL.moon} strokeWidth={2} opacity={0.8} />
          ))}
          {gcAll.map((d, k) => (
            <path key={`ga${k}`} d={d} fill="none" stroke={COL.gc} strokeWidth={1.5} strokeDasharray="3 4" opacity={0.6} />
          ))}
          {gcDark.map((d, k) => (
            <path key={`gd${k}`} d={d} fill="none" stroke={COL.gc} strokeWidth={3} />
          ))}
          {terrainPath && <path d={terrainPath} fill={COL.terrain} opacity={0.85} stroke={COL.terrainLine} strokeWidth={1.5} />}
          {manual.map((p) => (
            <circle key={p.at} cx={x(p.az)} cy={y(p.alt)} r={4} fill={COL.manual} stroke="#000" />
          ))}
          {selAz !== null && (
            <g>
              <line x1={x(selAz)} x2={x(selAz)} y1={PAD_T} y2={H - PAD_B} stroke="var(--accent)" />
              {hz && <circle cx={x(selAz)} cy={y(hz(selAz))} r={4} fill="var(--accent)" />}
            </g>
          )}
        </svg>
      </div>

      {selAz !== null && (
        <div className="wx-readout">
          <strong>
            {selAz}° {compass(selAz)}
          </strong>
          <span>Horizont: {hz ? fmtDeg(hz(selAz), 1) : '0° (kein Profil)'}</span>
        </div>
      )}

      <div className="legend">
        <span><i style={{ background: COL.terrain, border: `1px solid ${COL.terrainLine}` }} />Gelände</span>
        <span><i style={{ background: COL.manual }} />vor Ort erfasst</span>
        <span><i style={{ background: COL.gc }} />MS-Kern (kräftig = dunkel)</span>
        <span><i style={{ background: COL.moon }} />Mond (nachts)</span>
        <span><i style={{ background: COL.sun }} />Sonne</span>
        {minAlt > 0 && <span><i style={{ background: 'var(--mid)' }} />Mindesthöhe {minAlt}°</span>}
      </div>

      {hz && (
        <div className="stats">
          <Stat
            label="MS-Kern über Horizont (dunkel)"
            value={mw.visible.length ? mw.visible.map((i) => `${fmtTime(i.start, tz)}–${fmtTime(i.end, tz)}`).join(', ') : 'verdeckt'}
            sub={mw.visible.length ? fmtDuration(intervalMs(mw.visible)) : undefined}
          />
          <Stat label="Sonne hinter Gelände" value={fmtTime(night.sun.terrainSet, tz)} sub={night.sun.sunset ? `Untergang am Horizont ${fmtTime(night.sun.sunset, tz)}` : undefined} />
          <Stat label="Sonne über Gelände" value={fmtTime(night.sun.terrainRise, tz)} sub={night.sun.sunrise ? `Aufgang am Horizont ${fmtTime(night.sun.sunrise, tz)}` : undefined} />
        </div>
      )}

      {manual.length > 0 && (
        <details className="small" style={{ marginTop: 8 }}>
          <summary>Vor Ort erfasste Punkte ({manual.length})</summary>
          <ul className="list" style={{ marginTop: 6 }}>
            {[...manual]
              .sort((a, b) => a.az - b.az)
              .map((p) => (
                <li key={p.at}>
                  <span className="grow">
                    {Math.round(p.az)}° {compass(p.az)} · {fmtDeg(p.alt, 1)}
                  </span>
                  <button className="btn small danger" onClick={() => setManual(manual.filter((m) => m.at !== p.at))} aria-label="Punkt löschen">
                    🗑
                  </button>
                </li>
              ))}
          </ul>
        </details>
      )}

      <p className="tiny faint">
        {profile?.terrainAt && `Gelände berechnet am ${new Date(profile.terrainAt).toLocaleDateString('de-DE')} · `}
        Gelände aus dem Copernicus-Höhenmodell GLO-90 (90-m-Raster, Copernicus-Programm der EU/ESA, über Open-Meteo), bis 40 km Entfernung, inkl. Erdkrümmung. Bäume
        und Gebäude sind darin nicht enthalten – dafür „Vor Ort erfassen“. Tippe ins Panorama, um die Horizonthöhe einer Richtung abzulesen. Das Profil gehört zum
        Spot „{place.name}“ und wird bei Lieblingsorten mitgespeichert.
      </p>

      {capture && (
        <HorizonCaptureDialog
          placeName={place.name}
          onAdd={(p) => setManual([...(place.horizon?.manual ?? []), p])}
          onRemove={(at) => setManual((place.horizon?.manual ?? []).filter((m) => m.at !== at))}
          points={manual}
          onClose={() => setCapture(false)}
        />
      )}
    </Card>
  );
}
