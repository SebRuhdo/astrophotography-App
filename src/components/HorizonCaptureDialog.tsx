import { useEffect } from 'react';
import { compass } from '../lib/astro';
import type { ManualPoint } from '../lib/horizon';
import { useOrientation } from '../lib/useOrientation';

export function HorizonCaptureDialog({
  placeName,
  points,
  onAdd,
  onRemove,
  onClose,
}: {
  placeName: string;
  points: ManualPoint[];
  onAdd: (p: ManualPoint) => void;
  onRemove: (at: number) => void;
  onClose: () => void;
}) {
  const { heading, tilt, accuracy, state, start } = useOrientation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const ready = state === 'active' && heading !== null && tilt !== null;
  const tooSteep = tilt !== null && Math.abs(tilt) > 60;
  const recent = [...points].sort((a, b) => b.at - a.at).slice(0, 6);

  const capture = () => {
    if (!ready) return;
    onAdd({ az: Math.round(heading! * 10) / 10, alt: Math.round(tilt! * 10) / 10, at: Date.now() });
    if ('vibrate' in navigator) navigator.vibrate?.(30);
  };

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="cap-title">
        <header>
          <h2 id="cap-title">📱 Horizont vor Ort erfassen</h2>
          <button className="btn ghost small" onClick={onClose} aria-label="Schließen">
            ✕
          </button>
        </header>
        <p className="small muted" style={{ marginTop: 0 }}>
          Für den Spot <strong>{placeName}</strong>. Stelle dich an die Stelle, von der aus du fotografierst.
        </p>

        <ol className="small" style={{ paddingLeft: 18, margin: '0 0 12px' }}>
          <li>Handy mit dem Display nach oben halten, die Oberkante zeigt zum Hindernis (Bergkante, Baumspitze, Dach).</li>
          <li>Die Unterkante anheben oder senken, bis du über die Oberkante genau auf die Kante peilst.</li>
          <li>„Punkt erfassen“ tippen. Mehrere Punkte entlang der Kante (alle 5–10°) ergeben eine Linie.</li>
        </ol>

        {state === 'idle' && (
          <button className="btn primary" onClick={start}>
            Sensoren aktivieren
          </button>
        )}
        {state === 'no-data' && <p className="muted small">Warte auf Sensordaten …</p>}
        {state === 'unsupported' && <div className="alert error">Dieses Gerät bzw. dieser Browser liefert keine Kompass- und Neigungsdaten.</div>}
        {state === 'denied' && <div className="alert error">Zugriff auf die Bewegungssensoren wurde verweigert. In den Browser-Einstellungen erlauben und erneut versuchen.</div>}

        {state === 'active' && (
          <>
            <div className="capture-live">
              <div>
                <div className="tiny muted">Richtung</div>
                <div className="capture-value">
                  {heading !== null ? `${Math.round(heading)}°` : '–'} <span className="small muted">{compass(heading)}</span>
                </div>
              </div>
              <div>
                <div className="tiny muted">Höhe über Horizont</div>
                <div className="capture-value">{tilt !== null ? `${tilt.toFixed(1)}°` : '–'}</div>
              </div>
            </div>
            {tooSteep && <div className="alert">Handy flacher halten – bei starker Neigung wird die Kompassrichtung ungenau.</div>}
            {accuracy !== null && accuracy > 20 && (
              <div className="alert">Kompass ungenau (±{Math.round(accuracy)}°). Handy in einer Acht-Bewegung schwenken und Abstand zu Metall/Auto halten.</div>
            )}
            <button className="btn primary capture-btn" onClick={capture} disabled={!ready}>
              📍 Punkt erfassen
            </button>
          </>
        )}

        {recent.length > 0 && (
          <>
            <h3 className="muted small" style={{ margin: '14px 0 6px' }}>
              Erfasste Punkte ({points.length})
            </h3>
            <ul className="list">
              {recent.map((p) => (
                <li key={p.at}>
                  <span className="grow">
                    {Math.round(p.az)}° {compass(p.az)} · {p.alt.toFixed(1)}°
                  </span>
                  <button className="btn small danger" onClick={() => onRemove(p.at)} aria-label="Punkt löschen">
                    🗑
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <p className="tiny faint">
          Handy-Kompasse zeigen magnetisch Nord; in Mitteleuropa weicht das nur wenige Grad von geografisch Nord ab und wird nicht korrigiert. Für die Höhe zählt nur das
          Anheben der Oberkante – das Handy dabei nicht seitlich kippen.
        </p>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>
            Fertig
          </button>
        </div>
      </div>
    </div>
  );
}
