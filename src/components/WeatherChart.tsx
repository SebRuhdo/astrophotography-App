import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import type { NightAstro } from '../lib/astro';
import { type RatingOptions } from '../lib/rating';
import { fmtTime, zonedParts } from '../lib/time';
import type { WeatherHour } from '../lib/weather';
import { fmtNum } from './ui';

const PAD_L = 38;
const PAD_R = 10;
const GAP = 26; // Platz für Panel-Überschrift
const X_AXIS = 20;

const C = {
  cloud: '#c8d2eb',
  low: '#8fb3ff',
  mid: '#c6a8ff',
  high: '#7fe0d0',
  rain: '#4a90e2',
  temp: '#ffb347',
  dew: '#5fd3f3',
  wind: '#e6ebff',
  jet: '#c6a8ff',
  good: 'rgba(62,207,142,0.16)',
  mid_: 'rgba(245,196,81,0.14)',
  bad: 'rgba(255,107,107,0.14)',
  dark: 'rgba(0,0,0,0.22)',
};

interface Panel {
  id: string;
  title: string;
  height: number;
  min: number;
  max: number;
  unit: string;
  ticks: number[];
  bands?: { from: number; to: number; fill: string }[];
}

function linePath(pts: [number, number][]): string {
  return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}

export function WeatherChart({ hours, night, tz, rating }: { hours: WeatherHour[]; night: NightAstro; tz: string; rating: RatingOptions }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const t = rating.thresholds;
  const deep = rating.profile === 'deepsky';
  const hasJet = deep && hours.some((h) => h.jet !== null);

  const panels = useMemo<Panel[]>(() => {
    const temps = hours.flatMap((h) => [h.temp, h.dewPoint]).filter((v) => !Number.isNaN(v));
    const tMin = Math.floor(Math.min(...temps) - 1);
    const tMax = Math.ceil(Math.max(...temps) + 1);
    const tStep = Math.max(1, Math.ceil((tMax - tMin) / 4));
    const tTicks: number[] = [];
    for (let v = Math.ceil(tMin / tStep) * tStep; v <= tMax; v += tStep) tTicks.push(v);
    const maxWind = Math.max(t.windBad * 1.25, ...hours.map((h) => (Number.isNaN(h.gusts) ? 0 : h.gusts)));
    const wMax = Math.ceil(maxWind / 10) * 10;
    const p: Panel[] = [
      {
        id: 'cloud',
        title: 'Bewölkung & Regenrisiko',
        height: 110,
        min: 0,
        max: 100,
        unit: '%',
        ticks: [0, 50, 100],
        bands: [
          { from: 0, to: t.cloudGood, fill: C.good },
          { from: t.cloudGood, to: t.cloudBad, fill: C.mid_ },
          { from: t.cloudBad, to: 100, fill: C.bad },
        ],
      },
      { id: 'temp', title: 'Temperatur & Taupunkt', height: 90, min: tMin, max: tMax, unit: '°', ticks: tTicks },
      {
        id: 'wind',
        title: 'Wind & Böen',
        height: 80,
        min: 0,
        max: wMax,
        unit: '',
        ticks: [0, Math.round(wMax / 2), wMax],
        bands: [
          { from: 0, to: t.windGood, fill: C.good },
          { from: t.windGood, to: t.windBad, fill: C.mid_ },
          { from: t.windBad, to: wMax, fill: C.bad },
        ],
      },
    ];
    if (hasJet) {
      const jMax = Math.ceil(Math.max(t.jetBad * 1.2, ...hours.map((h) => h.jet ?? 0)) / 50) * 50;
      p.push({
        id: 'jet',
        title: 'Jetstream (Seeing-Indikator)',
        height: 80,
        min: 0,
        max: jMax,
        unit: '',
        ticks: [0, Math.round(jMax / 2), jMax],
        bands: [
          { from: 0, to: t.jetGood, fill: C.good },
          { from: t.jetGood, to: t.jetBad, fill: C.mid_ },
          { from: t.jetBad, to: jMax, fill: C.bad },
        ],
      });
    }
    return p;
  }, [hours, t, hasJet]);

  // Geometrie
  const t0 = hours[0].t.getTime();
  const t1 = hours[hours.length - 1].t.getTime();
  const x = (ms: number) => PAD_L + ((ms - t0) / Math.max(1, t1 - t0)) * (width - PAD_L - PAD_R);
  const tops: number[] = [];
  let acc = 0;
  for (const p of panels) {
    acc += GAP;
    tops.push(acc);
    acc += p.height;
  }
  const H = acc + X_AXIS;
  const yOf = (pi: number) => (v: number) => {
    const p = panels[pi];
    const cl = Math.max(p.min, Math.min(p.max, v));
    return tops[pi] + p.height - ((cl - p.min) / (p.max - p.min)) * p.height;
  };

  // Auswahl (Fadenkreuz)
  const defaultIdx = useMemo(() => {
    const now = Date.now();
    const ref = now >= t0 && now <= t1 ? now : night.sun.dark ? (night.sun.dark.start.getTime() + night.sun.dark.end.getTime()) / 2 : (t0 + t1) / 2;
    let best = 0;
    hours.forEach((h, i) => {
      if (Math.abs(h.t.getTime() - ref) < Math.abs(hours[best].t.getTime() - ref)) best = i;
    });
    return best;
  }, [hours, night, t0, t1]);
  const [sel, setSel] = useState<number | null>(null);
  const idx = Math.min(sel ?? defaultIdx, hours.length - 1);
  const onPointer = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * width;
    const ms = t0 + ((px - PAD_L) / (width - PAD_L - PAD_R)) * (t1 - t0);
    let best = 0;
    hours.forEach((h, i) => {
      if (Math.abs(h.t.getTime() - ms) < Math.abs(hours[best].t.getTime() - ms)) best = i;
    });
    setSel(best);
  };

  const dark = night.sun.dark;
  const darkX0 = dark ? Math.max(PAD_L, x(dark.start.getTime())) : 0;
  const darkX1 = dark ? Math.min(width - PAD_R, x(dark.end.getTime())) : 0;
  const pts = (pi: number, get: (h: WeatherHour) => number | null) =>
    hours.flatMap((h) => {
      const v = get(h);
      return v === null || Number.isNaN(v) ? [] : [[x(h.t.getTime()), yOf(pi)(v)] as [number, number]];
    });

  const pCloud = panels.findIndex((p) => p.id === 'cloud');
  const pTemp = panels.findIndex((p) => p.id === 'temp');
  const pWind = panels.findIndex((p) => p.id === 'wind');
  const pJet = panels.findIndex((p) => p.id === 'jet');
  const barW = Math.max(2, ((width - PAD_L - PAD_R) / Math.max(1, hours.length - 1)) * 0.5);

  // Tau-Bereiche: Fläche zwischen Temperatur und Taupunkt, wo der Abstand unter der Grenze liegt
  const dewPolys: string[] = [];
  {
    let seg: WeatherHour[] = [];
    const flush = () => {
      if (seg.length) {
        const yT = yOf(pTemp);
        const top = seg.map((h) => [x(h.t.getTime()) , yT(h.temp)] as [number, number]);
        const bottom = seg.map((h) => [x(h.t.getTime()), yT(h.dewPoint)] as [number, number]).reverse();
        if (seg.length === 1) {
          top.push([top[0][0] + 4, top[0][1]]);
          bottom.unshift([bottom[0][0] + 4, bottom[0][1]]);
        }
        dewPolys.push(linePath([...top, ...bottom]) + ' Z');
      }
      seg = [];
    };
    for (const h of hours) {
      if (h.temp - h.dewPoint < t.dewSpread) seg.push(h);
      else flush();
    }
    flush();
  }

  // Zeitachse: alle 2 h (bei schmalem Bildschirm alle 3 h)
  const stepH = width < 480 ? 3 : 2;
  const ticks = hours.filter((h) => zonedParts(h.t, tz).hour % stepH === 0);
  const h = hours[idx];

  return (
    <div ref={wrap}>
      <svg
        className="wx-chart"
        width={width}
        height={H}
        viewBox={`0 0 ${width} ${H}`}
        onPointerDown={onPointer}
        onPointerMove={(e) => (e.buttons || e.pointerType === 'mouse') && onPointer(e)}
        role="img"
        aria-label="Wetterverlauf der Nacht"
      >
        {panels.map((p, pi) => {
          const y = yOf(pi);
          return (
            <g key={p.id}>
              <text x={PAD_L} y={tops[pi] - 8} className="wx-title">
                {p.title}
                {p.id === 'wind' || p.id === 'jet' ? ' (km/h)' : ''}
              </text>
              <rect x={PAD_L} y={tops[pi]} width={width - PAD_L - PAD_R} height={p.height} fill="rgba(255,255,255,0.02)" />
              {p.bands?.map((b, k) => (
                <rect key={k} x={PAD_L} width={width - PAD_L - PAD_R} y={y(Math.min(b.to, p.max))} height={Math.max(0, y(b.from) - y(Math.min(b.to, p.max)))} fill={b.fill} />
              ))}
              {dark && darkX1 > darkX0 && <rect x={darkX0} width={darkX1 - darkX0} y={tops[pi]} height={p.height} fill={C.dark} />}
              {p.ticks.map((v) => (
                <g key={v}>
                  <line x1={PAD_L} x2={width - PAD_R} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.06)" />
                  <text x={PAD_L - 5} y={y(v) + 4} textAnchor="end" className="wx-axis">
                    {v}
                    {p.unit}
                  </text>
                </g>
              ))}
            </g>
          );
        })}

        {/* Bewölkung */}
        {hours.map((hr) => (hr.precipProb ? (
          <rect
            key={`r${hr.t.getTime()}`}
            x={x(hr.t.getTime()) - barW / 2}
            width={barW}
            y={yOf(pCloud)(hr.precipProb)}
            height={yOf(pCloud)(0) - yOf(pCloud)(hr.precipProb)}
            fill={C.rain}
            opacity={0.45}
          />
        ) : null))}
        <path
          d={`${linePath(pts(pCloud, (hr) => hr.cloud))} L${x(t1)},${yOf(pCloud)(0)} L${x(t0)},${yOf(pCloud)(0)} Z`}
          fill={C.cloud}
          opacity={0.35}
        />
        <path d={linePath(pts(pCloud, (hr) => hr.cloud))} fill="none" stroke={C.cloud} strokeWidth={2} />
        <path d={linePath(pts(pCloud, (hr) => hr.cloudLow))} fill="none" stroke={C.low} strokeWidth={1.2} strokeDasharray="4 3" />
        <path d={linePath(pts(pCloud, (hr) => hr.cloudMid))} fill="none" stroke={C.mid} strokeWidth={1.2} strokeDasharray="4 3" />
        <path d={linePath(pts(pCloud, (hr) => hr.cloudHigh))} fill="none" stroke={C.high} strokeWidth={1.2} strokeDasharray="4 3" />

        {/* Temperatur & Taupunkt: Taugefahr als Hintergrund-Markierung je Stunde */}
        {hours.map((hr) =>
          hr.temp - hr.dewPoint < t.dewSpread ? (
            <rect
              key={`d${hr.t.getTime()}`}
              x={Math.max(PAD_L, x(hr.t.getTime() - 1800000))}
              width={Math.max(0, Math.min(width - PAD_R, x(hr.t.getTime() + 1800000)) - Math.max(PAD_L, x(hr.t.getTime() - 1800000)))}
              y={tops[pTemp]}
              height={panels[pTemp].height}
              fill="rgba(245,196,81,0.13)"
            />
          ) : null,
        )}
        {dewPolys.map((d, k) => (
          <path key={k} d={d} fill="rgba(245,196,81,0.35)" />
        ))}
        <path d={linePath(pts(pTemp, (hr) => hr.temp))} fill="none" stroke={C.temp} strokeWidth={2} />
        <path d={linePath(pts(pTemp, (hr) => hr.dewPoint))} fill="none" stroke={C.dew} strokeWidth={2} />

        {/* Wind */}
        <path d={linePath(pts(pWind, (hr) => hr.gusts))} fill="none" stroke={C.wind} strokeWidth={1.2} strokeDasharray="4 3" opacity={0.7} />
        <path d={linePath(pts(pWind, (hr) => hr.wind))} fill="none" stroke={C.wind} strokeWidth={2} />

        {/* Jetstream */}
        {pJet >= 0 && <path d={linePath(pts(pJet, (hr) => hr.jet))} fill="none" stroke={C.jet} strokeWidth={2} />}

        {/* Zeitachse */}
        {ticks.map((hr) => (
          <g key={`t${hr.t.getTime()}`}>
            <line x1={x(hr.t.getTime())} x2={x(hr.t.getTime())} y1={tops[0]} y2={H - X_AXIS} stroke="rgba(255,255,255,0.08)" />
            <text x={x(hr.t.getTime())} y={H - 5} textAnchor="middle" className="wx-axis">
              {String(zonedParts(hr.t, tz).hour).padStart(2, '0')}
            </text>
          </g>
        ))}

        {/* Fadenkreuz */}
        <line x1={x(h.t.getTime())} x2={x(h.t.getTime())} y1={tops[0] - 4} y2={H - X_AXIS} stroke="var(--accent)" strokeWidth={1.5} />
        {panels.map((p, pi) => {
          const v = p.id === 'cloud' ? h.cloud : p.id === 'temp' ? h.temp : p.id === 'wind' ? h.wind : h.jet;
          return v === null || Number.isNaN(v) ? null : <circle key={p.id} cx={x(h.t.getTime())} cy={yOf(pi)(v)} r={4} fill="var(--accent)" />;
        })}
      </svg>

      <div className="wx-readout" aria-live="polite">
        <strong>{fmtTime(h.t, tz)}</strong>
        <span>☁️ {fmtNum(h.cloud, ' %')} <span className="faint">(tief {fmtNum(h.cloudLow)} · mittel {fmtNum(h.cloudMid)} · hoch {fmtNum(h.cloudHigh)})</span></span>
        {h.precipProb ? <span>🌧️ {fmtNum(h.precipProb, ' %')}</span> : null}
        <span>🌡️ {fmtNum(h.temp, ' °C', 1)} / Tau {fmtNum(h.dewPoint, ' °C', 1)}</span>
        <span>🌬️ {fmtNum(h.wind)} <span className="faint">(Böen {fmtNum(h.gusts)})</span> km/h</span>
        {deep && h.jet !== null && <span>🔭 Jet {fmtNum(h.jet, ' km/h')}</span>}
      </div>

      <div className="legend">
        <span><i style={{ background: C.cloud }} />Wolken gesamt</span>
        <span><i style={{ background: C.low }} />tief</span>
        <span><i style={{ background: C.mid }} />mittel</span>
        <span><i style={{ background: C.high }} />hoch</span>
        <span><i style={{ background: C.rain }} />Regenrisiko</span>
        <span><i style={{ background: C.temp }} />Temperatur</span>
        <span><i style={{ background: C.dew }} />Taupunkt</span>
        <span><i style={{ background: 'rgba(245,196,81,0.6)' }} />Taugefahr</span>
        <span><i style={{ background: '#000', border: '1px solid #444' }} />Dunkelphase</span>
        <span><i style={{ background: 'var(--good)' }} />/<i style={{ background: 'var(--mid)', marginLeft: 4 }} />/<i style={{ background: 'var(--bad)', marginLeft: 4 }} />Grenzwerte</span>
      </div>
    </div>
  );
}
