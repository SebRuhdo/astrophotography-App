import { useCallback, useEffect, useRef, useState } from 'react';
import { compass, skyPositions, type SkyObject } from '../lib/astro';
import type { Place } from '../lib/settings';
import { validElevation } from '../lib/geocode';

type SensorState = 'idle' | 'active' | 'unsupported' | 'denied' | 'no-data';

interface OrientationEventWithCompass extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

const COLORS: Record<string, string> = { sun: '#ffb347', moon: '#e8e3c9', gc: '#b9a2ff' };
const SIZE = 320;
const C = SIZE / 2;
const R = 130;

/** Kreisförmige Glättung, damit die Anzeige nicht zittert. */
function smoothAngle(prev: number | null, next: number, k = 0.25): number {
  if (prev === null) return next;
  const d = ((next - prev + 540) % 360) - 180;
  return (prev + k * d + 360) % 360;
}

export function CompassDialog({ place, onClose }: { place: Place; onClose: () => void }) {
  const [now, setNow] = useState(() => new Date());
  const [heading, setHeading] = useState<number | null>(null);
  const [sensor, setSensor] = useState<SensorState>('idle');
  const [target, setTarget] = useState<string>('gc');
  const headingRef = useRef<number | null>(null);
  const cleanup = useRef<(() => void) | null>(null);

  // Positionen alle 10 s aktualisieren
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      cleanup.current?.();
    };
  }, [onClose]);

  const startSensor = useCallback(async () => {
    const DOE = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
    if (!DOE) {
      setSensor('unsupported');
      return;
    }
    // iOS (Safari) verlangt eine ausdrückliche Erlaubnis nach Nutzeraktion
    if (typeof DOE.requestPermission === 'function') {
      try {
        if ((await DOE.requestPermission()) !== 'granted') {
          setSensor('denied');
          return;
        }
      } catch {
        setSensor('denied');
        return;
      }
    }
    const handler = (ev: Event) => {
      const e = ev as OrientationEventWithCompass;
      let h: number | null = null;
      if (typeof e.webkitCompassHeading === 'number' && !Number.isNaN(e.webkitCompassHeading)) h = e.webkitCompassHeading; // iOS
      else if (e.absolute && e.alpha !== null) h = (360 - e.alpha) % 360; // Android (absolute Ausrichtung)
      if (h === null) return;
      headingRef.current = smoothAngle(headingRef.current, h);
      setHeading(headingRef.current);
      setSensor('active');
    };
    const evName = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
    window.addEventListener(evName, handler);
    cleanup.current = () => window.removeEventListener(evName, handler);
    setSensor('no-data');
    // Kommt nach 3 s nichts Brauchbares, gibt es keinen Kompass
    setTimeout(() => setSensor((s) => (s === 'no-data' ? 'unsupported' : s)), 3000);
  }, []);

  const objects = skyPositions(place.lat, place.lon, validElevation(place.elevation) ?? 0, now);
  const shown = objects.filter((o) => o.id === 'gc' || o.id === 'moon' || o.id === 'sun' || (o.alt > 0 && (o.magnitude ?? 99) < 3));
  const tgt = objects.find((o) => o.id === target) ?? objects.find((o) => o.id === 'gc')!;
  const rot = heading ?? 0; // Rose dreht sich gegen die Blickrichtung

  const pos = (az: number, r: number) => {
    const a = ((az - rot) * Math.PI) / 180;
    return { x: C + Math.sin(a) * r, y: C - Math.cos(a) * r };
  };
  const radiusFor = (o: SkyObject) => R - Math.max(0, Math.min(90, o.alt)) * (R / 90) * 0.85; // höher = weiter innen

  let turn: string | null = null;
  if (heading !== null) {
    const d = Math.round(((tgt.az - heading + 540) % 360) - 180);
    turn = Math.abs(d) <= 5 ? '✓ Richtung stimmt' : d > 0 ? `${d}° nach rechts drehen` : `${-d}° nach links drehen`;
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog compass-dialog" role="dialog" aria-modal="true" aria-labelledby="compass-title">
        <header>
          <h2 id="compass-title">🧭 Kompass</h2>
          <button className="btn ghost small" onClick={onClose} aria-label="Schließen">
            ✕
          </button>
        </header>

        <div className="target-list" role="group" aria-label="Ziel wählen">
          {shown.map((o) => (
            <button key={o.id} className="btn small" aria-pressed={o.id === target} onClick={() => setTarget(o.id)}>
              {o.name}
            </button>
          ))}
        </div>

        <div className="compass-target">
          <strong>{tgt.name}</strong>
          <div>
            {compass(tgt.az)} ({Math.round(tgt.az)}°) · {tgt.alt >= 0 ? `${Math.round(tgt.alt)}° über dem Horizont` : `${Math.round(-tgt.alt)}° unter dem Horizont`}
          </div>
          {turn && <div style={{ color: turn.startsWith('✓') ? 'var(--good)' : 'var(--mid)', fontWeight: 650 }}>{turn}</div>}
        </div>

        <svg className="compass" viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Kompassrose mit Himmelsobjekten">
          <circle cx={C} cy={C} r={R} fill="rgba(255,255,255,0.03)" stroke="var(--border)" strokeWidth={2} />
          <circle cx={C} cy={C} r={R - (R * 0.85) / 3} fill="none" stroke="rgba(255,255,255,0.06)" />
          <circle cx={C} cy={C} r={R - (R * 0.85 * 2) / 3} fill="none" stroke="rgba(255,255,255,0.06)" />
          {Array.from({ length: 36 }, (_, k) => {
            const p1 = pos(k * 10, R);
            const p2 = pos(k * 10, k % 9 === 0 ? R - 14 : R - 6);
            return <line key={k} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="var(--faint)" />;
          })}
          {(['N', 'O', 'S', 'W'] as const).map((l, k) => {
            const p = pos(k * 90, R + 16);
            return (
              <text key={l} x={p.x} y={p.y + 5} textAnchor="middle" className="cardinal" style={l === 'N' ? { fill: 'var(--bad)' } : undefined}>
                {l}
              </text>
            );
          })}
          {shown.map((o) => {
            const p = pos(o.az, radiusFor(o));
            const below = o.alt < 0;
            const col = COLORS[o.id] ?? '#8fb3ff';
            return (
              <g key={o.id} opacity={below ? 0.4 : 1}>
                {o.id === target && <circle cx={p.x} cy={p.y} r={13} fill="none" stroke={col} strokeWidth={2} />}
                <circle cx={p.x} cy={p.y} r={o.id === 'gc' ? 8 : 6} fill={col} stroke={below ? col : 'none'} strokeDasharray={below ? '2 2' : undefined} />
                <text x={p.x} y={p.y - 12} textAnchor="middle" style={{ fill: 'var(--text)', fontSize: 11 }}>
                  {o.id === 'gc' ? 'MS' : o.name}
                </text>
              </g>
            );
          })}
          {/* Blickrichtung des Handys */}
          <path d={`M ${C} ${C - R + 4} L ${C - 9} ${C - R + 24} L ${C + 9} ${C - R + 24} Z`} fill={heading !== null ? 'var(--good)' : 'var(--faint)'} />
          <circle cx={C} cy={C} r={3} fill="var(--muted)" />
        </svg>

        {sensor === 'idle' && (
          <div className="row" style={{ justifyContent: 'center' }}>
            <button className="btn primary" onClick={startSensor}>
              Kompass des Handys verwenden
            </button>
          </div>
        )}
        {sensor === 'no-data' && <p className="muted small" style={{ textAlign: 'center' }}>Warte auf Kompass …</p>}
        {sensor === 'unsupported' && (
          <div className="alert info">Dieses Gerät bzw. dieser Browser liefert keine Kompassdaten. Die Rose zeigt Norden oben – Richtung bitte nach Himmelsrichtung ablesen.</div>
        )}
        {sensor === 'denied' && <div className="alert error">Zugriff auf den Bewegungssensor wurde verweigert. In den Browser-Einstellungen erlauben und erneut versuchen.</div>}

        <p className="tiny faint">
          Stand {now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} am aktuellen Standort. Innen = hoch am Himmel, außen = am Horizont, blass = unter
          dem Horizont. Handy flach halten, Oberkante zeigt in Blickrichtung. Handy-Kompasse zeigen magnetisch Nord (in Mitteleuropa nur wenige Grad Abweichung) und
          werden durch Metall, Magnete und Autos gestört – ggf. durch eine Acht-Bewegung kalibrieren.
        </p>
      </div>
    </div>
  );
}
