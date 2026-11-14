import { useState } from 'react';
import { Card } from '../components/ui';
import { MapView } from '../components/MapView';
import type { CardProps } from './types';

const BORTLE: Record<number, string> = {
  1: 'Exzellent dunkel',
  2: 'Typisch dunkel',
  3: 'Ländlicher Himmel',
  4: 'Übergang ländlich/vorstädtisch',
  5: 'Vorstädtischer Himmel',
  6: 'Heller vorstädtischer Himmel',
  7: 'Übergang vorstädtisch/städtisch',
  8: 'Stadthimmel',
  9: 'Innenstadthimmel',
};

export function LightPollutionCard({ place, pickLocation, updatePlace }: CardProps) {
  const [overlay, setOverlay] = useState(true);
  const [opacity, setOpacity] = useState(0.7);
  return (
    <Card title="Karte & Lichtverschmutzung" icon="🗺️" wide>
      <div className="row" style={{ marginBottom: 8 }}>
        <label className="row small" style={{ gap: 6 }}>
          <input type="checkbox" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} />
          Nachtlichter-Ebene
        </label>
        <label className="row small" style={{ gap: 6, flex: '1 1 160px' }}>
          Deckkraft
          <input type="range" min={0.1} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} style={{ flex: 1 }} />
        </label>
      </div>
      <MapView lat={place.lat} lon={place.lon} overlay={overlay} opacity={opacity} onPick={pickLocation} />
      <p className="tiny faint">
        Klick in die Karte → Ort als Standort übernehmen. Die Ebene zeigt künstliche Nachtlichter (NASA VIIRS Black Marble 2016; beim Hineinzoomen grob aufgelöst) –
        ein Indikator für Lichtverschmutzung, keine gemessene Himmelshelligkeit. Für SQM-/Bortle-Werte siehe{' '}
        <a href="https://www.lightpollutionmap.info" target="_blank" rel="noreferrer">
          lightpollutionmap.info
        </a>
        .
      </p>
      <div className="row" style={{ marginTop: 8 }}>
        <div className="field" style={{ maxWidth: 320 }}>
          <label htmlFor="bortle">Bortle-Klasse dieses Standorts (manuell)</label>
          <select
            id="bortle"
            value={place.bortle ?? ''}
            onChange={(e) => updatePlace({ bortle: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">– nicht angegeben –</option>
            {Object.entries(BORTLE).map(([k, v]) => (
              <option key={k} value={k}>
                {k} – {v}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Card>
  );
}
