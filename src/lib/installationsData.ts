import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Place } from '../data/places';
import type { DataOrigin } from './lighting';

/** Installations municipales : fichier public/donnees/installations.*, import dans l'app, ou rien. */
interface InstallationsState {
  source: DataOrigin;
  places: Place[];
  fileName?: string;
  importedAt?: number;
  info?: { total: number; outside: number; located: number; byType: { type: string; count: number }[] };
  load: (places: Place[], fileName: string, source: DataOrigin, info: InstallationsState['info']) => void;
  resetToDemo: () => void;
}

export const useInstallations = create<InstallationsState>()(
  persist(
    (set) => ({
      source: 'demo',
      places: [],
      load: (places, fileName, source, info) => set({ source, places, fileName, info, importedAt: source === 'import' ? Date.now() : undefined }),
      resetToDemo: () => set({ source: 'demo', places: [], fileName: undefined, importedAt: undefined, info: undefined }),
    }),
    {
      name: 'mon-saint-roch-installations-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => (s.source === 'import' ? { source: s.source, places: s.places, fileName: s.fileName, importedAt: s.importedAt, info: s.info } : {}),
    },
  ),
);
