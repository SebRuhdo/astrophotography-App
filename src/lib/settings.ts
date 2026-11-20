import { useCallback, useEffect, useState } from 'react';
import { validElevation } from './geocode';
import { DEFAULT_THRESHOLDS, type Profile, type Thresholds } from './rating';
import { TERRAIN_DIRS, type HorizonProfile } from './horizon';

export type CardId =
  | 'overview'
  | 'forecast'
  | 'spots'
  | 'sun'
  | 'moon'
  | 'mooncalendar'
  | 'milkyway'
  | 'horizon'
  | 'aurora'
  | 'planets'
  | 'weather'
  | 'lightpollution';

export const CARD_LABELS: Record<CardId, string> = {
  overview: 'Nacht-Übersicht & Zeitleiste',
  forecast: '7-Nächte-Vorschau',
  spots: 'Spot-Vergleich (Lieblingsorte)',
  sun: 'Sonne & Dämmerung',
  moon: 'Mond',
  mooncalendar: 'Mondkalender',
  milkyway: 'Milchstraße',
  horizon: 'Horizont-Profil',
  aurora: 'Polarlicht (Aurora)',
  planets: 'Planeten',
  weather: 'Wetter & Seeing',
  lightpollution: 'Karte, Richtungen & Lichtverschmutzung',
};

export interface Place {
  id: string;
  name: string;
  lat: number;
  lon: number;
  elevation: number | null; // null = noch unbekannt (wird aus Wetter-API ergänzt)
  tz?: string;
  bortle?: number | null; // manuell eingetragen (1–9)
  horizon?: HorizonProfile; // Gelände + vor Ort erfasste Punkte
  source: 'gps' | 'search' | 'manual' | 'map';
}

export interface Settings {
  cards: { id: CardId; visible: boolean }[];
  minAltitude: number; // Grad
  redMode: boolean;
  favorites: Place[];
  place: Place | null;
  collapsed: CardId[]; // eingeklappte Bereiche
  profile: Profile;
  thresholds: Thresholds;
}

export const DEFAULT_SETTINGS: Settings = {
  cards: (Object.keys(CARD_LABELS) as CardId[]).map((id) => ({ id, visible: true })),
  minAltitude: 5,
  redMode: false,
  favorites: [],
  place: null,
  collapsed: [],
  profile: 'landscape',
  thresholds: DEFAULT_THRESHOLDS,
};

const KEY = 'astro-planer:settings:v1';

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const s = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as Settings;
    // neue Karten (spätere Versionen) ergänzen, unbekannte entfernen
    const known = new Set(Object.keys(CARD_LABELS));
    const cards = s.cards.filter((c) => known.has(c.id));
    // neue Karten an ihrer Standard-Position (hinter dem Vorgänger) einfügen
    const order = Object.keys(CARD_LABELS) as CardId[];
    order.forEach((id, i) => {
      if (cards.some((c) => c.id === id)) return;
      const prev = order.slice(0, i).reverse().find((p) => cards.some((c) => c.id === p));
      const at = prev ? cards.findIndex((c) => c.id === prev) + 1 : 0;
      cards.splice(at, 0, { id, visible: true });
    });
    // gespeicherte Orte bereinigen (z. B. Höhe −9999 aus früheren Versionen)
    const fixHorizon = (h: HorizonProfile | undefined): HorizonProfile | undefined => {
      if (!h) return undefined;
      const terrain = Array.isArray(h.terrain) && (h.terrain.length === TERRAIN_DIRS || h.terrain.length === 72) && h.terrain.every(Number.isFinite) ? h.terrain : null;
      const manual = Array.isArray(h.manual) ? h.manual.filter((m) => Number.isFinite(m?.az) && Number.isFinite(m?.alt)) : [];
      return terrain || manual.length ? { ...h, terrain, manual } : undefined;
    };
    const fix = (p: Place | null): Place | null =>
      p && Number.isFinite(p.lat) && Number.isFinite(p.lon) ? { ...p, elevation: validElevation(p.elevation), horizon: fixHorizon(p.horizon) } : null;
    const favorites = (Array.isArray(s.favorites) ? s.favorites : []).map(fix).filter((p): p is Place => p !== null);
    const collapsed = (Array.isArray(s.collapsed) ? s.collapsed : []).filter((id) => known.has(id));
    const thresholds = { ...DEFAULT_THRESHOLDS, ...(s.thresholds ?? {}) };
    const profile: Profile = s.profile === 'deepsky' ? 'deepsky' : 'landscape';
    return { ...s, cards, favorites, collapsed, thresholds, profile, place: fix(s.place) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      /* z. B. privater Modus */
    }
  }, [settings]);
  const update = useCallback((patch: Partial<Settings> | ((s: Settings) => Partial<Settings>)) => {
    setSettings((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }));
  }, []);
  return [settings, update] as const;
}

export const newId = () => Math.random().toString(36).slice(2, 10);
