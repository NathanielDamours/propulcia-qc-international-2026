import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { BusStop } from './stopsParse';
import type { DataOrigin } from './lighting';

/** Arrêts d'autobus : public/donnees/stops.txt (GTFS du RTC), import dans l'app, ou aucun. */
interface StopsState {
  source: DataOrigin;
  stops: BusStop[];
  fileName?: string;
  importedAt?: number;
  info?: { total: number; outside: number };
  load: (stops: BusStop[], fileName: string, source: DataOrigin, info: StopsState['info']) => void;
  resetToDemo: () => void;
}

export const useStops = create<StopsState>()(
  persist(
    (set) => ({
      source: 'demo',
      stops: [],
      load: (stops, fileName, source, info) => set({ source, stops, fileName, info, importedAt: source === 'import' ? Date.now() : undefined }),
      resetToDemo: () => set({ source: 'demo', stops: [], fileName: undefined, importedAt: undefined, info: undefined }),
    }),
    {
      name: 'mon-saint-roch-arrets-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => (s.source === 'import' ? { source: s.source, stops: s.stops, fileName: s.fileName, importedAt: s.importedAt, info: s.info } : {}),
    },
  ),
);
