import { GRAPH, GEdge } from '../data/streets';
import type { Report } from '../data/community';
import type { Place } from '../data/places';
import type { AppEvent } from '../data/events';
import { LngLat, bearing, dist, lineLength, projectOnSegment, sampleLine } from './geo';
import { SafetyContext, SafetyMetrics, edgeSafety, evaluateRoute, makeSafetyContext } from './safety';

/**
 * Moteur d'itinéraires de Notre Saint-Roch
 * ---------------------------------------
 * 1. Le plus rapide : le chemin le plus court (OSRM / OpenStreetMap si joignable, sinon Dijkstra sur la distance).
 * 2. Le plus sûr : Dijkstra où chaque tronçon coûte longueur × (1 + 3·(1 − s)) + pénalités d'alertes,
 *    s étant le score de sécurité du tronçon (voir safety.ts) ; la géométrie réelle OSRM est ensuite
 *    demandée en passant par les points du corridor.
 * 3. Chaque tracé est évalué avec le même score de sécurité (safety.ts).
 * Le score est INDICATIF : aucun trajet n'est présenté comme garanti sécuritaire.
 */

export type RouteKind = 'fast' | 'safe';
export interface Step { text: string; distance: number; street: string; icon: 'straight' | 'left' | 'right' | 'start' | 'arrive' | 'slight-left' | 'slight-right' | 'uturn' }
export type RouteMetrics = SafetyMetrics;
export interface RouteResult {
  id: RouteKind;
  label: string;
  color: string;
  coords: LngLat[];
  distance: number;
  duration: number;
  metrics: RouteMetrics;
  profile: number[]; // score de sécurité le long du tracé (pour la barre)
  steps: Step[];
  source: 'osrm' | 'local';
  merged?: RouteKind[];
}

export const ROUTE_META: Record<RouteKind, { label: string; color: string; short: string }> = {
  fast: { label: 'Le plus rapide', color: '#3B82F6', short: 'Rapide' },
  safe: { label: 'Le plus sûr', color: '#10B981', short: 'Plus sûr' },
};

const WALK_SPEED = 1.3; // m/s ≈ 4,7 km/h
const CAR_SPEED = 7.5; // m/s en ville

/* ---------------- Graphe et Dijkstra ---------------- */
/** Coût d'un tronçon : distance seule (rapide) ou distance pondérée par le score de sécurité (sûr). */
type CostFn = (e: GEdge, len: number) => number;
const fastCost: CostFn = (_e, len) => len;
const safeCost = (ctx: SafetyContext): CostFn => (e, len) => {
  const x = edgeSafety(e, ctx);
  // 1 point de pénalité d'alerte ≈ 30 m de détour accepté
  return len * (1 + 3 * (1 - x.s)) + x.pen * 30 * Math.min(1, len / 40 + 0.3);
};

function nearestEdge(p: LngLat, car = false) {
  let best = { edge: GRAPH.edges[0], t: 0, d: Infinity, point: p as LngLat };
  for (const e of GRAPH.edges) {
    if (car && e.kind === 'ruelle') continue;
    const r = projectOnSegment(p, e.coords[0], e.coords[1]);
    if (r.d < best.d) best = { edge: e, t: r.t, d: r.d, point: r.point };
  }
  return best;
}

interface Arc { to: number; edge: GEdge; len: number; coords: LngLat[] }

