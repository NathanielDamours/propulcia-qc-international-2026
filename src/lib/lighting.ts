import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { GRAPH, LAMPS, Lamp } from '../data/streets';
import { LngLat, sampleLine } from './geo';

/** Éclairage public : indice spatial, application au graphe des rues et store des données. */


/* ---------- Indice spatial et niveau d'éclairage en un point ---------- */
const CELL = 0.0006; // ≈ 50-65 m

export class LampIndex {
  private grid = new Map<string, Lamp[]>();
  constructor(lamps: Lamp[]) {
    for (const l of lamps) {
      if (!l.ok) continue;
      const k = this.key(l.ll[0], l.ll[1]);
      if (!this.grid.has(k)) this.grid.set(k, []);
      this.grid.get(k)!.push(l);
    }
  }
  private key(x: number, y: number) {
    return `${Math.floor(x / CELL)}:${Math.floor(y / CELL)}`;
  }
  /** Éclairage relatif 0..1 : somme gaussienne de l'intensité des luminaires voisins. */
  lightAt(p: LngLat, sigma = 28): number {
    const cx = Math.floor(p[0] / CELL);
    const cy = Math.floor(p[1] / CELL);
    let L = 0;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const l of this.grid.get(`${cx + dx}:${cy + dy}`) ?? []) {
          const ex = (l.ll[0] - p[0]) * 76190;
          const ny = (l.ll[1] - p[1]) * 111132;
          const d2 = ex * ex + ny * ny;
          if (d2 > 3600 * 4) continue;
          L += l.power * Math.exp(-d2 / (sigma * sigma));
        }
      }
    }
    return 1 - Math.exp(-L * 0.9);
  }
}

/* ---------- Application au graphe des rues ---------- */
const BASE_LIGHT = new Map(GRAPH.edges.map((e) => [e.id, e.light]));
let activeIndex: LampIndex | null = null;

export function realLightAt(p: LngLat): number | null {
  return activeIndex ? activeIndex.lightAt(p) : null;
}

function applyToGraph(lamps: Lamp[] | null) {
  if (!lamps) {
    activeIndex = null;
    for (const e of GRAPH.edges) e.light = BASE_LIGHT.get(e.id) ?? e.light;
    return;
  }
  activeIndex = new LampIndex(lamps);
  for (const e of GRAPH.edges) {
    const pts = sampleLine(e.coords, 10);
    // tolérance plus large : la géométrie du réseau local est approximative
    const v = pts.reduce((s, p) => s + activeIndex!.lightAt(p, 40), 0) / pts.length;
    e.light = Math.max(0.05, Math.min(1, v));
  }
}

/* ---------- Store ---------- */
/** demo = lampadaires générés (secours), fichier = public/donnees/eclairage.*, import = fichier importé dans l'app */
export type DataOrigin = 'demo' | 'fichier' | 'import';

interface LightingState {
  source: DataOrigin;
  lamps: Lamp[];
  fileName?: string;
  importedAt?: number;
  version: number;
  load: (lamps: Lamp[], fileName: string, source: DataOrigin) => void;
  resetToDemo: () => void;
}

export const useLighting = create<LightingState>()(
  persist(
    (set) => ({
      source: 'demo',
      lamps: LAMPS,
      version: 0,
      load: (lamps, fileName, source) =>
        set((s) => ({ source, lamps, fileName, importedAt: source === 'import' ? Date.now() : undefined, version: s.version + 1 })),
      resetToDemo: () => set((s) => ({ source: 'demo', lamps: LAMPS, fileName: undefined, importedAt: undefined, version: s.version + 1 })),
    }),
    {
      name: 'mon-saint-roch-eclairage-v2',
      storage: createJSONStorage(() => localStorage),
      // Seul un fichier importé dans l'application est conservé ; les autres sources sont rechargées au démarrage.
      partialize: (s) => (s.source === 'import' ? { source: s.source, lamps: s.lamps, fileName: s.fileName, importedAt: s.importedAt } : {}),
      onRehydrateStorage: () => (state) => {
        if (state) applyToGraph(state.source === 'demo' ? null : state.lamps);
      },
    },
  ),
);

applyToGraph(useLighting.getState().source === 'demo' ? null : useLighting.getState().lamps);
useLighting.subscribe((s, prev) => {
  if (s.lamps !== prev.lamps) applyToGraph(s.source === 'demo' ? null : s.lamps);
});
