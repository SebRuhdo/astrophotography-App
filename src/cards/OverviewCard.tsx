import { Card, LEVEL_TEXT, ScoreRing, Stat, fmtNum } from '../components/ui';
import { Timeline } from '../components/Timeline';
import { fmtDuration, fmtTime } from '../lib/time';
import { intervalMs } from '../lib/astro';
import type { CardProps } from './types';

export function OverviewCard({ night, score, tz, weather, weatherError, weatherLoading, minAlt }: CardProps) {
  const s = night.sun;
  const mw = night.milkyWay;
  const darkLabel =
    s.darkType === 'astronomisch' ? 'Astronomische Nacht' : s.darkType === 'nautisch' ? 'Nautische Nacht' : s.darkType === 'bürgerlich' ? 'Bürgerliche Dämmerung' : 'Keine Dunkelheit';
  const moonFreeMs = intervalMs(night.moon.moonFreeDark);

  return (
    <Card title="Nacht-Übersicht" icon="🌌" wide>
      <div className="score-row">
        <ScoreRing score={score} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: '1.15rem', fontWeight: 650 }}>{LEVEL_TEXT[score.level]}</div>
          <div className="muted small">
            {weatherLoading && 'Wetterdaten werden geladen … '}
            {weatherError && `Wetter nicht verfügbar: ${weatherError}. `}
            {!weatherLoading && !weatherError && score.cloudAvg === null && 'Für diese Nacht gibt es (noch) keine Wettervorhersage – Score nur mit Wetterdaten. '}
            Score aus Bewölkung und Mondlicht während der Dunkelheit.
          </div>
        </div>
      </div>

      <div className="stats">
        <Stat
          label={darkLabel}
          value={s.dark ? `${fmtTime(s.dark.start, tz)}–${fmtTime(s.dark.end, tz)}` : '–'}
          sub={s.dark ? fmtDuration(s.dark.end.getTime() - s.dark.start.getTime()) : undefined}
        />
        <Stat label="Bewölkung (Ø Nacht)" value={fmtNum(score.cloudAvg, ' %')} />
        <Stat
          label="Mond"
          value={`${Math.round(night.moon.illumination * 100)} %`}
          sub={`${night.moon.phaseName} · mondfrei ${fmtDuration(moonFreeMs)}`}
        />
        <Stat
          label="Milchstraßen-Kern"
          value={mw.visible.length ? `${fmtTime(mw.visible[0].start, tz)}–${fmtTime(mw.visible[mw.visible.length - 1].end, tz)}` : 'nicht sichtbar'}
          sub={mw.moonFree.length ? `mondfrei ${fmtDuration(intervalMs(mw.moonFree))}` : mw.visible.length ? 'nur mit Mond' : undefined}
        />
      </div>

      {s.darkType !== 'astronomisch' && (
        <div className="alert">
          {s.darkType === 'keine'
            ? 'In dieser Nacht wird es nicht dunkel (Sonne bleibt über −6°).'
            : `Keine astronomische Dunkelheit: Die Sonne sinkt nur auf ${s.minAltitude.toFixed(1)}° (nötig: −18°). Der Himmel bleibt etwas aufgehellt.`}
        </div>
      )}
      {score.dewRisk && (
        <div className="alert">
          💧 Taugefahr: Temperatur und Taupunkt liegen nachts nur {fmtNum(score.minSpread, ' °C', 1)} auseinander – Objektivheizung einplanen.
        </div>
      )}

      <Timeline night={night} weather={weather} tz={tz} minAlt={minAlt} />
    </Card>
  );
}
