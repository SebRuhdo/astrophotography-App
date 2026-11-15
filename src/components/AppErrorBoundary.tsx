import { Component, type ReactNode } from 'react';

const KEY = 'astro-planer:settings:v1';

/** Letzte Absicherung: statt leerem Bildschirm eine Meldung mit Ausweg anzeigen. */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('Astro-Planer: unerwarteter Fehler', error);
  }

  private resetPlace = () => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? '{}');
      localStorage.setItem(KEY, JSON.stringify({ ...s, place: null }));
    } catch {
      localStorage.removeItem(KEY);
    }
    location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="app">
        <div className="welcome">
          <h1>Da ist etwas schiefgelaufen</h1>
          <p className="muted">Für den gewählten Standort oder das Datum konnte die App nicht rechnen.</p>
          <div className="alert error" style={{ textAlign: 'left' }}>
            {this.state.error.message || String(this.state.error)}
          </div>
          <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}>
            <button className="btn" onClick={() => location.reload()}>
              Neu laden
            </button>
            <button className="btn primary" onClick={this.resetPlace}>
              Standort zurücksetzen
            </button>
          </div>
          <p className="tiny faint" style={{ marginTop: 12 }}>Lieblingsorte und Einstellungen bleiben erhalten.</p>
        </div>
      </div>
    );
  }
}
