import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AppEvent, EVENTS } from '../data/events';
import type { DataOrigin } from './lighting';

/** Événements : fichier public/donnees/evenements.* (format de la Ville), import dans l'app, ou secours intégré. */
interface EventDataState {
  source: DataOrigin;
  events: AppEvent[];
  fileName?: string;
  importedAt?: number;
  info?: { total: number; outside: number; skipped: number };
  load: (events: AppEvent[], fileName: string, source: DataOrigin, info: EventDataState['info']) => void;
  resetToDemo: () => void;
}

export const useEventData = create<EventDataState>()(
  persist(
    (set) => ({
      source: 'demo',
      events: EVENTS,
      load: (events, fileName, source, info) => set({ source, events, fileName, info, importedAt: source === 'import' ? Date.now() : undefined }),
      resetToDemo: () => set({ source: 'demo', events: EVENTS, fileName: undefined, importedAt: undefined, info: undefined }),
    }),
    {
      name: 'mon-saint-roch-evenements-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => (s.source === 'import' ? { source: s.source, events: s.events, fileName: s.fileName, importedAt: s.importedAt, info: s.info } : {}),
    },
  ),
);
