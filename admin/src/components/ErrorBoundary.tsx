import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('ErrorBoundary caught:', error, info);
  }

  reset = () => {
    this.setState({ error: null });
    window.location.href = '/';
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-bg3 border border-border rounded-2xl p-6 fia">
          <div className="w-12 h-12 rounded-2xl bg-[#3D1414] border border-[#7A2828] flex items-center justify-center mb-4">
            <AlertTriangle size={22} className="text-danger" />
          </div>
          <h1 className="text-lg font-bold tracking-tight mb-2">Что-то пошло не так</h1>
          <p className="text-sm text-text-dim leading-relaxed mb-4">
            В интерфейсе произошла ошибка. Попробуйте перезагрузить страницу.
          </p>
          {this.state.error.message && (
            <pre className="text-xs text-text-muted bg-bg2 border border-border rounded-lg p-3 mb-4 overflow-auto max-h-32 font-mono">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.reset}
            className="h-12 w-full bg-accent hover:bg-accent-hover text-white rounded-xl font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <RefreshCw size={16} /> На главную
          </button>
        </div>
      </div>
    );
  }
}
