import { GRAPH, GEdge } from '../data/streets';
import { REPORT_META, Report, isActiveReport } from '../data/community';
import type { Place } from '../data/places';
import type { AppEvent } from '../data/events';
import { LngLat, dist, projectOnSegment, sampleLine } from './geo';
import { realLightAt } from './lighting';
import { useStops } from './stopsData';
import { usePolice } from './policeData';
import { daylight, quebecHour } from './sun';

/**
 * Score de sécurité d'un trajet (indicatif)
 * ----------------------------------------
 * Chaque point du trajet (tous les 10 m) reçoit un score s entre 0 et 1 :
 *   s = 0,65·L + 0,25·N + 0,10·A + V + B
 *   L lumière    = J + (1 − J)·E   (J : lumière du jour selon le soleil, E : lampadaires)
 *   N animation  = rue, commerces ouverts à cette heure, événements en cours
 *   A aide       = poste de police ou lieu refuge ouvert le plus proche
 *   V type de voie (ruelle −0,10, rue principale +0,05) · B arrêt d'autobus (+0,05)
 * Score du trajet = 100 × (0,7·moyenne + 0,3·moyenne des 10 % pires points) − pénalités des alertes (≤ 45).
 * Une alerte de sécurité baisse le score sans jamais bloquer une rue ; l'infrastructure ne compte pas,
 * sauf le lampadaire défectueux (via l'éclairage).
 */

export const SAFETY = {
  wLight: 0.65,
  wActivity: 0.25,
  wHelp: 0.1,
  alley: -0.1,
  mainStreet: 0.05,
  busStop: 0.05,
  worstShare: 0.3,
  worstFraction: 0.1,
  maxPenalty: 45,
  policeRange: 600, // m
  refugeRange: 150, // m
  refugeWeight: 0.7,
} as const;

/* ---------- Horaires types des lieux (le registre ne donne pas d'horaires) ---------- */
type Kind = 'bar' | 'restaurant' | 'cafe' | 'depanneur' | 'depanneur24' | 'pharmacie' | 'commerce' | 'bureau' | 'culture' | 'hotel' | 'transport' | 'loisirs' | 'parc' | 'organisme';
/** Plages [début, fin, animation 0..1] ; une fin > 24 déborde après minuit. refuge = lieu où demander de l'aide quand il est ouvert. */
const PROFILES: Record<Kind, { slots: [number, number, number][]; refuge: boolean }> = {
  bar: { slots: [[11, 17, 0.4], [17, 27, 1]], refuge: true },
  restaurant: { slots: [[7, 11, 0.3], [11, 14, 0.9], [14, 17, 0.4], [17, 22, 0.9], [22, 23.5, 0.5]], refuge: true },
  cafe: { slots: [[7, 18, 0.7]], refuge: true },
  depanneur: { slots: [[7, 23, 0.6]], refuge: true },
  depanneur24: { slots: [[0, 24, 0.6]], refuge: true },
  pharmacie: { slots: [[8, 22, 0.5]], refuge: true },
  commerce: { slots: [[10, 18, 0.6], [18, 21, 0.3]], refuge: false },
  bureau: { slots: [[8, 17, 0.5]], refuge: false },
  culture: { slots: [[10, 17, 0.5], [17, 22, 0.7]], refuge: false },
  hotel: { slots: [[0, 24, 0.3]], refuge: true },
  transport: { slots: [[5, 24, 0.7]], refuge: true },
  loisirs: { slots: [[6, 22, 0.5]], refuge: false },
  parc: { slots: [[7, 21, 0.3]], refuge: false },
  organisme: { slots: [[9, 17, 0.4]], refuge: false },
};

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function placeKind(p: Place): Kind {
  const n = norm(p.name);
  if (/couche-tard|couche tard/.test(n)) return 'depanneur24';
  if (/\bbar\b|\bpub\b|brasserie|taverne|lounge|cabaret|boite de nuit/.test(n)) return 'bar';
  if (/pharm|familiprix|jean coutu|uniprix|proxim/.test(n)) return 'pharmacie';
  if (/depanneur|epicerie|alimentation|marche\b|provigo|\bmetro\b|\biga\b/.test(n)) return 'depanneur';
  switch (p.category) {
    case 'restaurant': return 'restaurant';
    case 'cafe': return 'cafe';
    case 'culture': return 'culture';
    case 'hotel': return 'hotel';
    case 'transport': return 'transport';
    case 'loisirs': return 'loisirs';
    case 'parc': return 'parc';
    case 'techno':
    case 'services': return 'bureau';
    case 'institution':
    case 'organisme': return 'organisme';
    default: return 'commerce';
  }
}

