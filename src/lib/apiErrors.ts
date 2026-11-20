// Fehler der kostenlosen Open-Meteo-API verständlich aufbereiten.

/** API-Limit der kostenlosen Open-Meteo-API erreicht. */
export class ApiLimitError extends Error {
  constructor(
    public kind: 'minute' | 'hour' | 'day',
    message: string,
  ) {
    super(message);
  }
}

/** Englische API-Meldungen in verständliches Deutsch übersetzen. */
export function friendlyApiError(reason: string, what = 'Daten'): Error {
  const note = ' Die Limits der kostenlosen Open-Meteo-API gelten je IP-Adresse (im Mobilfunknetz teilen sich oft viele Geräte eine IP).';
  if (/minutely/i.test(reason)) return new ApiLimitError('minute', `${what}: Minutenlimit erreicht – bitte in einer Minute erneut versuchen.${note}`);
  if (/hourly/i.test(reason)) return new ApiLimitError('hour', `${what}: Stundenlimit erreicht – bitte später erneut versuchen.${note}`);
  if (/daily/i.test(reason)) return new ApiLimitError('day', `${what}: Tageslimit erreicht – ab morgen wieder verfügbar.${note}`);
  return new Error(`${what}: ${reason}`);
}
