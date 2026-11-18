import { useCallback, useEffect, useRef, useState } from 'react';

export type SensorState = 'idle' | 'active' | 'unsupported' | 'denied' | 'no-data';

interface OrientationEventWithCompass extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
}

/** Kreisförmige Glättung, damit die Anzeige nicht zittert. */
function smoothAngle(prev: number | null, next: number, k = 0.25): number {
  if (prev === null) return next;
  const d = ((next - prev + 540) % 360) - 180;
  return (prev + k * d + 360) % 360;
}

/**
 * Geräteausrichtung: Kompassrichtung der Handy-Oberkante (heading, 0 = magnetisch Nord)
 * und Neigung (tilt = beta: 0° flach, positiv = Oberkante angehoben).
 * iOS: webkitCompassHeading nach Erlaubnis; Android: deviceorientationabsolute.
 */
export function useOrientation() {
  const [heading, setHeading] = useState<number | null>(null);
  const [tilt, setTilt] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [state, setState] = useState<SensorState>('idle');
  const h = useRef<number | null>(null);
  const b = useRef<number | null>(null);
  const cleanup = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanup.current?.(), []);

  const start = useCallback(async () => {
    const DOE = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
    if (!DOE) {
      setState('unsupported');
      return;
    }
    if (typeof DOE.requestPermission === 'function') {
      try {
        if ((await DOE.requestPermission()) !== 'granted') {
          setState('denied');
          return;
        }
      } catch {
        setState('denied');
        return;
      }
    }
    const handler = (ev: Event) => {
      const e = ev as OrientationEventWithCompass;
      let hd: number | null = null;
      if (typeof e.webkitCompassHeading === 'number' && !Number.isNaN(e.webkitCompassHeading)) {
        hd = e.webkitCompassHeading;
        if (typeof e.webkitCompassAccuracy === 'number' && e.webkitCompassAccuracy >= 0) setAccuracy(e.webkitCompassAccuracy);
      } else if (e.absolute && e.alpha !== null) hd = (360 - e.alpha) % 360;
      if (hd === null) return;
      h.current = smoothAngle(h.current, hd);
      setHeading(h.current);
      if (typeof e.beta === 'number') {
        b.current = b.current === null ? e.beta : b.current + 0.25 * (e.beta - b.current);
        setTilt(b.current);
      }
      setState('active');
    };
    const evName = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
    cleanup.current?.();
    window.addEventListener(evName, handler);
    cleanup.current = () => window.removeEventListener(evName, handler);
    setState('no-data');
    setTimeout(() => setState((s) => (s === 'no-data' ? 'unsupported' : s)), 3000);
  }, []);

  return { heading, tilt, accuracy, state, start };
}
