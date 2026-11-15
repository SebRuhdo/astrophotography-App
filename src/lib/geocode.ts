// Ortssuche über die Open-Meteo Geocoding API (GeoNames-Daten)

export interface GeoResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  elevation?: number;
  timezone?: string;
  country?: string;
  admin1?: string;
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<GeoResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name: q, count: '8', language: 'de', format: 'json' })}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Ortssuche fehlgeschlagen (HTTP ${res.status})`);
  const j = await res.json();
  return (j.results ?? []) as GeoResult[];
}

export function describePlace(r: GeoResult): string {
  return [r.admin1, r.country].filter(Boolean).join(', ');
}
