
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Fix: Extend Component directly to resolve type inheritance issues
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Uncaught error in ${this.props.componentName || 'component'}:`, error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-red-900/10 border border-red-500/20 rounded-lg text-red-200 flex flex-col items-center justify-center h-full min-h-[200px]">
          <div className="bg-red-500/20 p-3 rounded-full mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold mb-2 text-center">Algo deu errado</h2>
          <p className="text-sm text-red-300/80 text-center mb-6 max-w-md">
            Ocorreu um erro inesperado em: <span className="font-mono font-bold">{this.props.componentName || 'um componente'}</span>.
          </p>
          
          {this.state.error && (
             <details className="w-full max-w-md mb-6 bg-black/20 p-3 rounded text-xs font-mono text-red-300/60 overflow-x-auto">
               <summary className="cursor-pointer hover:text-red-300 mb-2 select-none">Ver detalhes técnicos</summary>
               {this.state.error.toString()}
             </details>
          )}

          <button
            onClick={this.handleRetry}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-red-500"
          >
            Tentar Novamente
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
