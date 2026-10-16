export type LngLat = [number, number];

/**
 * Repère local du quartier, calé sur les arrêts réels du RTC :
 * origine à l'intersection Charest Est / de la Couronne, axe u le long du boulevard Charest Est.
 */
export const ORIGIN = { lat: 46.81363, lng: -71.22414 };
export const GRID_ANGLE = 26.4; // degrés : la trame de Saint-Roch est inclinée vers l'est-nord-est
const THETA = (GRID_ANGLE * Math.PI) / 180;
const M_LAT = 111132;
const M_LNG = 111320 * Math.cos((ORIGIN.lat * Math.PI) / 180);

export const CENTER: LngLat = [-71.2237, 46.815];

export function uv(u: number, v: number): LngLat {
  const e = u * Math.cos(THETA) - v * Math.sin(THETA);
  const n = u * Math.sin(THETA) + v * Math.cos(THETA);
  return [ORIGIN.lng + e / M_LNG, ORIGIN.lat + n / M_LAT];
}

export function toUV([lng, lat]: LngLat): [number, number] {
  const e = (lng - ORIGIN.lng) * M_LNG;
  const n = (lat - ORIGIN.lat) * M_LAT;
  return [e * Math.cos(THETA) + n * Math.sin(THETA), -e * Math.sin(THETA) + n * Math.cos(THETA)];
}

/** Projection plane locale (mètres) — suffisante à l'échelle d'un quartier. */
function xy([lng, lat]: LngLat): [number, number] {
  return [(lng - ORIGIN.lng) * M_LNG, (lat - ORIGIN.lat) * M_LAT];
}
function fromXY([x, y]: [number, number]): LngLat {
  return [ORIGIN.lng + x / M_LNG, ORIGIN.lat + y / M_LAT];
}

export function dist(a: LngLat, b: LngLat): number {
  const [ax, ay] = xy(a);
  const [bx, by] = xy(b);
  return Math.hypot(ax - bx, ay - by);
}

export function projectOnSegment(p: LngLat, a: LngLat, b: LngLat): { t: number; d: number; point: LngLat } {
  const [px, py] = xy(p);
  const [ax, ay] = xy(a);
  const [bx, by] = xy(b);
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  const qx = ax + t * dx;
  const qy = ay + t * dy;
  return { t, d: Math.hypot(px - qx, py - qy), point: fromXY([qx, qy]) };
}

export function lineLength(coords: LngLat[]): number {
  let s = 0;
  for (let i = 1; i < coords.length; i++) s += dist(coords[i - 1], coords[i]);
  return s;
}

/** Points régulièrement espacés le long d'une ligne. */
export function sampleLine(coords: LngLat[], step = 15): LngLat[] {
  const out: LngLat[] = [];
  if (coords.length === 0) return out;
  out.push(coords[0]);
  let carry = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    const seg = dist(a, b);
    let pos = step - carry;
    while (pos <= seg) {
      const t = pos / seg;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      pos += step;
    }
    carry = seg - (pos - step);
  }
  out.push(coords[coords.length - 1]);
  return out;
}

/** Interpole la position à une fraction (0..1) de la longueur. */
export function pointAlong(coords: LngLat[], frac: number): LngLat {
  const total = lineLength(coords);
  let target = total * Math.max(0, Math.min(1, frac));
  for (let i = 1; i < coords.length; i++) {
    const seg = dist(coords[i - 1], coords[i]);
    if (target <= seg) {
      const t = seg === 0 ? 0 : target / seg;
      const a = coords[i - 1];
      const b = coords[i];
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    target -= seg;
  }
  return coords[coords.length - 1];
}

/** Sous-ligne de 0 à frac (pour l'animation de tracé). */
export function sliceLine(coords: LngLat[], frac: number): LngLat[] {
  if (frac >= 1) return coords;
  const total = lineLength(coords);
  let target = total * frac;
  const out: LngLat[] = [coords[0]];
  for (let i = 1; i < coords.length; i++) {
    const seg = dist(coords[i - 1], coords[i]);
    if (target <= seg) {
      const t = seg === 0 ? 0 : target / seg;
      const a = coords[i - 1];
      const b = coords[i];
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      return out;
    }
    out.push(coords[i]);
    target -= seg;
  }
  return out;
}

export function bearing(a: LngLat, b: LngLat): number {
  const [ax, ay] = xy(a);
  const [bx, by] = xy(b);
  return ((Math.atan2(bx - ax, by - ay) * 180) / Math.PI + 360) % 360;
}

export function bounds(coords: LngLat[]): [LngLat, LngLat] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of coords) {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return [[minX, minY], [maxX, maxY]];
}

export function formatDist(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

export function formatDuration(sec: number): string {
  const min = Math.max(1, Math.round(sec / 60));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
}

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Position simulée de l'utilisateur (démo) : rue de la Couronne, entre Charest et Saint-Joseph. */
export const ME: LngLat = uv(-12, 45);

/** Coordonnées réelles (latitude, longitude) → [lng, lat] */
export const at = (lat: number, lng: number): LngLat => [lng, lat];
