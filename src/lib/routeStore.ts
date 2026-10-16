import { create } from 'zustand';
import type { RouteKind, RouteResult } from './routing';
import type { LngLat } from './geo';

interface RouteState {
  routes: RouteResult[];
  selected: RouteKind | null;
  loading: boolean;
  navPos: LngLat | null;
  navProgress: number;
  set: (p: Partial<Omit<RouteState, 'set'>>) => void;
}

export const useRoutes = create<RouteState>()((set) => ({
  routes: [],
  selected: null,
  loading: false,
  navPos: null,
  navProgress: 0,
  set: (p) => set(p),
}));
