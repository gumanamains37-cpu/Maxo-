import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error inside ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center bg-[#09090B] text-white rounded-[28px] border border-white/5 my-4">
          <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-full flex items-center justify-center mb-6 animate-pulse">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-base font-black tracking-tight mb-2 uppercase italic text-rose-400">
            Interface Render Interrupted
          </h2>
          <p className="text-xs text-gray-500 max-w-sm mb-6 font-semibold leading-relaxed">
            {this.state.error?.message || "An unexpected rendering crash occurred while building this view. Don't worry, your connection is safe."}
          </p>
          <div className="flex gap-3">
            <Button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-xs uppercase px-5 py-2.5 rounded-xl transition-all"
            >
              <RefreshCw size={14} className="mr-1.5" /> Retry Load
            </Button>
            <Button
              onClick={this.handleReset}
              className="bg-gradient-to-r from-pink-500 to-indigo-500 hover:opacity-90 text-white font-bold text-xs uppercase px-5 py-2.5 rounded-xl border-0"
            >
              <Home size={14} className="mr-1.5" /> Return Home
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