function localPath(from: LngLat, to: LngLat, cost: CostFn, car = false) {

  const adj = new Map<number, Arc[]>();
  const add = (a: number, arc: Arc) => { if (!adj.has(a)) adj.set(a, []); adj.get(a)!.push(arc); };
  for (const e of GRAPH.edges) {
    if (car && e.kind === 'ruelle') continue;
    add(e.a, { to: e.b, edge: e, len: e.length, coords: e.coords });
    add(e.b, { to: e.a, edge: e, len: e.length, coords: [e.coords[1], e.coords[0]] });
  }
  const S = -1, T = -2;
  const sn = nearestEdge(from, car);
  const tn = nearestEdge(to, car);
  const link = (id: number, snap: typeof sn, reverse: boolean) => {
    const { edge, point, t } = snap;
    const A = edge.coords[0], B = edge.coords[1];
    const arcs: [number, LngLat[], number][] = [
      [edge.a, [point, A], edge.length * t],
      [edge.b, [point, B], edge.length * (1 - t)],
    ];
    for (const [node, c, len] of arcs) {
      if (!reverse) add(id, { to: node, edge, len, coords: c });
      else add(node, { to: id, edge, len, coords: [c[1], c[0]] });
    }
  };
  link(S, sn, false);
  link(T, tn, true);
  if (sn.edge.id === tn.edge.id) add(S, { to: T, edge: sn.edge, len: dist(sn.point, tn.point), coords: [sn.point, tn.point] });

  const distMap = new Map<number, number>([[S, 0]]);
  const prev = new Map<number, { from: number; arc: Arc }>();
  const visited = new Set<number>();
  // file de priorité simple (graphe de petite taille)
  const queue: number[] = [S];
  while (queue.length) {
    queue.sort((a, b) => (distMap.get(a) ?? Infinity) - (distMap.get(b) ?? Infinity));
    const u = queue.shift()!;
    if (visited.has(u)) continue;
    visited.add(u);
    if (u === T) break;
    for (const arc of adj.get(u) ?? []) {
      const nd = (distMap.get(u) ?? Infinity) + cost(arc.edge, arc.len);
      if (nd < (distMap.get(arc.to) ?? Infinity)) {
        distMap.set(arc.to, nd);
        prev.set(arc.to, { from: u, arc });
        queue.push(arc.to);
      }
    }
  }
  const arcs: Arc[] = [];
  let cur = T;
  while (cur !== S) {
    const p = prev.get(cur);
    if (!p) break;
    arcs.unshift(p.arc);
    cur = p.from;
  }
  const coords: LngLat[] = [from, sn.point];
  for (const a of arcs) coords.push(a.coords[1]);
  coords.push(to);
  const nodes = arcs.map((a) => a.to).filter((n) => n >= 0);
  return { coords: dedupe(coords), arcs, nodes };
}

function dedupe(c: LngLat[]) {
  return c.filter((p, i) => i === 0 || dist(p, c[i - 1]) > 0.5);
}

/* ---------------- Instructions ---------------- */
function turnIcon(diff: number): Step['icon'] {
  const a = Math.abs(diff);
  if (a < 25) return 'straight';
  if (a > 160) return 'uturn';
  if (a < 55) return diff > 0 ? 'slight-right' : 'slight-left';
  return diff > 0 ? 'right' : 'left';
}
const TURN_TEXT: Record<Step['icon'], string> = {
  straight: 'Continuez tout droit',
  left: 'Tournez à gauche',
  right: 'Tournez à droite',
  'slight-left': 'Serrez à gauche',
  'slight-right': 'Serrez à droite',
  uturn: 'Faites demi-tour',
  start: 'Départ',
  arrive: 'Arrivée',
};

function localSteps(arcs: Arc[], destLabel: string): Step[] {
  const groups: { street: string; coords: LngLat[]; len: number }[] = [];
  for (const a of arcs) {
    const last = groups[groups.length - 1];
    if (last && last.street === a.edge.street) { last.coords.push(a.coords[1]); last.len += a.len; }
    else groups.push({ street: a.edge.street, coords: [...a.coords], len: a.len });
  }
  const steps: Step[] = [];
  groups.forEach((g, i) => {
    if (g.len < 4 && i > 0 && i < groups.length - 1) return;
    if (i === 0) steps.push({ text: `Partez sur ${g.street}`, distance: g.len, street: g.street, icon: 'start' });
    else {
      const prevG = groups[i - 1];
      const b1 = bearing(prevG.coords[Math.max(0, prevG.coords.length - 2)], prevG.coords[prevG.coords.length - 1]);
      const b2 = bearing(g.coords[0], g.coords[Math.min(1, g.coords.length - 1)]);
      const diff = ((b2 - b1 + 540) % 360) - 180;
      const icon = turnIcon(diff);
      steps.push({ text: `${TURN_TEXT[icon]} sur ${g.street}`, distance: g.len, street: g.street, icon });
    }
  });
  steps.push({ text: `Vous êtes arrivé·e : ${destLabel}`, distance: 0, street: '', icon: 'arrive' });
  return steps;
}

