import { LngLat, uv, dist, rng, hash } from '../lib/geo';

/**
 * Réseau de rues de Saint-Roch, calé sur les coordonnées réelles des arrêts du RTC (stops.txt)
 * ------------------------------------------------------------------------------------------
 * Repère local (u, v) en mètres : origine à l'intersection Charest Est / de la Couronne,
 * axe u le long du boulevard Charest Est (26,4° au nord de l'est), axe v vers le nord-nord-ouest.
 * Chaque rue est une droite : v = at + slope·u (rues « est-ouest ») ou u = at + slope·v (rues « nord-sud »),
 * ajustée sur les arrêts situés à ses intersections (précision ≈ 20 m).
 * light   : niveau d'éclairage 0..1 de secours (remplacé par le calcul réel si un fichier d'éclairage est chargé)
 * activity: animation / achalandage 0..1 (commerces, terrasses, passage)
 */
export type StreetKind = 'boulevard' | 'commerciale' | 'locale' | 'pietonne' | 'ruelle';
export interface StreetDef {
  id: string;
  name: string;
  kind: StreetKind;
  axis: 'ew' | 'ns';
  at: number; // v à u = 0 (rues est-ouest) ou u à v = 0 (rues nord-sud), en mètres
  slope?: number; // inclinaison par rapport à la trame (0 = parallèle aux axes)
  from: number; // étendue le long de la rue (u pour est-ouest, v pour nord-sud)
  to: number;
  light: number;
  activity: number;
}

export const STREETS: StreetDef[] = [
  // Rues « est-ouest » (parallèles au boulevard Charest)
  { id: 'prince-edouard', name: 'Rue du Prince-Édouard', kind: 'locale', axis: 'ew', at: 360, from: -540, to: 330, light: 0.5, activity: 0.4 },
  { id: 'commissaires', name: 'Rue des Commissaires Est', kind: 'locale', axis: 'ew', at: 285, from: -540, to: 0, light: 0.4, activity: 0.3 },
  { id: 'reine', name: 'Rue de la Reine', kind: 'locale', axis: 'ew', at: 228, from: -540, to: 330, light: 0.46, activity: 0.38 },
  { id: 'st-francois', name: 'Rue Saint-François Est', kind: 'locale', axis: 'ew', at: 135, from: -540, to: 0, light: 0.42, activity: 0.32 },
  { id: 'roi', name: 'Rue du Roi', kind: 'locale', axis: 'ew', at: 135, from: 0, to: 330, light: 0.55, activity: 0.5 },
  { id: 'st-joseph', name: 'Rue Saint-Joseph Est', kind: 'commerciale', axis: 'ew', at: 78, from: -540, to: 420, light: 0.95, activity: 0.95 },
  { id: 'charest', name: 'Boulevard Charest Est', kind: 'boulevard', axis: 'ew', at: 0, from: -560, to: 560, light: 0.86, activity: 0.7 },
  { id: 'st-paul', name: 'Rue Saint-Paul', kind: 'locale', axis: 'ew', at: 121, slope: -0.216, from: 560, to: 1000, light: 0.7, activity: 0.5 },
  { id: 'ste-helene', name: 'Rue De Sainte-Hélène', kind: 'locale', axis: 'ew', at: -58, from: -200, to: 60, light: 0.45, activity: 0.35 },
  { id: 'st-vallier', name: 'Rue Saint-Vallier Est', kind: 'locale', axis: 'ew', at: -123, slope: -0.368, from: -537, to: 300, light: 0.44, activity: 0.45 },

  // Rues « nord-sud »
  { id: 'langelier', name: 'Boulevard Langelier', kind: 'boulevard', axis: 'ns', at: -537, from: -100, to: 470, light: 0.75, activity: 0.5 },
  { id: 'st-anselme', name: 'Rue Saint-Anselme', kind: 'locale', axis: 'ns', at: -455, from: -20, to: 400, light: 0.5, activity: 0.35 },
  { id: 'caron', name: 'Rue Caron', kind: 'locale', axis: 'ns', at: -328, slope: -0.15, from: -60, to: 430, light: 0.62, activity: 0.45 },
  { id: 'dorchester', name: 'Rue Dorchester', kind: 'locale', axis: 'ns', at: -170, slope: -0.16, from: -70, to: 400, light: 0.72, activity: 0.62 },
  { id: 'couronne', name: 'Rue de la Couronne', kind: 'commerciale', axis: 'ns', at: 0, slope: -0.035, from: -150, to: 360, light: 0.86, activity: 0.8 },
  { id: 'parvis', name: 'Rue du Parvis', kind: 'locale', axis: 'ns', at: 125, from: -40, to: 360, light: 0.7, activity: 0.6 },
  { id: 'pont', name: 'Rue du Pont', kind: 'commerciale', axis: 'ns', at: 275, slope: 0.1, from: -150, to: 420, light: 0.78, activity: 0.6 },
  { id: 'st-dominique', name: 'Rue Saint-Dominique', kind: 'locale', axis: 'ns', at: 540, from: -60, to: 200, light: 0.55, activity: 0.4 },
  { id: 'gare', name: 'Rue de la Gare-du-Palais', kind: 'locale', axis: 'ns', at: 975, from: -100, to: 130, light: 0.7, activity: 0.55 },
];

