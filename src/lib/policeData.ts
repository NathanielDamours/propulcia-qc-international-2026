import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { DEMO_POLICE, PoliceStation } from './policeParse';
import type { DataOrigin } from './lighting';

/** Postes de police : fichier public/donnees/postes-police.geojson, import dans l'app, ou liste de secours. */
interface PoliceDataState {
  source: DataOrigin;
  stations: PoliceStation[];
  fileName?: string;
  importedAt?: number;
  load: (stations: PoliceStation[], fileName: string, source: DataOrigin) => void;
  resetToDemo: () => void;
}

export const usePolice = create<PoliceDataState>()(
  persist(
    (set) => ({
      source: 'demo',
      stations: DEMO_POLICE,
      load: (stations, fileName, source) => set({ source, stations, fileName, importedAt: source === 'import' ? Date.now() : undefined }),
      resetToDemo: () => set({ source: 'demo', stations: DEMO_POLICE, fileName: undefined, importedAt: undefined }),
    }),
    {
      name: 'mon-saint-roch-police-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => (s.source === 'import' ? { source: s.source, stations: s.stations, fileName: s.fileName, importedAt: s.importedAt } : {}),
    },
  ),
);
