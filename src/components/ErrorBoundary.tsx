import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Caught unhandled rendering error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#FAFAF8] text-center select-none font-sans h-full min-h-[400px]">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 flex items-center justify-center border border-rose-100 mb-4 animate-pulse">
            <AlertTriangle className="w-8 h-8 text-rose-500" />
          </div>
          <h3 className="text-base font-bold text-zinc-800">Something went wrong in this view</h3>
          <p className="text-xs text-zinc-500 max-w-sm mt-1 leading-relaxed">
            An unexpected error occurred while rendering this component. The rest of the application remains active and safe.
          </p>
          <pre className="mt-4 p-3.5 bg-zinc-150 rounded-xl text-[10px] text-zinc-600 font-mono max-w-lg overflow-x-auto text-left border border-zinc-200">
            {this.state.error?.toString() || "Unknown rendering exception"}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-5 flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer shadow-sm active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reload Component</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