export const STREET_BY_ID = Object.fromEntries(STREETS.map((s) => [s.id, s])) as Record<string, StreetDef>;

/** Point (u, v) d'une rue au paramètre t (u pour une rue est-ouest, v pour une rue nord-sud). */
export function lineAt(s: StreetDef, t: number): [number, number] {
  const k = s.slope ?? 0;
  return s.axis === 'ew' ? [t, s.at + k * t] : [s.at + k * t, t];
}

/** Coordonnées d'un point le long d'une rue, décalé de `offset` mètres sur le côté. */
export function pointOnStreet(s: StreetDef, t: number, offset = 0): LngLat {
  const [u, v] = lineAt(s, t);
  return s.axis === 'ew' ? uv(u, v + offset) : uv(u + offset, v);
}

/** Intersection de deux rues de directions différentes (sans tenir compte de leur étendue). */
function crossLines(a: StreetDef, b: StreetDef): [number, number] | null {
  if (a.axis === b.axis) return null;
  const ew = a.axis === 'ew' ? a : b;
  const ns = a.axis === 'ew' ? b : a;
  const k1 = ew.slope ?? 0, k2 = ns.slope ?? 0;
  const u = (ns.at + k2 * ew.at) / (1 - k1 * k2);
  return [u, ew.at + k1 * u];
}

/** Intersection réelle (dans l'étendue des deux rues), avec une tolérance de quelques mètres. */
export function intersection(a: StreetDef, b: StreetDef, tol = 2): [number, number] | null {
  const p = crossLines(a, b);
  if (!p) return null;
  const inRange = (s: StreetDef) => { const t = s.axis === 'ew' ? p[0] : p[1]; return t >= s.from - tol && t <= s.to + tol; };
  return inRange(a) && inRange(b) ? p : null;
}

export interface GNode { id: number; u: number; v: number; ll: LngLat }
export interface GEdge {
  id: string;
  a: number;
  b: number;
  street: string;
  streetId: string;
  kind: StreetKind;
  light: number;
  activity: number;
  length: number;
  coords: LngLat[];
}

const nodes: GNode[] = [];
const nodeKey = new Map<string, number>();
function nodeAt(u: number, v: number): number {
  const k = `${Math.round(u)}:${Math.round(v)}`;
  const found = nodeKey.get(k);
  if (found !== undefined) return found;
  const id = nodes.length;
  nodes.push({ id, u, v, ll: uv(u, v) });
  nodeKey.set(k, id);
  return id;
}

const edges: GEdge[] = [];

