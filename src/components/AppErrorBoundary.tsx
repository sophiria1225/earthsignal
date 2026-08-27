import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface State {
  hasError: boolean;
}

interface Props {
  children?: React.ReactNode;
}

export class AppErrorBoundary extends React.Component<Props, State> {
  declare readonly props: Readonly<Props>;
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('EarthSignal render error:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center p-6 text-slate-900 dark:text-white">
        <section role="alert" className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
            <div>
              <h1 className="font-bold">画面の表示中に問題が発生しました</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">端末内の観測データは削除していません。ページを再読み込みして復旧を試せます。</p>
            </div>
          </div>
          <button type="button" onClick={() => window.location.reload()} className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4" /> ページを再読み込み
          </button>
        </section>
      </main>
    );
  }
}
