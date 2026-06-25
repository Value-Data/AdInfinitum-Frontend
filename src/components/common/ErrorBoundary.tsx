import React from 'react';

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      // Class component can't use the useT hook; read persisted language directly.
      const en =
        typeof localStorage !== 'undefined' &&
        localStorage.getItem('adinf_language') === 'en';
      return (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2 style={{ color: 'var(--color-danger)', marginBottom: '1rem' }}>
            {en ? 'An error occurred' : 'Ocurrió un error'}
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
            {this.state.error?.message || (en ? 'Unknown error' : 'Error desconocido')}
          </p>
          <button
            className="btn btn-primary"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.href = '/projects';
            }}
          >
            {en ? 'Back to Projects' : 'Volver a Proyectos'}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