// Zones moins bien éclairées (secours, avant chargement des vraies données d'éclairage)
const DARK_SPOTS: { u: number; v: number; r: number; drop: number }[] = [
  { u: -300, v: 190, r: 110, drop: 0.25 }, // îlots entre Saint-François et de la Reine
  { u: 150, v: -170, r: 120, drop: 0.25 }, // sous la falaise, Saint-Vallier Est
  { u: -480, v: 320, r: 120, drop: 0.2 }, // secteur Saint-Anselme / Commissaires
];

for (const s of STREETS) {
  const cuts = new Map<number, [number, number]>([[s.from, lineAt(s, s.from)], [s.to, lineAt(s, s.to)]]);
  for (const o of STREETS) {
    const p = intersection(s, o);
    if (p) cuts.set(Math.round((s.axis === 'ew' ? p[0] : p[1]) * 10) / 10, p);
  }
  const sorted = [...cuts.entries()].sort((x, y) => x[0] - y[0]);
  const r = rng(hash(s.id));
  for (let i = 1; i < sorted.length; i++) {
    const [ua, va] = sorted[i - 1][1];
    const [ub, vb] = sorted[i][1];
    if (Math.hypot(ua - ub, va - vb) < 3) continue;
    const a = nodeAt(ua, va);
    const b = nodeAt(ub, vb);
    const mu = (ua + ub) / 2;
    const mv = (va + vb) / 2;
    let light = s.light + (r() - 0.5) * 0.12;
    for (const d of DARK_SPOTS) if (Math.hypot(mu - d.u, mv - d.v) < d.r) light -= d.drop;
    light = Math.max(0.12, Math.min(1, light));
    const coords = [nodes[a].ll, nodes[b].ll];
    edges.push({
      id: `${s.id}-${i}`,
      a, b,
      street: s.name,
      streetId: s.id,
      kind: s.kind,
      light,
      activity: Math.max(0.1, Math.min(1, s.activity + (r() - 0.5) * 0.15)),
      length: dist(coords[0], coords[1]),
      coords,
    });
  }
}

/** Ruelles et passages piétons : raccourcis en diagonale d'un îlot, souvent peu éclairés (fictifs). */
export const ALLEYS: { id: string; name: string; a: [string, string]; b: [string, string]; light: number; activity: number }[] = [
  { id: 'ruelle-artisans', name: 'Ruelle des Artisans', a: ['st-francois', 'dorchester'], b: ['reine', 'caron'], light: 0.2, activity: 0.15 },
  { id: 'ruelle-st-francois', name: 'Ruelle Saint-François', a: ['reine', 'couronne'], b: ['prince-edouard', 'dorchester'], light: 0.22, activity: 0.15 },
  { id: 'passage-roi', name: 'Passage du Roi', a: ['st-joseph', 'couronne'], b: ['roi', 'parvis'], light: 0.24, activity: 0.2 },
  { id: 'ruelle-dorchester', name: 'Ruelle Dorchester', a: ['charest', 'dorchester'], b: ['st-joseph', 'caron'], light: 0.28, activity: 0.2 },
  { id: 'ruelle-chapelle', name: 'Ruelle de la Chapelle', a: ['reine', 'dorchester'], b: ['commissaires', 'caron'], light: 0.26, activity: 0.18 },
  { id: 'passage-pont', name: 'Passage du Pont', a: ['roi', 'parvis'], b: ['reine', 'pont'], light: 0.3, activity: 0.2 },
  { id: 'ruelle-reine', name: 'Ruelle de la Reine', a: ['reine', 'caron'], b: ['prince-edouard', 'st-anselme'], light: 0.25, activity: 0.15 },
];

/** Extrémités (u, v) d'une ruelle, à partir des intersections qui la définissent. */
export function alleyEnds(al: (typeof ALLEYS)[number]): [[number, number], [number, number]] | null {
  const p = intersection(STREET_BY_ID[al.a[0]], STREET_BY_ID[al.a[1]], 10);
  const q = intersection(STREET_BY_ID[al.b[0]], STREET_BY_ID[al.b[1]], 10);
  return p && q ? [p, q] : null;
}

