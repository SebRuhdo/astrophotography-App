import { Component, type ReactNode } from 'react';

interface Props {
  title: string;
  children: ReactNode;
}

/** Fängt Fehler in einem Bereich ab, damit nicht die ganze App leer bleibt. */
export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(`Fehler im Bereich „${this.props.title}“:`, error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section className="card">
        <h2>⚠️ {this.props.title}</h2>
        <div className="alert error">
          Dieser Bereich konnte nicht angezeigt werden{this.state.error.message ? `: ${this.state.error.message}` : '.'}
        </div>
        <button className="btn small" style={{ marginTop: 10 }} onClick={() => this.setState({ error: null })}>
          Erneut versuchen
        </button>
      </section>
    );
  }
}
