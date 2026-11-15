# Astro-Planer – Astrofotografie-App

Progressive Web App (läuft im Browser auf Handy, Tablet und PC und lässt sich auf dem Homescreen installieren). Sie stellt alle Infos für eine Astrofoto-Nacht zusammen.

## Funktionen

| Bereich | Inhalt |
|---|---|
| **Nacht-Übersicht** | Nacht-Score (Ampel), Dunkelphase, Ø-Bewölkung, Mond, Milchstraße, Taugefahr-Warnung, grafische Zeitleiste der Nacht |
| **7-Nächte-Vorschau** | Score, Bewölkung, Mond und Dunkelphase der nächsten 7 Nächte (Klick → Details) |
| **Sonne & Dämmerung** | Auf- und Untergang, bürgerliche, nautische und astronomische Dämmerung, Goldene und Blaue Stunde |
| **Mond** | Phase, Beleuchtung, Auf- und Untergang, mondfreie Dunkelzeit, nächster Neu- und Vollmond |
| **Milchstraße** | Sichtbarkeit des galaktischen Zentrums (mit und ohne Mond), beste Zeit, Höhe und Richtung, nächste geeignete Nacht |
| **Planeten** | Merkur bis Neptun: Auf- und Untergang, Kulmination, Sichtbarkeitsfenster, Höhe und Richtung, Helligkeit, Sternbild |
| **Wetter & Seeing** | Stündlich: Bewölkung (gesamt/tief/mittel/hoch), Temperatur, Taupunkt, Feuchte, Wind, Böen, Sicht, Regenrisiko, Jetstream; Seeing-/Transparenz-Grafik von 7Timer! |
| **Karte & Lichtverschmutzung** | OpenStreetMap mit Nachtlichter-Ebene (NASA Black Marble), Standortwahl per Klick, Bortle-Klasse je Standort |

Weitere Funktionen:
- **Standort:** GPS, Ortssuche, Koordinateneingabe oder Klick in die Karte; Lieblingsorte lassen sich speichern.
- **Einstellungen:** Bereiche ein- und ausblenden, Reihenfolge ändern, Mindesthöhe über dem Horizont festlegen.
- **Rotlicht-Nachtmodus** zum Schutz der Dunkeladaption.
- **Zeitzone:** Alle Zeiten erscheinen in der Zeitzone des gewählten Standorts.

### Nacht-Score

```
Score = 100 × (1 − Ø-Bewölkung) × (0,5 + 0,5 × Mondfaktor)
Mondfaktor = 1 − (Anteil der Dunkelzeit mit Mond über Horizont × Mondbeleuchtung)
```
Grün ab 70, Gelb ab 40, darunter Rot. Ohne Wettervorhersage (mehr als ca. 7 Tage voraus) gibt es keinen Score.

## Datenquellen (alle kostenlos, ohne API-Key)

- **Astronomie:** [Astronomy Engine](https://github.com/cosinekitty/astronomy). Die Berechnung läuft lokal im Browser und funktioniert auch offline.
- **Wetter & Ortssuche:** [Open-Meteo](https://open-meteo.com), CC BY 4.0. Kostenlos für nicht-kommerzielle Nutzung, maximal 10.000 Aufrufe pro Tag.
- **Seeing/Transparenz:** [7Timer!](https://www.7timer.info) (als Grafik eingebunden, da die API kein CORS erlaubt)
- **Nachtlichter:** NASA GIBS, VIIRS Black Marble 2016. Die Ebene zeigt Lichtquellen als Indikator, misst aber keine Himmelshelligkeit.
- **Karte:** © OpenStreetMap-Mitwirkende

## Entwicklung

```bash
npm install
npm run dev      # Entwicklungsserver
npm test         # Unit-Tests (Astro-Berechnungen)
npm run build    # Produktions-Build nach dist/
```

Stack: React 19, TypeScript, Vite und vite-plugin-pwa.

## Deployment (GitHub Pages)

Der Workflow `.github/workflows/deploy.yml` baut und veröffentlicht die App bei jedem Push auf `main`.
Einmalig nötig: unter **Settings → Pages → Source** die Option **GitHub Actions** wählen.
