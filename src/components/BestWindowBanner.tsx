import { compass } from '../lib/astro';
import type { BestWindow } from '../lib/bestWindow';
import { fmtDuration, fmtTime } from '../lib/time';

const ICON = { gut: '🟢', mittel: '🟡', schlecht: '🔴', 'keine-dunkelheit': '⚪' } as const;

export function BestWindowBanner({ bw, tz, compact }: { bw: BestWindow; tz: string; compact?: boolean }) {
  const iv = bw.interval;
  const title =
    bw.level === 'gut'
      ? 'Beste Zeit'
      : bw.level === 'mittel'
        ? 'Eingeschränkt nutzbar'
        : bw.level === 'schlecht'
          ? 'Heute kein gutes Zeitfenster'
          : 'Keine Dunkelheit';

  const details: string[] = [];
  if (iv) {
    details.push(fmtDuration(iv.end.getTime() - iv.start.getTime()));
    if (bw.cloudAvg !== null) details.push(`Wolken Ø ${Math.round(bw.cloudAvg)} %`);
    details.push(bw.moonUp ? 'Mond teilweise am Himmel' : 'mondfrei');
    if (bw.mw) details.push(`MS-Kern ${fmtTime(bw.mw.time, tz)} im ${compass(bw.mw.az)} (${Math.round(bw.mw.alt)}°)`);
  } else if (bw.reason) details.push(bw.reason);
  if (!bw.withWeather && bw.level !== 'keine-dunkelheit') details.push('ohne Wetterdaten – nur Dunkelheit & Mond berücksichtigt');

  if (compact) {
    return (
      <span className={`chip lvl-${bw.level}`} title={details.join(' · ')}>
        {iv ? `${fmtTime(iv.start, tz)}–${fmtTime(iv.end, tz)}` : '–'}
      </span>
    );
  }

  return (
    <div className={`best-window lvl-${bw.level}`} role="status">
      <div className="bw-icon" aria-hidden>
        {ICON[bw.level]}
      </div>
      <div>
        <div className="bw-title">
          {title}
          {iv && `: ${fmtTime(iv.start, tz)}–${fmtTime(iv.end, tz)}`}
        </div>
        <div className="bw-details">{details.join(' · ')}</div>
      </div>
    </div>
  );
}
