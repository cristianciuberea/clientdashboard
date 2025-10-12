import { useEffect, useState } from 'react';
import { RefreshCw, CheckCircle, XCircle, X } from 'lucide-react';
import { backfillStore, BackfillState } from '../lib/backfillStore';

export default function BackfillBanner() {
  const [state, setState] = useState<BackfillState | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Initial load
    const initialState = backfillStore.get();
    if (initialState?.isRunning) {
      setState(initialState);
      setIsVisible(true);
    }

    // Subscribe to updates
    const unsubscribe = backfillStore.subscribe(() => {
      const newState = backfillStore.get();
      setState(newState);
      setIsVisible(!!newState?.isRunning);
    });

    return unsubscribe;
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
  };

  if (!isVisible || !state) return null;

  const progress = state.total > 0 ? (state.current / state.total) * 100 : 0;
  const elapsed = Date.now() - state.startTime;
  const elapsedMinutes = Math.floor(elapsed / 60000);
  const elapsedSeconds = Math.floor((elapsed % 60000) / 1000);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 flex-1">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center space-x-3">
                  <span className="font-semibold">
                    Backfilling {state.platformName}
                  </span>
                  <span className="text-sm opacity-90">
                    {state.currentDate}
                  </span>
                </div>
                <div className="flex items-center space-x-4 text-sm">
                  <span className="font-bold">{Math.round(progress)}%</span>
                  <span className="opacity-90">
                    {state.current} / {state.total} days
                  </span>
                  <span className="opacity-75">
                    {elapsedMinutes}:{String(elapsedSeconds).padStart(2, '0')}
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex-1 bg-blue-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-white h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex items-center space-x-3 text-xs">
                  <span className="flex items-center space-x-1">
                    <CheckCircle className="w-3 h-3" />
                    <span>{state.success}</span>
                  </span>
                  {state.failed > 0 && (
                    <span className="flex items-center space-x-1 text-red-300">
                      <XCircle className="w-3 h-3" />
                      <span>{state.failed}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="ml-4 p-1 hover:bg-blue-500 rounded transition"
            title="Hide (will continue in background)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

