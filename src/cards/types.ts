import type { NightAstro } from '../lib/astro';
import type { NightScore } from '../lib/score';
import type { Place } from '../lib/settings';
import type { WeatherData } from '../lib/weather';

export interface ForecastNight {
  dateIso: string;
  night: NightAstro;
  score: NightScore;
}

export interface CardProps {
  night: NightAstro;
  score: NightScore;
  tz: string;
  place: Place;
  weather: WeatherData | null;
  weatherError: string | null;
  weatherLoading: boolean;
  minAlt: number;
  forecast: ForecastNight[];
  selectDate: (iso: string) => void;
  pickLocation: (lat: number, lon: number) => void;
  updatePlace: (patch: Partial<Place>) => void;
}
