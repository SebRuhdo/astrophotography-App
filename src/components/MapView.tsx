import { useEffect, useRef } from 'react';
import L from 'leaflet';

// NASA GIBS – VIIRS Black Marble (Nachtlichter 2016). Zeigt künstliche Lichtquellen als Indikator für Lichtverschmutzung.
const BLACK_MARBLE =
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png';

export interface MapViewProps {
  lat: number;
  lon: number;
  overlay: boolean;
  opacity: number;
  onPick: (lat: number, lon: number) => void;
}

export function MapView({ lat, lon, overlay, opacity, onPick }: MapViewProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.CircleMarker | null>(null);
  const lp = useRef<L.TileLayer | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { center: [lat, lon], zoom: 8, worldCopyJump: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende',
    }).addTo(m);
    lp.current = L.tileLayer(BLACK_MARBLE, {
      maxNativeZoom: 8,
      maxZoom: 18,
      opacity,
      attribution: 'Nachtlichter: <a href="https://earthdata.nasa.gov/gibs">NASA GIBS</a> / VIIRS Black Marble 2016',
    });
    if (overlay) lp.current.addTo(m);
    marker.current = L.circleMarker([lat, lon], { radius: 8, color: '#ff6b6b', weight: 3, fillOpacity: 0.4 }).addTo(m);
    m.on('click', (e: L.LeafletMouseEvent) => {
      const { lat: la, lng } = e.latlng.wrap();
      const btn = document.createElement('button');
      btn.className = 'btn small primary';
      btn.textContent = 'Als Standort verwenden';
      btn.onclick = () => {
        m.closePopup();
        pick.current(la, lng);
      };
      const box = document.createElement('div');
      box.innerHTML = `<div style="margin-bottom:6px">${la.toFixed(4)}°, ${lng.toFixed(4)}°</div>`;
      box.appendChild(btn);
      L.popup().setLatLng(e.latlng).setContent(box).openOn(m);
    });
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    marker.current?.setLatLng([lat, lon]);
    map.current?.setView([lat, lon], map.current.getZoom());
  }, [lat, lon]);

  useEffect(() => {
    const m = map.current;
    const l = lp.current;
    if (!m || !l) return;
    if (overlay && !m.hasLayer(l)) l.addTo(m);
    if (!overlay && m.hasLayer(l)) m.removeLayer(l);
    l.setOpacity(opacity);
  }, [overlay, opacity]);

  return <div ref={el} className="map" />;
}