const MOD: Record<string, Step['icon']> = {
  left: 'left', right: 'right', 'slight left': 'slight-left', 'slight right': 'slight-right',
  'sharp left': 'left', 'sharp right': 'right', straight: 'straight', uturn: 'uturn',
};

/* ---------------- OSRM (OpenStreetMap) ---------------- */
interface OsrmRoute { geometry: { coordinates: LngLat[] }; distance: number; duration: number; legs: { steps: { name: string; distance: number; maneuver: { type: string; modifier?: string } }[] }[] }

let osrmDown = 0;
async function osrm(mode: 'foot' | 'car', pts: LngLat[], alternatives = false): Promise<OsrmRoute[] | null> {
  if (Date.now() - osrmDown < 60_000) return null; // évite de réessayer en boucle hors-ligne
  const base = mode === 'foot' ? 'https://routing.openstreetmap.de/routed-foot' : 'https://routing.openstreetmap.de/routed-car';
  const coords = pts.map((p) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`).join(';');
  const url = `${base}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true&alternatives=${alternatives}`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 4500);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error(String(res.status));
    const json = await res.json();
    if (json.code !== 'Ok') return null;
    return json.routes as OsrmRoute[];
  } catch {
    osrmDown = Date.now();
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function osrmSteps(r: OsrmRoute, destLabel: string): Step[] {
  const out: Step[] = [];
  for (const leg of r.legs) {
    for (const s of leg.steps) {
      const name = s.name || 'le chemin';
      const t = s.maneuver.type;
      if (t === 'arrive' || t === 'waypoint') continue;
      if (t === 'depart') { out.push({ text: `Partez sur ${name}`, distance: s.distance, street: name, icon: 'start' }); continue; }
      const icon = MOD[s.maneuver.modifier ?? 'straight'] ?? 'straight';
      const last = out[out.length - 1];
      if (icon === 'straight' && last && last.street === name) { last.distance += s.distance; continue; }
      out.push({ text: `${TURN_TEXT[icon]} sur ${name}`, distance: s.distance, street: name, icon });
    }
  }
  out.push({ text: `Vous êtes arrivé·e : ${destLabel}`, distance: 0, street: '', icon: 'arrive' });
  return out;
}

function similarity(a: LngLat[], b: LngLat[]) {
  const s = sampleLine(a, 25);
  const sb = sampleLine(b, 10);
  let close = 0;
  for (const p of s) if (sb.some((q) => dist(p, q) < 18)) close++;
  return close / s.length;
}

function pickVia(nodes: number[], max: number): LngLat[] {
  if (nodes.length === 0) return [];
  const out: LngLat[] = [];
  const k = Math.min(max, nodes.length);
  for (let i = 1; i <= k; i++) {
    const idx = Math.min(nodes.length - 1, Math.round((i * nodes.length) / (k + 1)));
    out.push(GRAPH.nodes[nodes[idx]].ll);
  }
  return out;
}

/* ---------------- API principale ---------------- */
export async function planRoutes(opts: {
  from: LngLat; to: LngLat; toLabel: string; mode: 'foot' | 'car'; when: Date; reports: Report[]; places: Place[]; events: AppEvent[];
}): Promise<RouteResult[]> {
  const { from, to, mode, when, reports, places, events, toLabel } = opts;
  const ctx = makeSafetyContext({ when, reports, places, events });
  // Deux propositions à pied : le plus rapide (comme un GPS) et le plus sûr (notre score)
  const kinds: RouteKind[] = mode === 'car' ? ['fast'] : ['fast', 'safe'];
  const speed = mode === 'car' ? CAR_SPEED : WALK_SPEED;

  const directOsrm = await osrm(mode, [from, to], mode === 'foot');

  const results: RouteResult[] = [];
  for (const kind of kinds) {
    const local = localPath(from, to, kind === 'fast' ? fastCost : safeCost(ctx), mode === 'car');
    let coords = local.coords;
    let distance = lineLength(coords);
    let duration = distance / speed;
    let steps = localSteps(local.arcs, toLabel);
    let source: 'osrm' | 'local' = 'local';

    if (directOsrm) {
      if (kind === 'fast') {
        const r = directOsrm[0];
        coords = r.geometry.coordinates; distance = r.distance; duration = mode === 'car' ? r.duration : r.distance / speed;
        steps = osrmSteps(r, toLabel); source = 'osrm';
      } else {
        // Corridor sûr local → géométrie réelle OSRM via points de passage
        let best: OsrmRoute | null = null;
        for (const nVia of [3, 1]) {
          const via = pickVia(local.nodes, nVia);
          const r = await osrm(mode, [from, ...via, to]);
          if (r && r[0] && r[0].distance < lineLength(local.coords) * 1.35 + 60) { best = r[0]; break; }
        }
        // Les alternatives OSRM sont aussi candidates : on garde la mieux notée (légère pénalité de longueur)
        const candidates: OsrmRoute[] = [...(best ? [best] : []), ...directOsrm.slice(1)];
        if (candidates.length) {
          const scored = candidates.map((c) => ({ c, s: evaluateRoute(c.geometry.coordinates, ctx).metrics.score - c.distance / 120 }));
          scored.sort((a, b) => b.s - a.s);
          const c = scored[0].c;
          coords = c.geometry.coordinates; distance = c.distance; duration = c.distance / speed;
          steps = osrmSteps(c, toLabel); source = 'osrm';
        }
      }
    }
    const { metrics, profile } = evaluateRoute(coords, ctx);
    results.push({ id: kind, label: ROUTE_META[kind].label, color: ROUTE_META[kind].color, coords, distance, duration, metrics, profile, steps, source });
  }

  // Fusion des tracés quasi identiques
  const out: RouteResult[] = [];
  for (const r of results) {
    const twin = out.find((o) => similarity(o.coords, r.coords) > 0.9 && similarity(r.coords, o.coords) > 0.9);
    if (twin) { twin.merged = [...(twin.merged ?? []), r.id]; continue; }
    out.push(r);
  }
  // « Le plus rapide » = le tracé le plus court, « le plus sûr » = le meilleur score.
  // Si c'est le même tracé, une seule proposition est affichée.
  const safe = out.find((r) => r.id === 'safe');
  const fast = out.find((r) => r.id === 'fast');
  if (safe && fast) {
    const shortest = safe.duration < fast.duration - 1 ? safe : fast;
    const safest = safe.metrics.score > fast.metrics.score ? safe : fast;
    if (shortest === safest) {
      const other = shortest === safe ? fast : safe;
      out.splice(out.indexOf(other), 1);
      shortest.id = 'fast';
      shortest.merged = ['safe'];
      Object.assign(shortest, { label: ROUTE_META.fast.label, color: ROUTE_META.safe.color });
    } else {
      for (const [r, k] of [[shortest, 'fast'], [safest, 'safe']] as const) Object.assign(r, { id: k, label: ROUTE_META[k].label, color: ROUTE_META[k].color, merged: undefined });
    }
  }
  // Notre trajet (le plus sûr) est proposé en premier, puis le plus rapide
  const rank = (r: RouteResult) => ([r.id, ...(r.merged ?? [])].includes('safe') ? 0 : 1);
  return out.sort((a, b) => rank(a) - rank(b) || b.metrics.score - a.metrics.score);
}

export function scoreLabel(score: number): { text: string; tone: 'good' | 'mid' | 'low' } {
  if (score >= 75) return { text: 'Bonne sécurité', tone: 'good' };
  if (score >= 55) return { text: 'Sécurité moyenne', tone: 'mid' };
  return { text: 'Prudence', tone: 'low' };
}
