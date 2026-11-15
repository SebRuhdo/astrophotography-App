import { useEffect, useRef } from 'react';
import L from 'leaflet';

// NASA GIBS – VIIRS Black Marble (Nachtlichter 2016). Zeigt künstliche Lichtquellen als Indikator für Lichtverschmutzung.
const BLACK_MARBLE =
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png';

export interface Ray {
  id: string;
  label: string;
  color: string;
  az: number; // Azimut in Grad (0 = Nord, 90 = Ost)
  dashed?: boolean; // z. B. unter dem Horizont
}

export interface MapViewProps {
  lat: number;
  lon: number;
  overlay: boolean;
  opacity: number;
  onPick: (lat: number, lon: number) => void;
  rays?: Ray[];
}

/**
 * Zeichnet Richtungslinien vom Standort aus. Die Länge wird in Bildschirm-Pixeln gewählt;
 * da die Web-Mercator-Projektion winkeltreu ist, stimmt die Richtung lokal.
 */
function drawRays(m: L.Map, group: L.LayerGroup, lat: number, lon: number, rays: Ray[]) {
  group.clearLayers();
  const size = m.getSize();
  const len = Math.min(size.x, size.y) * 0.32;
  const p0 = m.latLngToContainerPoint([lat, lon]);
  for (const r of rays) {
    const a = (r.az * Math.PI) / 180;
    const p1 = L.point(p0.x + Math.sin(a) * len, p0.y - Math.cos(a) * len);
    const pl = L.point(p0.x + Math.sin(a) * (len + 14), p0.y - Math.cos(a) * (len + 14));
    const ll1 = m.containerPointToLatLng(p1);
    L.polyline([[lat, lon], ll1], { color: r.color, weight: 4, opacity: 0.9, dashArray: r.dashed ? '8 8' : undefined, interactive: false }).addTo(group);
    L.marker(m.containerPointToLatLng(pl), {
      interactive: false,
      icon: L.divIcon({ className: '', html: `<span class="ray-label" style="--c:${r.color}">${r.label}</span>`, iconSize: [0, 0] }),
    }).addTo(group);
  }
}

export function MapView({ lat, lon, overlay, opacity, onPick, rays }: MapViewProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.CircleMarker | null>(null);
  const lp = useRef<L.TileLayer | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;
  const rayGroup = useRef<L.LayerGroup | null>(null);
  const rayState = useRef({ lat, lon, rays: rays ?? [] });
  rayState.current = { lat, lon, rays: rays ?? [] };

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
    rayGroup.current = L.layerGroup().addTo(m);
    const redraw = () => {
      const r = rayState.current;
      if (rayGroup.current) drawRays(m, rayGroup.current, r.lat, r.lon, r.rays);
    };
    m.on('zoomend moveend resize', redraw);
    map.current = m;
    redraw();
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
    if (map.current && rayGroup.current) drawRays(map.current, rayGroup.current, lat, lon, rays ?? []);
  }, [rays, lat, lon]);

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
