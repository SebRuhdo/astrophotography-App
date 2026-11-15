import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import { createPortal } from 'react-dom';
import { computeNight } from './lib/astro';
import { scoreNight } from './lib/score';
import { useSettings, type CardId, type Place } from './lib/settings';
import { addDaysIso, browserTz, currentNightIso, fmtDateLong, localNoon } from './lib/time';
import { fetchWeather, type WeatherData } from './lib/weather';
import { PlaceDialog, locateGps } from './components/PlaceDialog';
import { SettingsDialog } from './components/SettingsDialog';
import type { CardProps, ForecastNight } from './cards/types';
import { OverviewCard } from './cards/OverviewCard';
import { ForecastCard } from './cards/ForecastCard';
import { SunCard } from './cards/SunCard';
import { MoonCard } from './cards/MoonCard';
import { MoonCalendarCard } from './cards/MoonCalendarCard';
import { AuroraCard } from './cards/AuroraCard';
import { MilkyWayCard } from './cards/MilkyWayCard';
import { PlanetsCard } from './cards/PlanetsCard';
import { WeatherCard } from './cards/WeatherCard';
import { LightPollutionCard } from './cards/LightPollutionCard';

const CARDS: Record<CardId, ComponentType<CardProps>> = {
  overview: OverviewCard,
  forecast: ForecastCard,
  sun: SunCard,
  moon: MoonCard,
  mooncalendar: MoonCalendarCard,
  milkyway: MilkyWayCard,
  aurora: AuroraCard,
  planets: PlanetsCard,
  weather: WeatherCard,
  lightpollution: LightPollutionCard,
};