function levelAt(kind: Kind, hour: number): number {
  let v = 0;
  for (const [a, b, l] of PROFILES[kind].slots) if ((hour >= a && hour < b) || (hour + 24 >= a && hour + 24 < b)) v = Math.max(v, l);
  return v;
}

/** Animation de base d'une rue selon l'heure (la valeur de la rue est celle du milieu de journée). */
function streetHourFactor(h: number): number {
  if (h >= 7 && h < 19) return 1;
  if (h >= 19 && h < 23) return 0.7;
  if (h >= 23 || h < 2) return 0.45;
  if (h >= 2 && h < 6) return 0.15;
  return 0.5; // 6 h – 7 h
}

/* ---------- Contexte d'évaluation (heure, données) ---------- */
interface PlaceEntry { ll: LngLat; level: number; refuge: boolean; name: string }
interface Alert { r: Report; label: string; factor: number; radius: number }

export interface SafetyContext {
  when: Date;
  hour: number;
  J: number;
  grid: Map<string, PlaceEntry[]>;
  events: AppEvent[];
  alerts: Alert[];
  darkeners: Report[];
  edgeCache: Map<string, { s: number; pen: number }>;
}

const CELL = 0.001; // ≈ 75 m × 110 m
const cellKey = (x: number, y: number) => `${Math.floor(x / CELL)}:${Math.floor(y / CELL)}`;

/** Poids d'une alerte de sécurité à l'heure donnée : gravité × fraîcheur × confiance (sans la distance). */
function alertFactor(r: Report, when: Date): number {
  const m = REPORT_META[r.category];
  if (!m || m.group !== 'securite' || m.gravity <= 0 || r.status === 'resolu') return 0;
  const ageH = Math.max(0, (when.getTime() - new Date(r.createdAt).getTime()) / 3600e3);
  const fresh = m.halfLife ? Math.pow(0.5, ageH / m.halfLife) : 1;
  const conf = Math.min(1.5, 1 + 0.15 * Math.log2(1 + Math.max(0, r.votes)));
  return m.gravity * fresh * conf;
}

/** 1 dans la moitié du rayon, puis baisse linéaire jusqu'à 0 au bord. */
function proximity(d: number, radius: number): number {
  if (d <= radius / 2) return 1;
  if (d >= radius) return 0;
  return (radius - d) / (radius / 2);
}

export function makeSafetyContext(opts: { when: Date; reports: Report[]; places: Place[]; events: AppEvent[] }): SafetyContext {
  const { when, reports, places, events } = opts;
  const hour = quebecHour(when);
  const grid = new Map<string, PlaceEntry[]>();
  for (const p of places) {
    if (p.registry && !p.located) continue;
    const kind = placeKind(p);
    const level = levelAt(kind, hour);
    const refuge = PROFILES[kind].refuge && level > 0;
    if (level <= 0 && !refuge) continue;
    const k = cellKey(p.ll[0], p.ll[1]);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k)!.push({ ll: p.ll, level, refuge, name: p.name });
  }
  const active = reports.filter((r) => isActiveReport(r, when.getTime()));
  const alerts = active
    .map((r) => ({ r, label: REPORT_META[r.category]?.label ?? r.category, factor: alertFactor(r, when), radius: REPORT_META[r.category]?.radius ?? 50 }))
    .filter((a) => a.factor > 0.05);
  return {
    when,
    hour,
    J: daylight(when),
    grid,
    events: events.filter((e) => new Date(e.start) <= when && new Date(e.end) >= when),
    alerts,
    darkeners: active.filter((r) => REPORT_META[r.category]?.darkens),
    edgeCache: new Map(),
  };
}

