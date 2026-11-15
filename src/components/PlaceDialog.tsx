import { useEffect, useState } from 'react';
import { describePlace, searchPlaces, validElevation, type GeoResult } from '../lib/geocode';
import { browserTz } from '../lib/time';
import { newId, type Place } from '../lib/settings';

type Tab = 'search' | 'gps' | 'coords' | 'favorites';

export interface PlaceDialogProps {
  current: Place | null;
  favorites: Place[];
  onSelect: (p: Place) => void;
  onSaveFavorite: (p: Place) => void;
  onRemoveFavorite: (id: string) => void;
  onClose: () => void;
}

export function locateGps(): Promise<Place> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('Standortbestimmung wird vom Browser nicht unterstützt.'));
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          id: 'gps',
          name: 'Aktueller Standort',
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          elevation: validElevation(pos.coords.altitude),
          tz: browserTz(),
          source: 'gps',
        }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? 'Zugriff auf den Standort wurde verweigert. Bitte in den Browser-Einstellungen erlauben.'
              : 'Standort konnte nicht ermittelt werden.',
          ),
        ),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60000 },
    );
  });
}

export function PlaceDialog({ current, favorites, onSelect, onSaveFavorite, onRemoveFavorite, onClose }: PlaceDialogProps) {
  const [tab, setTab] = useState<Tab>(favorites.length ? 'favorites' : 'search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searched, setSearched] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lat, setLat] = useState(current ? String(current.lat) : '');
  const [lon, setLon] = useState(current ? String(current.lon) : '');
  const [elev, setElev] = useState(current?.elevation != null ? String(Math.round(current.elevation)) : '');
  const [name, setName] = useState('');
  const [favName, setFavName] = useState(current?.name ?? '');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (tab !== 'search' || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const ac = new AbortController();
    const id = setTimeout(() => {
      setBusy(true);
      setError(null);
      searchPlaces(query, ac.signal)
        .then((r) => {
          setResults(r);
          setSearched(query);
        })
        .catch((e) => !ac.signal.aborted && setError(String(e.message ?? e)))
        .finally(() => !ac.signal.aborted && setBusy(false));
    }, 350);
    return () => {
      clearTimeout(id);
      ac.abort();
    };
  }, [query, tab]);

  const useGps = async () => {
    setBusy(true);
    setError(null);
    try {
      onSelect(await locateGps());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const applyCoords = () => {
    const la = Number(lat.replace(',', '.'));
    const lo = Number(lon.replace(',', '.'));
    if (!Number.isFinite(la) || la < -90 || la > 90 || !Number.isFinite(lo) || lo < -180 || lo > 180) {
      setError('Bitte gültige Koordinaten eingeben (Breite −90…90, Länge −180…180, Dezimalgrad).');
      return;
    }
    const el = elev.trim() === '' ? null : Number(elev.replace(',', '.'));
    onSelect({
      id: newId(),
      name: name.trim() || `${la.toFixed(3)}°, ${lo.toFixed(3)}°`,
      lat: la,
      lon: lo,
      elevation: validElevation(el),
      source: 'manual',
    });
  };

  const isFav = current && favorites.some((f) => f.id === current.id);

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="place-title">
        <header>
          <h2 id="place-title">Standort wählen</h2>
          <button className="btn ghost small" onClick={onClose} aria-label="Schließen">
            ✕
          </button>
        </header>

        <div className="tabs" role="tablist">
          {(
            [
              ['favorites', `★ Favoriten (${favorites.length})`],
              ['search', '🔎 Suche'],
              ['gps', '📍 Aktueller Standort'],
              ['coords', '⌖ Koordinaten'],
            ] as [Tab, string][]
          ).map(([t, label]) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setError(null); }}>
              {label}
            </button>
          ))}
        </div>

        {error && <div className="alert error" style={{ marginBottom: 10 }}>{error}</div>}

        {tab === 'search' && (
          <>
            <div className="field">
              <label htmlFor="q">Ort suchen</label>
              <input id="q" autoFocus placeholder="z. B. Zugspitze, Rhön, La Palma …" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            {busy && <p className="muted small">Suche …</p>}
            <ul className="list">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    className="link"
                    onClick={() =>
                      onSelect({
                        id: `geo-${r.id}`,
                        name: r.name,
                        lat: r.latitude,
                        lon: r.longitude,
                        elevation: validElevation(r.elevation),
                        tz: r.timezone,
                        source: 'search',
                      })
                    }
                  >
                    <strong>{r.name}</strong>
                    <div className="small muted">
                      {describePlace(r)} · {r.latitude.toFixed(3)}°, {r.longitude.toFixed(3)}°{validElevation(r.elevation) !== null ? ` · ${Math.round(r.elevation!)} m` : ''}
                    </div>
                  </button>
                </li>
              ))}
              {!busy && searched === query && query.trim().length >= 2 && results.length === 0 && <p className="muted small">Keine Treffer.</p>}
            </ul>
            <p className="tiny faint">Tipp: Einen Ort ohne Namen (z. B. Fotospot im Gelände) kannst du in der Karte per Klick wählen.</p>
          </>
        )}

        {tab === 'gps' && (
          <>
            <p className="muted">Ermittelt die Position über das Gerät (GPS/WLAN). Wird beim nächsten Öffnen der App automatisch aktualisiert.</p>
            <button className="btn primary" onClick={useGps} disabled={busy}>
              {busy ? 'Ermittle Standort …' : '📍 Aktuellen Standort verwenden'}
            </button>
          </>
        )}

        {tab === 'coords' && (
          <>
            <div className="field">
              <label htmlFor="nm">Name (optional)</label>
              <input id="nm" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Fotospot Bergkamm" />
            </div>
            <div className="row">
              <div className="field">
                <label htmlFor="lat">Breite (°N)</label>
                <input id="lat" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="47.4210" />
              </div>
              <div className="field">
                <label htmlFor="lon">Länge (°O)</label>
                <input id="lon" inputMode="decimal" value={lon} onChange={(e) => setLon(e.target.value)} placeholder="10.9850" />
              </div>
              <div className="field">
                <label htmlFor="el">Höhe (m, optional)</label>
                <input id="el" inputMode="decimal" value={elev} onChange={(e) => setElev(e.target.value)} placeholder="automatisch" />
              </div>
            </div>
            <p className="tiny faint">Dezimalgrad, Süd/West negativ. Ohne Höhenangabe wird die Geländehöhe von Open-Meteo übernommen.</p>
            <button className="btn primary" onClick={applyCoords}>
              Übernehmen
            </button>
          </>
        )}

        {tab === 'favorites' && (
          <>
            {current && !isFav && (
              <div className="row" style={{ marginBottom: 12, alignItems: 'flex-end' }}>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="fav">Aktuellen Standort speichern als</label>
                  <input id="fav" value={favName} onChange={(e) => setFavName(e.target.value)} />
                </div>
                <button
                  className="btn primary"
                  onClick={() => onSaveFavorite({ ...current, id: newId(), name: favName.trim() || current.name, source: current.source === 'gps' ? 'manual' : current.source })}
                >
                  ★ Speichern
                </button>
              </div>
            )}
            {favorites.length === 0 && <p className="muted">Noch keine Lieblingsorte gespeichert.</p>}
            <ul className="list">
              {favorites.map((f) => (
                <li key={f.id} className={current?.id === f.id ? 'active' : ''}>
                  <div className="grow">
                    <button className="link" onClick={() => onSelect(f)}>
                      <strong>{f.name}</strong>
                      <div className="small muted">
                        {f.lat.toFixed(3)}°, {f.lon.toFixed(3)}°{f.elevation != null ? ` · ${Math.round(f.elevation)} m` : ''}
                        {f.bortle ? ` · Bortle ${f.bortle}` : ''}
                      </div>
                    </button>
                  </div>
                  <button className="btn small danger" onClick={() => onRemoveFavorite(f.id)} aria-label={`${f.name} löschen`}>
                    🗑
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