export default function App() {
  const [settings, update] = useSettings();
  const place = settings.place;
  const tz = place?.tz ?? browserTz();
  const [dateIso, setDateIso] = useState(() => currentNightIso(tz));
  const [dialog, setDialog] = useState<'place' | 'settings' | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Rotlicht-Modus
  useEffect(() => {
    document.body.classList.toggle('red', settings.redMode);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', settings.redMode ? '#000000' : '#0b1020');
  }, [settings.redMode]);

  const updatePlace = useCallback(
    (patch: Partial<Place>) =>
      update((s) => {
        if (!s.place) return {};
        const p = { ...s.place, ...patch };
        return { place: p, favorites: s.favorites.map((f) => (f.id === p.id ? { ...f, ...patch } : f)) };
      }),
    [update],
  );

  // GPS-Standort beim Start aktualisieren
  useEffect(() => {
    if (settings.place?.source !== 'gps') return;
    locateGps()
      .then((p) => update({ place: p }))
      .catch((e) => setGpsError((e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wetter laden
  useEffect(() => {
    if (!place) return;
    const ac = new AbortController();
    setWeather(null);
    setWeatherError(null);
    setWeatherLoading(true);
    fetchWeather(place.lat, place.lon, ac.signal)
      .then((w) => {
        setWeather(w);
        const patch: Partial<Place> = {};
        if (!place.tz && w.timezone) patch.tz = w.timezone;
        if (place.elevation === null && Number.isFinite(w.elevation)) patch.elevation = w.elevation;
        if (Object.keys(patch).length) updatePlace(patch);
      })
      .catch((e) => {
        if (!ac.signal.aborted) setWeatherError((e as Error).message);
      })
      .finally(() => {
        if (!ac.signal.aborted) setWeatherLoading(false);
      });
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place?.lat, place?.lon]);

  const minAlt = settings.minAltitude;
  const elevation = place?.elevation ?? 0;

  const night = useMemo(
    () => (place ? computeNight(place.lat, place.lon, elevation, localNoon(dateIso, tz), dateIso, { minAltitude: minAlt }) : null),
    [place?.lat, place?.lon, elevation, dateIso, tz, minAlt], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const score = useMemo(() => (night ? scoreNight(night, weather) : null), [night, weather]);

  const forecast = useMemo<ForecastNight[]>(() => {
    if (!place) return [];
    const first = currentNightIso(tz);
    return Array.from({ length: 7 }, (_, i) => {
      const iso = addDaysIso(first, i);
      const n =
        night && night.dateIso === iso
          ? night
          : computeNight(place.lat, place.lon, elevation, localNoon(iso, tz), iso, { minAltitude: minAlt, planets: false });
      return { dateIso: iso, night: n, score: scoreNight(n, weather) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place?.lat, place?.lon, elevation, tz, minAlt, weather]);

  const selectPlace = (p: Place) => {
    update({ place: p });
    setDialog(null);
    setGpsError(null);
  };

  const pickLocation = useCallback(
    (lat: number, lon: number) =>
      update({ place: { id: `map-${lat.toFixed(4)},${lon.toFixed(4)}`, name: `Kartenpunkt ${lat.toFixed(3)}°, ${lon.toFixed(3)}°`, lat, lon, elevation: null, source: 'map' } }),
    [update],
  );

  const today = currentNightIso(tz);

  return (
    <>
      {/* Overlay außerhalb von #root, damit es nicht selbst entfärbt wird */}
      {settings.redMode && createPortal(<div className="red-overlay" aria-hidden />, document.body)}
      <div className="app">
        <header className="topbar">
          <div className="brand" title="Astro-Planer">
            <img src="./icon.svg" alt="" />
            <span className="title-short">
              Astro-Planer<span className="title-long muted" style={{ fontWeight: 400 }}> · Astrofotografie</span>
            </span>
          </div>
          <button className="btn place-btn" onClick={() => setDialog('place')} title="Standort wählen">
            📍 <span>{place ? place.name : 'Standort wählen'}</span>
          </button>
          <button
            className="btn"
            aria-pressed={settings.redMode}
            onClick={() => update({ redMode: !settings.redMode })}
            title="Rotlicht-Nachtmodus"
            aria-label="Rotlicht-Nachtmodus umschalten"
          >
            🔴
          </button>
          <button className="btn" onClick={() => setDialog('settings')} title="Einstellungen" aria-label="Einstellungen">
            ⚙️
          </button>
        </header>

        {!place || !night || !score ? (
          <div className="welcome">
            <h1>Willkommen beim Astro-Planer</h1>
            <p className="muted">
              Wetter, Bewölkung, Seeing, Dämmerung, Mond, Planeten, Milchstraße und Lichtverschmutzung – alles für deine nächste Astrofoto-Nacht.
            </p>
            {gpsError && <div className="alert error">{gpsError}</div>}
            <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}>
              <button
                className="btn primary"
                onClick={() =>
                  locateGps()
                    .then(selectPlace)
                    .catch((e) => setGpsError((e as Error).message))
                }
              >
                📍 Aktuellen Standort verwenden
              </button>
              <button className="btn" onClick={() => setDialog('place')}>
                🔎 Ort suchen / eingeben
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="datebar">
              <h1>
                Nacht vom {fmtDateLong(dateIso)}
                <div className="small muted" style={{ fontWeight: 400 }}>
                  {place.lat.toFixed(3)}°, {place.lon.toFixed(3)}°{place.elevation !== null ? ` · ${Math.round(place.elevation)} m` : ''} · Zeitzone {tz}
                  {place.bortle ? ` · Bortle ${place.bortle}` : ''}
                </div>
              </h1>
              <button className="btn small" onClick={() => setDateIso(addDaysIso(dateIso, -1))} aria-label="Vorherige Nacht">
                ◀
              </button>
              <input type="date" value={dateIso} onChange={(e) => e.target.value && setDateIso(e.target.value)} aria-label="Datum wählen" />
              <button className="btn small" onClick={() => setDateIso(addDaysIso(dateIso, 1))} aria-label="Nächste Nacht">
                ▶
              </button>
              {dateIso !== today && (
                <button className="btn small" onClick={() => setDateIso(today)}>
                  Heute
                </button>
              )}
            </div>
            {gpsError && <div className="alert error" style={{ marginBottom: 12 }}>{gpsError}</div>}

            <main className="grid">
              {settings.cards
                .filter((c) => c.visible)
                .map((c) => {
                  const C = CARDS[c.id];
                  return (
                    <C
                      key={c.id}
                      night={night}
                      score={score}
                      tz={tz}
                      place={place}
                      weather={weather}
                      weatherError={weatherError}
                      weatherLoading={weatherLoading}
                      minAlt={minAlt}
                      forecast={forecast}
                      selectDate={(iso) => {
                        setDateIso(iso);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      pickLocation={pickLocation}
                      updatePlace={updatePlace}
                    />
                  );
                })}
              {settings.cards.every((c) => !c.visible) && <p className="muted">Alle Bereiche ausgeblendet – in den Einstellungen (⚙️) wieder einschalten.</p>}
            </main>
          </>
        )}

        <footer className="attrib">
          Wetter: <a href="https://open-meteo.com" target="_blank" rel="noreferrer">Open-Meteo</a> (CC BY 4.0) · Seeing:{' '}
          <a href="https://www.7timer.info" target="_blank" rel="noreferrer">7Timer!</a> · Polarlicht:{' '}
          <a href="https://www.swpc.noaa.gov" target="_blank" rel="noreferrer">NOAA SWPC</a> · Nachtlichter: NASA GIBS / VIIRS Black Marble · Karte: ©{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · Astronomie:{' '}
          <a href="https://github.com/cosinekitty/astronomy" target="_blank" rel="noreferrer">Astronomy Engine</a>
        </footer>
      </div>

      {dialog === 'place' && (
        <PlaceDialog
          current={place}
          favorites={settings.favorites}
          onSelect={selectPlace}
          onSaveFavorite={(p) => update((s) => ({ favorites: [...s.favorites, p], place: p }))}
          onRemoveFavorite={(id) => update((s) => ({ favorites: s.favorites.filter((f) => f.id !== id) }))}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'settings' && <SettingsDialog settings={settings} update={update} onClose={() => setDialog(null)} />}
    </>
  );
}