function nearbyPlaces(ctx: SafetyContext, p: LngLat, cells = 2): PlaceEntry[] {
  const cx = Math.floor(p[0] / CELL);
  const cy = Math.floor(p[1] / CELL);
  const out: PlaceEntry[] = [];
  for (let dx = -cells; dx <= cells; dx++) for (let dy = -cells; dy <= cells; dy++) out.push(...(ctx.grid.get(`${cx + dx}:${cy + dy}`) ?? []));
  return out;
}

export function nearestGraphEdge(p: LngLat): { edge: GEdge; d: number } {
  let best = GRAPH.edges[0];
  let bd = Infinity;
  for (const e of GRAPH.edges) {
    const d = projectOnSegment(p, e.coords[0], e.coords[1]).d + (e.kind === 'ruelle' ? 8 : 0);
    if (d < bd) { bd = d; best = e; }
  }
  return { edge: best, d: bd };
}

export interface PointSafety { s: number; L: number; E: number; N: number; A: number; V: number; B: number; help: { name: string; d: number } }

/** Score de sécurité d'un point (0..1) et ses composantes. */
export function pointSafety(p: LngLat, ctx: SafetyContext, edgeHint?: GEdge): PointSafety {
  const near = edgeHint ? { edge: edgeHint, d: 0 } : nearestGraphEdge(p);
  const edge = near.d < 70 ? near.edge : null;

  // L : lumière (jour + lampadaires)
  let E = realLightAt(p) ?? edge?.light ?? 0.4;
  for (const r of ctx.darkeners) if (dist(r.ll, p) < REPORT_META[r.category].radius) E -= 0.28;
  E = Math.max(0, Math.min(1, E));
  const L = ctx.J + (1 - ctx.J) * E;

  // N : animation (rue, commerces ouverts, événements en cours)
  const base = (edge?.activity ?? 0.3) * streetHourFactor(ctx.hour);
  let com = 0;
  let refugeBest: { name: string; d: number } | null = null;
  for (const q of nearbyPlaces(ctx, p)) {
    const d = dist(q.ll, p);
    if (q.level > 0 && d < 90) com += q.level * Math.exp(-(d * d) / (2 * 35 * 35));
    if (q.refuge && (!refugeBest || d < refugeBest.d)) refugeBest = { name: q.name, d };
  }
  const nCom = 1 - Math.exp(-com / 1.5);
  let nEvt = 0;
  for (const e of ctx.events) {
    const d = dist(e.ll, p);
    if (d < 200) nEvt = Math.max(nEvt, 0.9 * Math.exp(-d / 80));
  }
  const N = 1 - (1 - 0.6 * base) * (1 - nCom) * (1 - nEvt);

  // A : aide la plus proche (police 24/7, lieux refuges ouverts)
  let A = 0;
  let help = { name: '', d: Infinity };
  for (const st of usePolice.getState().stations) {
    const d = dist(st.ll, p);
    const a = Math.exp(-d / SAFETY.policeRange);
    if (a > A) A = a;
    if (d < help.d) help = { name: st.name, d };
  }
  if (refugeBest) {
    A = Math.max(A, SAFETY.refugeWeight * Math.exp(-refugeBest.d / SAFETY.refugeRange));
    if (refugeBest.d < help.d) help = refugeBest;
  }

  // V : type de voie
  const V = edge?.kind === 'ruelle' ? SAFETY.alley : edge && (edge.kind === 'boulevard' || edge.kind === 'commerciale') ? SAFETY.mainStreet : 0;

  // B : arrêt d'autobus du RTC à proximité
  let dStop = Infinity;
  for (const st of useStops.getState().stops) {
    if (Math.abs(st.ll[1] - p[1]) > 0.001) continue;
    dStop = Math.min(dStop, dist(st.ll, p));
  }
  const B = SAFETY.busStop * Math.max(0, Math.min(1, (60 - dStop) / 30));

  const s = Math.max(0, Math.min(1, SAFETY.wLight * L + SAFETY.wActivity * N + SAFETY.wHelp * A + V + B));
  return { s, L, E, N, A, V, B, help };
}

