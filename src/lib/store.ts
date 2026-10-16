import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AppEvent } from '../data/events';
import type { Annonce, ChatMessage, Group, Proposal, Report, ReportStatus } from '../data/community';
import type { LngLat } from './geo';
import { daylight } from './sun';

export type Profile = 'citoyen' | 'entreprise' | 'ville';
export type ThemePref = 'auto' | 'jour' | 'nuit';

/* ---------- Données persistées (localStorage) ---------- */
interface Persisted {
  profile: Profile | null;
  theme: ThemePref;
  favorites: string[];
  going: string[];
  userEvents: AppEvent[];
  joined: string[];
  userGroups: Group[];
  groupMessages: Record<string, ChatMessage[]>;
  userReports: Report[];
  reportStatus: Record<string, ReportStatus>;
  reportVotes: string[];
  userAnnonces: Annonce[];
  userProposals: Proposal[];
  extraChat: Record<string, ChatMessage[]>;
  proposalStatus: Record<string, Proposal['status']>;
  placeRatings: Record<string, number>;
  favoritePlaces: string[];
  onboarded: boolean;
}

interface PersistedActions {
  setProfile: (p: Profile | null) => void;
  setTheme: (t: ThemePref) => void;
  toggleFavorite: (id: string) => void;
  toggleGoing: (id: string) => void;
  addEvent: (e: AppEvent) => void;
  toggleJoin: (id: string) => void;
  createGroup: (g: Group) => void;
  sendGroupMessage: (groupId: string, m: ChatMessage) => void;
  addReport: (r: Report) => void;
  setReportStatus: (id: string, s: ReportStatus) => void;
  voteReport: (id: string) => void;
  deleteReport: (id: string) => void;
  addAnnonce: (a: Annonce) => void;
  addProposal: (p: Proposal) => void;
  sendProposalMessage: (proposalId: string, m: ChatMessage) => void;
  setProposalStatus: (id: string, s: Proposal['status']) => void;
  ratePlace: (id: string, v: number) => void;
  toggleFavoritePlace: (id: string) => void;
  setOnboarded: () => void;
  resetAll: () => void;
}

const initial: Persisted = {
  profile: null,
  theme: 'auto',
  favorites: [],
  going: [],
  userEvents: [],
  joined: [],
  userGroups: [],
  groupMessages: {},
  userReports: [],
  reportStatus: {},
  reportVotes: [],
  userAnnonces: [],
  userProposals: [],
  extraChat: {},
  proposalStatus: {},
  placeRatings: {},
  favoritePlaces: [],
  onboarded: false,
};

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

export const useApp = create<Persisted & PersistedActions>()(
  persist(
    (set) => ({
      ...initial,
      setProfile: (profile) => set({ profile }),
      setTheme: (theme) => set({ theme }),
      toggleFavorite: (id) => set((s) => ({ favorites: toggle(s.favorites, id) })),
      toggleGoing: (id) => set((s) => ({ going: toggle(s.going, id) })),
      addEvent: (e) => set((s) => ({ userEvents: [e, ...s.userEvents] })),
      toggleJoin: (id) => set((s) => ({ joined: toggle(s.joined, id) })),
      createGroup: (g) => set((s) => ({ userGroups: [g, ...s.userGroups], joined: [...s.joined, g.id] })),
      sendGroupMessage: (groupId, m) => set((s) => ({ groupMessages: { ...s.groupMessages, [groupId]: [...(s.groupMessages[groupId] ?? []), m] } })),
      addReport: (r) => set((s) => ({ userReports: [r, ...s.userReports] })),
      setReportStatus: (id, st) => set((s) => ({ reportStatus: { ...s.reportStatus, [id]: st } })),
      voteReport: (id) => set((s) => ({ reportVotes: toggle(s.reportVotes, id) })),
      deleteReport: (id) => set((s) => ({ userReports: s.userReports.filter((r) => r.id !== id) })),
      addAnnonce: (a) => set((s) => ({ userAnnonces: [a, ...s.userAnnonces] })),
      addProposal: (p) => set((s) => ({ userProposals: [p, ...s.userProposals] })),
      sendProposalMessage: (pid, m) => set((s) => ({ extraChat: { ...s.extraChat, [pid]: [...(s.extraChat[pid] ?? []), m] } })),
      setProposalStatus: (id, st) => set((s) => ({ proposalStatus: { ...s.proposalStatus, [id]: st } })),
      ratePlace: (id, v) => set((s) => ({ placeRatings: { ...s.placeRatings, [id]: v } })),
      toggleFavoritePlace: (id) => set((s) => ({ favoritePlaces: toggle(s.favoritePlaces, id) })),
      setOnboarded: () => set({ onboarded: true }),
      resetAll: () => set({ ...initial }),
    }),
    {
      name: 'mon-saint-roch-v1',
      // Un profil qui n'existe plus (ex. « touriste ») renvoie à l'écran de choix du profil
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Persisted>;
        return { ...current, ...p, profile: p.profile && ['citoyen', 'entreprise', 'ville'].includes(p.profile) ? p.profile : null };
      },
      storage: createJSONStorage(() => {
        try {
          const k = '__t';
          localStorage.setItem(k, '1');
          localStorage.removeItem(k);
          return localStorage;
        } catch {
          const mem = new Map<string, string>();
          return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: (k) => void mem.delete(k) };
        }
      }),
    },
  ),
);