for (const al of ALLEYS) {
  const ends = alleyEnds(al);
  if (!ends) continue;
  const a = nodeAt(...ends[0]);
  const b = nodeAt(...ends[1]);
  const coords = [nodes[a].ll, nodes[b].ll];
  edges.push({ id: al.id, a, b, street: al.name, streetId: al.id, kind: 'ruelle', light: al.light, activity: al.activity, length: dist(coords[0], coords[1]), coords });
}

export const GRAPH = { nodes, edges };

/** Lampadaires de secours générés le long des tronçons (densité ∝ éclairage). */
export interface Lamp {
  id: string;
  ll: LngLat;
  ok: boolean;
  edge: string;
  /** Intensité relative (≈ lumens / 20 000) */
  power: number;
  watts?: number;
  source?: string;
  year?: number;
  street?: string;
  model?: string;
  usage?: string;
}
export const LAMPS: Lamp[] = (() => {
  const out: Lamp[] = [];
  const r = rng(42);
  for (const e of edges) {
    const spacing = 18 + (1 - e.light) * 55;
    const n = Math.max(1, Math.floor(e.length / spacing));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const side = r() > 0.5 ? 1 : -1;
      const [a, b] = e.coords;
      const offset = 0.00004 * side;
      out.push({
        id: `L${out.length + 1}`,
        ll: [a[0] + (b[0] - a[0]) * t + offset * 0.4, a[1] + (b[1] - a[1]) * t + offset * 0.3],
        ok: r() > 0.035,
        edge: e.id,
        power: e.light,
      });
    }
  }
  return out;
})();

/* ---------- Géométrie de la carte de secours (hors-ligne) ---------- */
export interface BaseFeature { type: 'Feature'; properties: Record<string, unknown>; geometry: { type: 'Polygon' | 'LineString'; coordinates: unknown } }

/** Interpolation bilinéaire dans un quadrilatère (coins dans l'ordre : bas-gauche, bas-droit, haut-droit, haut-gauche). */
function quadPoint(q: [number, number][], s: number, t: number): [number, number] {
  const [a, b, c, d] = q;
  const bottom: [number, number] = [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s];
  const top: [number, number] = [d[0] + (c[0] - d[0]) * s, d[1] + (c[1] - d[1]) * s];
  return [bottom[0] + (top[0] - bottom[0]) * t, bottom[1] + (top[1] - bottom[1]) * t];
}

const PARK_CENTERS: { name: string; u: number; v: number }[] = [
  { name: 'Jardin de Saint-Roch', u: 60, v: -90 },
  { name: 'Parc des Pékans', u: -250, v: 182 },
];

