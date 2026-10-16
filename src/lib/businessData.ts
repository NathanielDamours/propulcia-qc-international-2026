import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Place } from '../data/places';
import type { DataOrigin } from './lighting';

/** Registre des entreprises : fichier public/donnees/commerces.*, import dans l'app, ou rien (lieux de démonstration seulement). */
interface BusinessDataState {
  source: DataOrigin;
  places: Place[];
  fileName?: string;
  importedAt?: number;
  info?: { total: number; located: number; unknownStreets: { street: string; count: number }[] };
  load: (places: Place[], fileName: string, source: DataOrigin, info: BusinessDataState['info']) => void;
  resetToDemo: () => void;
}

export const useBusinessData = create<BusinessDataState>()(
  persist(
    (set) => ({
      source: 'demo',
      places: [],
      load: (places, fileName, source, info) => set({ source, places, fileName, info, importedAt: source === 'import' ? Date.now() : undefined }),
      resetToDemo: () => set({ source: 'demo', places: [], fileName: undefined, importedAt: undefined, info: undefined }),
    }),
    {
      name: 'mon-saint-roch-commerces-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => (s.source === 'import' ? { source: s.source, places: s.places, fileName: s.fileName, importedAt: s.importedAt, info: s.info } : {}),
    },
  ),
);
