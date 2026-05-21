import { Component, ReactNode } from 'react';

interface State { hasError: boolean; error?: Error }

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error('[tenant] uncaught render error', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-bg flex items-center justify-center p-6">
          <div className="card-elev max-w-md w-full p-8 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-danger-faded text-danger flex items-center justify-center text-2xl">!</div>
            <h2 className="text-lg font-bold mb-2">Что-то пошло не так</h2>
            <p className="text-sm text-text-dim mb-6">
              Перезагрузите страницу. Если проблема повторится — свяжитесь с администратором.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="h-11 px-6 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold transition-all active:scale-[0.97]"
            >
              Обновить
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