export function baseGeometry() {
  const r = rng(7);
  const buildings: BaseFeature[] = [];
  const parks: BaseFeature[] = [];
  const ns = STREETS.filter((s) => s.axis === 'ns').sort((a, b) => a.at - b.at);
  const ew = STREETS.filter((s) => s.axis === 'ew');
  const ring = (q: [number, number][]) => [...q, q[0]].map(([u, v]) => uv(u, v));

  // Îlots : entre deux rues nord-sud voisines et deux rues est-ouest voisines qui les traversent toutes deux
  for (let j = 1; j < ns.length; j++) {
    const left = ns[j - 1], right = ns[j];
    const crossing = ew
      .map((s) => ({ s, pl: intersection(s, left, 15), pr: intersection(s, right, 15) }))
      .filter((x) => x.pl && x.pr)
      .sort((a, b) => (a.pl![1] + a.pr![1]) - (b.pl![1] + b.pr![1]));
    for (let i = 1; i < crossing.length; i++) {
      const lo = crossing[i - 1], hi = crossing[i];
      const quad: [number, number][] = [lo.pl!, lo.pr!, hi.pr!, hi.pl!];
      const width = Math.hypot(quad[1][0] - quad[0][0], quad[1][1] - quad[0][1]);
      const height = Math.hypot(quad[3][0] - quad[0][0], quad[3][1] - quad[0][1]);
      if (width < 25 || height < 25) continue;
      const cu = (quad[0][0] + quad[2][0]) / 2, cv = (quad[0][1] + quad[2][1]) / 2;
      const park = PARK_CENTERS.find((p) => Math.hypot(p.u - cu, p.v - cv) < 70);
      const mx = 9 / width, my = 9 / height; // marge pour la chaussée
      if (park) {
        parks.push({ type: 'Feature', properties: { name: park.name }, geometry: { type: 'Polygon', coordinates: [ring([quadPoint(quad, mx, my), quadPoint(quad, 1 - mx, my), quadPoint(quad, 1 - mx, 1 - my), quadPoint(quad, mx, 1 - my)])] } });
        continue;
      }
      const lots = Math.max(1, Math.round(width / (26 + r() * 26)));
      const rows = height > 60 && r() > 0.2 ? 2 : 1;
      for (let k = 0; k < lots; k++) {
        for (let m = 0; m < rows; m++) {
          const s1 = mx + ((1 - 2 * mx) * k) / lots + 0.004, s2 = mx + ((1 - 2 * mx) * (k + 1)) / lots - 0.004;
          const t1 = my + ((1 - 2 * my) * m) / rows + 0.01, t2 = my + ((1 - 2 * my) * (m + 1)) / rows - 0.01;
          const core = Math.abs(cu) < 450 && cv > -60 && cv < 200;
          const h = core ? 8 + r() * 30 : 6 + r() * 16;
          buildings.push({ type: 'Feature', properties: { h: Math.round(h), tone: r() }, geometry: { type: 'Polygon', coordinates: [ring([quadPoint(quad, s1, t1), quadPoint(quad, s2, t1), quadPoint(quad, s2, t2), quadPoint(quad, s1, t2)])] } });
        }
      }
    }
  }

  // Rivière Saint-Charles (au nord, au-delà du parc Victoria)
  const north: LngLat[] = [];
  const south: LngLat[] = [];
  for (let u = -1300; u <= 1500; u += 50) {
    const w = Math.sin(u / 260) * 35;
    north.push(uv(u, 760 + w));
    south.push(uv(u, 670 + w));
  }
  const river: BaseFeature = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...south, ...north.reverse(), south[0]]] } };
  // Falaise / coteau Sainte-Geneviève : au sud de la rue Saint-Vallier Est
  const sv = STREET_BY_ID['st-vallier'];
  const edge: LngLat[] = [];
  for (let u = -1300; u <= 1500; u += 50) {
    const v = u < sv.from ? 75 : u > sv.to ? lineAt(sv, sv.to)[1] - (u - sv.to) * 0.05 : lineAt(sv, u)[1];
    edge.push(uv(u, v - 22));
  }
  const cliff: BaseFeature = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...edge, uv(1500, -900), uv(-1300, -900), edge[0]]] } };
  const land: BaseFeature = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[uv(-1600, -900), uv(1800, -900), uv(1800, 900), uv(-1600, 900), uv(-1600, -900)]] } };

  const streets: BaseFeature[] = STREETS.map((s) => ({
    type: 'Feature',
    properties: { name: s.name, kind: s.kind },
    geometry: { type: 'LineString', coordinates: [pointOnStreet(s, s.from), pointOnStreet(s, s.to)] },
  }));
  for (const al of ALLEYS) {
    const ends = alleyEnds(al);
    if (ends) streets.push({ type: 'Feature', properties: { name: al.name, kind: 'ruelle' }, geometry: { type: 'LineString', coordinates: [uv(...ends[0]), uv(...ends[1])] } });
  }
  return { buildings, parks, river, cliff, land, streets };
}

export function streetLabelPoints() {
  return STREETS.map((s) => {
    const t = s.from + (s.to - s.from) * (s.id === 'st-joseph' ? 0.42 : s.axis === 'ew' ? 0.3 : 0.62);
    const angle = (Math.atan(s.slope ?? 0) * 180) / Math.PI; // inclinaison par rapport à l'axe de la rue
    return { id: s.id, name: s.name, ll: pointOnStreet(s, t), axis: s.axis, kind: s.kind, angle: s.axis === 'ew' ? angle : -angle };
  });
}
