import { useEffect } from 'react';
import { CARD_LABELS, DEFAULT_SETTINGS, type Settings } from '../lib/settings';

export function SettingsDialog({ settings, update, onClose }: { settings: Settings; update: (p: Partial<Settings>) => void; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const move = (i: number, d: -1 | 1) => {
    const cards = [...settings.cards];
    const j = i + d;
    if (j < 0 || j >= cards.length) return;
    [cards[i], cards[j]] = [cards[j], cards[i]];
    update({ cards });
  };

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="set-title">
        <header>
          <h2 id="set-title">Einstellungen</h2>
          <button className="btn ghost small" onClick={onClose} aria-label="Schließen">
            ✕
          </button>
        </header>

        <h3 className="muted small" style={{ margin: '8px 0' }}>
          Angezeigte Informationen & Reihenfolge
        </h3>
        {settings.cards.map((c, i) => (
          <div className="toggle-row" key={c.id}>
            <label>
              <input
                type="checkbox"
                checked={c.visible}
                onChange={(e) => update({ cards: settings.cards.map((x) => (x.id === c.id ? { ...x, visible: e.target.checked } : x)) })}
              />
              {CARD_LABELS[c.id]}
            </label>
            <button className="btn small ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label="nach oben">
              ▲
            </button>
            <button className="btn small ghost" onClick={() => move(i, 1)} disabled={i === settings.cards.length - 1} aria-label="nach unten">
              ▼
            </button>
          </div>
        ))}

        <h3 className="muted small" style={{ margin: '16px 0 4px' }}>
          Mindesthöhe über Horizont: {settings.minAltitude}°
        </h3>
        <input type="range" min={0} max={30} step={1} value={settings.minAltitude} onChange={(e) => update({ minAltitude: Number(e.target.value) })} />
        <p className="tiny faint">Ab dieser Höhe gelten Milchstraßen-Kern und Planeten als sichtbar – z. B. höher stellen bei Bergen oder Bäumen am Horizont.</p>

        <div className="toggle-row" style={{ marginTop: 10 }}>
          <label>
            <input type="checkbox" checked={settings.redMode} onChange={(e) => update({ redMode: e.target.checked })} />
            Rotlicht-Nachtmodus (schont die Dunkeladaption)
          </label>
        </div>

        <div className="row" style={{ marginTop: 16, justifyContent: 'space-between' }}>
          <button className="btn small danger" onClick={() => update({ cards: DEFAULT_SETTINGS.cards, minAltitude: DEFAULT_SETTINGS.minAltitude })}>
            Anzeige zurücksetzen
          </button>
          <button className="btn primary" onClick={onClose}>
            Fertig
          </button>
        </div>
      </div>
    </div>
  );
}
