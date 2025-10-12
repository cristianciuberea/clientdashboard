// Global state for backfill progress using localStorage
export interface BackfillState {
  isRunning: boolean;
  current: number;
  total: number;
  currentDate: string;
  success: number;
  failed: number;
  platformName: string;
  startTime: number;
}

const STORAGE_KEY = 'backfill_progress';

export const backfillStore = {
  get(): BackfillState | null {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  set(state: BackfillState) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      // Trigger storage event for other components
      window.dispatchEvent(new Event('backfill-update'));
    } catch (e) {
      console.error('Failed to save backfill state:', e);
    }
  },

  clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(new Event('backfill-update'));
    } catch (e) {
      console.error('Failed to clear backfill state:', e);
    }
  },

  // Subscribe to updates
  subscribe(callback: () => void) {
    window.addEventListener('backfill-update', callback);
    window.addEventListener('storage', callback);
    return () => {
      window.removeEventListener('backfill-update', callback);
      window.removeEventListener('storage', callback);
    };
  }
};

