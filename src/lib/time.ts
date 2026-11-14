// Zeitzonen-Helfer: Alle Zeiten werden in der Zeitzone des gewählten Standorts angezeigt.

export const browserTz = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

const partsCache = new Map<string, Intl.DateTimeFormat>();
function partsFmt(tz: string): Intl.DateTimeFormat {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    partsCache.set(tz, f);
  }
  return f;
}

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function zonedParts(date: Date, tz: string): ZonedParts {
  const p: Record<string, number> = {};
  for (const part of partsFmt(tz).formatToParts(date)) {
    if (part.type !== 'literal') p[part.type] = Number(part.value);
  }
  return { year: p.year, month: p.month, day: p.day, hour: p.hour % 24, minute: p.minute, second: p.second };
}

/** Offset der Zeitzone zu UTC in Minuten zum Zeitpunkt `date`. */
export function tzOffsetMinutes(date: Date, tz: string): number {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** Wandelt eine lokale Uhrzeit in der Zeitzone `tz` in einen UTC-Zeitpunkt um. */
export function zonedTime(year: number, month: number, day: number, hour: number, minute: number, tz: string): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  let off = tzOffsetMinutes(new Date(guess), tz);
  let t = guess - off * 60000;
  // zweiter Durchlauf für Sommer-/Winterzeitwechsel
  off = tzOffsetMinutes(new Date(t), tz);
  t = guess - off * 60000;
  return new Date(t);
}

/** ISO-Datum (YYYY-MM-DD) → lokaler Mittag am Standort. */
export function localNoon(isoDate: string, tz: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return zonedTime(y, m, d, 12, 0, tz);
}

export function todayIso(tz: string): string {
  const p = zonedParts(new Date(), tz);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Datum der „Nacht“: vor 12 Uhr Ortszeit zählt noch die vorige Nacht. */
export function currentNightIso(tz: string): string {
  const now = new Date();
  const p = zonedParts(now, tz);
  const iso = todayIso(tz);
  return p.hour < 12 ? addDaysIso(iso, -1) : iso;
}

export function addDaysIso(isoDate: string, n: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export function fmtTime(date: Date | null | undefined, tz: string): string {
  if (!date) return '–';
  return new Intl.DateTimeFormat('de-DE', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(date);
}

export function fmtHour(date: Date, tz: string): string {
  return new Intl.DateTimeFormat('de-DE', { timeZone: tz, hour: '2-digit' }).format(date);
}

/** Uhrzeit, ergänzt um den Wochentag, wenn das Ereignis nicht in der Nacht `nightIso` liegt. */
export function fmtTimeDay(date: Date | null | undefined, tz: string): string {
  if (!date) return '–';
  return new Intl.DateTimeFormat('de-DE', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}

export function fmtDateLong(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

export function fmtDateShort(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

export function fmtDuration(ms: number): string {
  if (ms <= 0) return '0 min';
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
}