/** Score moyen et pénalité d'alertes d'un tronçon du graphe (pour le calcul d'itinéraire). */
export function edgeSafety(e: GEdge, ctx: SafetyContext): { s: number; pen: number } {
  const cached = ctx.edgeCache.get(e.id);
  if (cached) return cached;
  const pts = sampleLine(e.coords, 15);
  const s = pts.reduce((a, p) => a + pointSafety(p, ctx, e).s, 0) / pts.length;
  let pen = 0;
  for (const a of ctx.alerts) {
    const m = Math.max(...pts.map((p) => proximity(dist(a.r.ll, p), a.radius)), proximity(projectOnSegment(a.r.ll, e.coords[0], e.coords[1]).d, a.radius));
    pen += a.factor * m;
  }
  const out = { s, pen };
  ctx.edgeCache.set(e.id, out);
  return out;
}

export interface SafetyMetrics {
  /** Score de sécurité 0..100 */
  score: number;
  /** Lumière moyenne (jour + lampadaires) 0..100 */
  light: number;
  /** Animation moyenne 0..100 */
  activity: number;
  /** Aide la plus éloignée le long du trajet (pire moment) */
  help: { name: string; d: number };
  /** Alertes de sécurité croisées (points retirés inclus) */
  alerts: { id: string; category: Report['category']; label: string; createdAt: string; description: string; votes: number; penalty: number }[];
  penalty: number;
}

/** Évaluation complète d'un tracé. */
export function evaluateRoute(coords: LngLat[], ctx: SafetyContext): { metrics: SafetyMetrics; profile: number[] } {
  const samples = sampleLine(coords, 10);
  const pts = samples.map((p) => pointSafety(p, ctx));
  const n = Math.max(1, pts.length);
  const mean = pts.reduce((a, x) => a + x.s, 0) / n;
  const sorted = pts.map((x) => x.s).sort((a, b) => a - b);
  const k = Math.max(1, Math.round(n * SAFETY.worstFraction));
  const worst = sorted.slice(0, k).reduce((a, b) => a + b, 0) / k;
  const base = (1 - SAFETY.worstShare) * mean + SAFETY.worstShare * worst;

  const alerts: SafetyMetrics['alerts'] = [];
  for (const a of ctx.alerts) {
    let m = 0;
    for (const p of samples) m = Math.max(m, proximity(dist(a.r.ll, p), a.radius));
    if (m > 0) alerts.push({ id: a.r.id, category: a.r.category, label: a.label, createdAt: a.r.createdAt, description: a.r.description, votes: a.r.votes, penalty: a.factor * m });
  }
  const penalty = Math.min(SAFETY.maxPenalty, alerts.reduce((s, a) => s + a.penalty, 0));
  const score = Math.round(Math.max(0, Math.min(100, 100 * base - penalty)));

  let help = { name: '', d: 0 };
  for (const x of pts) if (x.help.d > help.d) help = x.help;

  // Profil de sécurité compressé à ~40 valeurs
  const bins = 40;
  const profile: number[] = [];
  for (let i = 0; i < bins; i++) {
    const a = Math.floor((i / bins) * pts.length);
    const b = Math.max(a + 1, Math.floor(((i + 1) / bins) * pts.length));
    const slice = pts.slice(a, b);
    profile.push(slice.reduce((x, y) => x + y.s, 0) / (slice.length || 1));
  }
  return {
    metrics: {
      score,
      light: Math.round((pts.reduce((a, x) => a + x.L, 0) / n) * 100),
      activity: Math.round((pts.reduce((a, x) => a + x.N, 0) / n) * 100),
      help,
      alerts: alerts.sort((a, b) => b.penalty - a.penalty),
      penalty: Math.round(penalty),
    },
    profile,
  };
}
