import { createContext, useContext, type MouseEvent, type ReactNode } from 'react';
import type { NightScore } from '../lib/score';

/** Ein-/Ausklappen eines Bereichs (vom App-Container bereitgestellt) */
export const CollapseContext = createContext<{ collapsed: boolean; toggle: () => void } | null>(null);

export function Card({ title, icon, children, wide, actions }: { title: string; icon: string; children: ReactNode; wide?: boolean; actions?: ReactNode }) {
  const c = useContext(CollapseContext);
  const collapsed = c?.collapsed ?? false;
  const onHeader = (e: MouseEvent) => {
    if (!c || (e.target as HTMLElement).closest('button, a, input, select, label')) return;
    c.toggle();
  };
  return (
    <section className={`card${wide ? ' wide' : ''}${collapsed ? ' collapsed' : ''}`}>
      <h2 onClick={onHeader} className={c ? 'collapsible' : undefined}>
        <span className="ico" aria-hidden>
          {icon}
        </span>
        <span style={{ flex: 1 }}>{title}</span>
        {actions}
        {c && (
          <button
            className="btn ghost small collapse-btn"
            onClick={c.toggle}
            aria-expanded={!collapsed}
            aria-label={collapsed ? `${title} aufklappen` : `${title} einklappen`}
            title={collapsed ? 'Aufklappen' : 'Einklappen'}
          >
            {collapsed ? '▸' : '▾'}
          </button>
        )}
      </h2>
      {!collapsed && children}
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
