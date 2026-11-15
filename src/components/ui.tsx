import type { ReactNode } from 'react';
import type { NightScore } from '../lib/score';

export function Card({ title, icon, children, wide, actions }: { title: string; icon: string; children: ReactNode; wide?: boolean; actions?: ReactNode }) {
  return (
    <section className={`card${wide ? ' wide' : ''}`}>
      <h2>
        <span className="ico" aria-hidden>
          {icon}
        </span>
        <span style={{ flex: 1 }}>{title}</span>
        {actions}
      </h2>
      {children}
    </section>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="tiny muted">{sub}</div>}
    </div>
  );
}

export const LEVEL_TEXT: Record<NightScore['level'], string> = {
  gut: 'Gute Bedingungen',
  mittel: 'Mittelmäßige Bedingungen',
  schlecht: 'Schlechte Bedingungen',
  unbekannt: 'Keine Wetterdaten',
};

export function ScoreRing({ score }: { score: NightScore }) {
  const p = score.score ?? 0;
  return (
    <div className={`score-ring lvl-${score.level}`} style={{ ['--p' as string]: p }} title="Nacht-Score">
      <div>
        <div>
          <strong>{score.score ?? '–'}</strong>
          <div className="tiny muted">/ 100</div>
        </div>
      </div>
    </div>
  );
}

export function ScoreChip({ score }: { score: NightScore }) {
  return (
    <span className={`chip lvl-${score.level}`}>
      <span className="dot" />
      {score.score ?? '–'}
    </span>
  );
}

/** Farbe für Wolkenbedeckung (0 % = dunkel/klar, 100 % = hellgrau) */
export function cloudStyle(pct: number): React.CSSProperties {
  const a = Math.max(0, Math.min(100, pct)) / 100;
  return { background: `rgba(200, 210, 235, ${0.08 + a * 0.55})`, color: a > 0.6 ? '#0b1020' : undefined };
}

export const fmtDeg = (v: number | null | undefined, digits = 0) => (v === null || v === undefined || Number.isNaN(v) ? '–' : `${v.toFixed(digits)}°`);
export const fmtNum = (v: number | null | undefined, unit = '', digits = 0) =>
  v === null || v === undefined || Number.isNaN(v) ? '–' : `${v.toLocaleString('de-DE', { maximumFractionDigits: digits, minimumFractionDigits: digits })}${unit}`;
