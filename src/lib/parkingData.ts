import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { PARKINGS, Parking } from '../data/parkings';
import type { DataOrigin } from './lighting';

/**
 * Stationnements municipaux hors rue : fichier public/donnees/stationnements.geojson (format de la Ville),
 * import dans l'app, ou liste de secours au même format.
 */
interface ParkingDataState {
  source: DataOrigin;
  municipal: Parking[];
  fileName?: string;
  importedAt?: number;
  info?: { total: number; skipped: number };
  load: (parkings: Parking[], fileName: string, source: DataOrigin, info: ParkingDataState['info']) => void;
  resetToDemo: () => void;
}

export const useParkingData = create<ParkingDataState>()(
  persist(
    (set) => ({
      source: 'demo',
      municipal: PARKINGS,
      load: (municipal, fileName, source, info) => set({ source, municipal, fileName, info, importedAt: source === 'import' ? Date.now() : undefined }),
      resetToDemo: () => set({ source: 'demo', municipal: PARKINGS, fileName: undefined, importedAt: undefined, info: undefined }),
    }),
    {
      name: 'mon-saint-roch-stationnements-v2',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => (s.source === 'import' ? { source: s.source, municipal: s.municipal, fileName: s.fileName, importedAt: s.importedAt, info: s.info } : {}),
    },
  ),
);

export function getParkings(): Parking[] {
  return useParkingData.getState().municipal;
}

export function useParkings(): Parking[] {
  return useParkingData((s) => s.municipal);
}
