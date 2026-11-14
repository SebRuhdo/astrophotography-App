import type { NightAstro } from '../lib/astro';
import type { WeatherData } from '../lib/weather';
import { fmtHour } from '../lib/time';

const W = 1000;
const LABEL_W = 92;
const ROW_H = 22;
const GAP = 6;

function skyColor(alt: number): string {
  if (alt > 0) return '#4a78c8';
  if (alt > -6) return '#2c4782';
  if (alt > -12) return '#1b2c5a';
  if (alt > -18) return '#111b3b';
  return '#04060e';
}

export function Timeline({ night, weather, tz, minAlt }: { night: NightAstro; weather: WeatherData | null; tz: string; minAlt: number }) {
  // Zeitraum: 1 h vor Sonnenuntergang bis 1 h nach Sonnenaufgang (sonst 16–08 Uhr)
  const s = night.sun;
  const start = s.sunset ? s.sunset.getTime() - 3600000 : night.t0.getTime() + 4 * 3600000;
  const end = s.sunrise ? s.sunrise.getTime() + 3600000 : night.t1.getTime() - 4 * 3600000;
  const span = end - start;
  const x = (t: number) => LABEL_W + ((t - start) / span) * (W - LABEL_W);
  const samples = night.samples.filter((p) => p.t.getTime() >= start && p.t.getTime() <= end);
  const stepW = samples.length > 1 ? x(samples[1].t.getTime()) - x(samples[0].t.getTime()) + 0.5 : 4;

  const rows = ['Himmel', 'Mond', 'Milchstraße', 'Bewölkung'];
  const y = (i: number) => 4 + i * (ROW_H + GAP);
  const H = y(rows.length) + 18;

  // Stunden-Ticks
  const ticks: number[] = [];
  const firstHour = Math.ceil(start / 3600000) * 3600000;
  for (let t = firstHour; t <= end; t += 3600000) ticks.push(t);
  const now = Date.now();

  const wx = weather ? weather.hours.filter((h) => h.t.getTime() >= start - 3600000 && h.t.getTime() <= end) : [];

  return (
    <>
      <div className="timeline-wrap">
      <svg className="timeline" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Zeitleiste der Nacht">
        {rows.map((r, i) => (
          <text key={r} x={0} y={y(i) + ROW_H / 2 + 4}>
            {r}
          </text>
        ))}
        {/* Himmel */}
        {samples.map((p) => (
          <rect key={`s${p.t.getTime()}`} x={x(p.t.getTime())} y={y(0)} width={stepW} height={ROW_H} fill={skyColor(p.sunAlt)} />
        ))}
        {/* Mond */}
        <rect x={LABEL_W} y={y(1)} width={W - LABEL_W} height={ROW_H} fill="rgba(255,255,255,0.03)" />
        {samples
          .filter((p) => p.moonAlt > 0)
          .map((p) => (
            <rect
              key={`m${p.t.getTime()}`}
              x={x(p.t.getTime())}
              y={y(1)}
              width={stepW}
              height={ROW_H}
              fill="var(--moon)"
              opacity={0.15 + 0.75 * night.moon.illumination}
            />
          ))}
        {/* Milchstraße */}
        <rect x={LABEL_W} y={y(2)} width={W - LABEL_W} height={ROW_H} fill="rgba(255,255,255,0.03)" />
        {samples
          .filter((p) => p.gcAlt >= minAlt)
          .map((p) => {
            const dark = s.dark && p.t >= s.dark.start && p.t <= s.dark.end;
            return (
              <rect
                key={`g${p.t.getTime()}`}
                x={x(p.t.getTime())}
                y={y(2)}
                width={stepW}
                height={ROW_H}
                fill="var(--mw)"
                opacity={dark ? (p.moonAlt > 0 ? 0.5 : 0.95) : 0.18}
              />
            );
          })}
        {/* Bewölkung */}
        <rect x={LABEL_W} y={y(3)} width={W - LABEL_W} height={ROW_H} fill="rgba(255,255,255,0.03)" />
        {wx.map((h) => {
          const x0 = Math.max(LABEL_W, x(h.t.getTime() - 1800000));
          const x1 = Math.min(W, x(h.t.getTime() + 1800000));
          if (x1 <= x0) return null;
          const hh = (h.cloud / 100) * ROW_H;
          return <rect key={`c${h.t.getTime()}`} x={x0} y={y(3) + ROW_H - hh} width={x1 - x0 - 1} height={hh} fill="#c8d2eb" opacity={0.8} />;
        })}
        {!weather && (
          <text x={LABEL_W + 8} y={y(3) + ROW_H / 2 + 4}>
            keine Wetterdaten
          </text>
        )}
        {/* Ticks */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={y(0)} y2={y(rows.length) - GAP} stroke="rgba(255,255,255,0.12)" />
            <text x={x(t)} y={H - 4} textAnchor="middle">
              {fmtHour(new Date(t), tz)}
            </text>
          </g>
        ))}
        {now >= start && now <= end && (
          <line x1={x(now)} x2={x(now)} y1={0} y2={y(rows.length) - GAP + 2} stroke="var(--bad)" strokeWidth={2} />
        )}
      </svg>
      </div>
      <div className="legend">
        <span><i style={{ background: '#2c4782' }} />Dämmerung</span>
        <span><i style={{ background: '#04060e', border: '1px solid #333' }} />astron. Nacht</span>
        <span><i style={{ background: 'var(--moon)' }} />Mond über Horizont</span>
        <span><i style={{ background: 'var(--mw)' }} />MS-Kern über {minAlt}° (blass = hell/Mond)</span>
        <span><i style={{ background: '#c8d2eb' }} />Wolken (Balkenhöhe = %)</span>
        <span><i style={{ background: 'var(--bad)' }} />jetzt</span>
      </div>
    </>
  );
}
