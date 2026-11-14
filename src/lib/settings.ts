import { useCallback, useEffect, useState } from 'react';

export type CardId = 'overview' | 'forecast' | 'sun' | 'moon' | 'milkyway' | 'planets' | 'weather' | 'lightpollution';

export const CARD_LABELS: Record<CardId, string> = {
  overview: 'Nacht-Übersicht & Zeitleiste',
  forecast: '7-Nächte-Vorschau',
  sun: 'Sonne & Dämmerung',
  moon: 'Mond',
  milkyway: 'Milchstraße',
  planets: 'Planeten',
  weather: 'Wetter & Seeing',
  lightpollution: 'Karte & Lichtverschmutzung',
};

export interface Place {
  id: string;
  name: string;
  lat: number;
  lon: number;
  elevation: number | null; // null = noch unbekannt (wird aus Wetter-API ergänzt)
  tz?: string;
  bortle?: number | null; // manuell eingetragen (1–9)
  source: 'gps' | 'search' | 'manual' | 'map';
}

export interface Settings {
  cards: { id: CardId; visible: boolean }[];
  minAltitude: number; // Grad
  redMode: boolean;
  favorites: Place[];
  place: Place | null;
}

export const DEFAULT_SETTINGS: Settings = {
  cards: (Object.keys(CARD_LABELS) as CardId[]).map((id) => ({ id, visible: true })),
  minAltitude: 5,
  redMode: false,
  favorites: [],
  place: null,
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
    for (const id of Object.keys(CARD_LABELS) as CardId[]) if (!cards.some((c) => c.id === id)) cards.push({ id, visible: true });
    return { ...s, cards };
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