/* ---------- État d'interface (non persisté) ---------- */
export type Tab = 'carte' | 'trajets' | 'parking' | 'evenements' | 'groupes' | 'annuaire' | 'collabs' | 'signaler' | 'admin';
export type Selection =
  | { type: 'place'; id: string }
  | { type: 'parking'; id: string }
  | { type: 'event'; id: string }
  | { type: 'report'; id: string }
  | { type: 'stop'; id: string }
  | null;

export interface RoutePoint { ll: LngLat; label: string }
export type Overlay =
  | { kind: 'event'; id: string }
  | { kind: 'group'; id: string }
  | { kind: 'annonce'; id: string }
  | { kind: 'chat'; proposalId: string }
  | { kind: 'publish-event' }
  | { kind: 'new-annonce' }
  | { kind: 'propose'; annonceId: string }
  | { kind: 'menu' }
  | { kind: 'place'; id: string };

export interface Layers { parkings: boolean; events: boolean; places: boolean; reports: boolean; lighting: boolean; stops: boolean }

interface UIState {
  tab: Tab;
  selection: Selection;
  overlays: Overlay[];
  from: RoutePoint | null;
  to: RoutePoint | null;
  travelMode: 'foot' | 'car';
  picking: 'from' | 'to' | null;
  layers: Layers;
  fly: { ll: LngLat; zoom?: number; t: number } | null;
  fit: { coords: LngLat[]; t: number } | null;
  toast: { text: string; icon?: string; t: number } | null;
  reportPick: boolean;
  reportPoint: LngLat | null;
  navActive: boolean;
  parkingFocus: LngLat | null;
  mapCenter: LngLat | null;
  pitch3d: boolean;
  setTab: (t: Tab) => void;
  select: (s: Selection) => void;
  pushOverlay: (o: Overlay) => void;
  popOverlay: () => void;
  clearOverlays: () => void;
  setFrom: (p: RoutePoint | null) => void;
  setTo: (p: RoutePoint | null) => void;
  setTravelMode: (m: 'foot' | 'car') => void;
  setPicking: (p: 'from' | 'to' | null) => void;
  toggleLayer: (k: keyof Layers) => void;
  flyTo: (ll: LngLat, zoom?: number) => void;
  fitTo: (coords: LngLat[]) => void;
  showToast: (text: string, icon?: string) => void;
  setReportPick: (v: boolean) => void;
  setReportPoint: (p: LngLat | null) => void;
  setNav: (v: boolean) => void;
  setParkingFocus: (p: LngLat | null) => void;
  setMapCenter: (p: LngLat) => void;
  setPitch3d: (v: boolean) => void;
}

export const useUI = create<UIState>()((set) => ({
  tab: 'carte',
  selection: null,
  overlays: [],
  from: null,
  to: null,
  travelMode: 'foot',
  picking: null,
  layers: { parkings: true, events: true, places: true, reports: false, lighting: false, stops: true },
  fly: null,
  fit: null,
  toast: null,
  reportPick: false,
  reportPoint: null,
  navActive: false,
  parkingFocus: null,
  mapCenter: null,
  pitch3d: true,
  setTab: (tab) => set({ tab, selection: null, picking: null, reportPick: false }),
  select: (selection) => set({ selection }),
  pushOverlay: (o) => set((s) => ({ overlays: [...s.overlays, o] })),
  popOverlay: () => set((s) => ({ overlays: s.overlays.slice(0, -1) })),
  clearOverlays: () => set({ overlays: [] }),
  setFrom: (from) => set({ from }),
  setTo: (to) => set({ to }),
  setTravelMode: (travelMode) => set({ travelMode }),
  setPicking: (picking) => set({ picking }),
  toggleLayer: (k) => set((s) => ({ layers: { ...s.layers, [k]: !s.layers[k] } })),
  flyTo: (ll, zoom) => set({ fly: { ll, zoom, t: Date.now() } }),
  fitTo: (coords) => set({ fit: { coords, t: Date.now() } }),
  showToast: (text, icon) => set({ toast: { text, icon, t: Date.now() } }),
  setReportPick: (reportPick) => set({ reportPick }),
  setReportPoint: (reportPoint) => set({ reportPoint }),
  setNav: (navActive) => set({ navActive }),
  setParkingFocus: (parkingFocus) => set({ parkingFocus }),
  setMapCenter: (mapCenter) => set({ mapCenter }),
  setPitch3d: (pitch3d) => set({ pitch3d }),
}));

export function isNight(pref: ThemePref): boolean {
  if (pref === 'jour') return false;
  if (pref === 'nuit') return true;
  // Auto : nuit quand le soleil est sous l'horizon (suit les saisons à Québec)
  return daylight(new Date()) < 0.5;
}
