import type { Lamp } from '../data/streets';
import type { LngLat } from './geo';

/**
 * Lecture du jeu « Éclairage public » (GI - LU quartier St-Roch, Ville de Québec).
 * Colonnes utilisées : OBJECTID, NO_EQUIPEMENT, STATUT_ACTIF, COORDONNEE_X, COORDONNEE_Y,
 * WATT_LAMPE_CODE, SOURCE_LUMINAIRE_CODE, ANNEE_INSTALLATION, MODELE_DESC, NOM_TOPONYMIE,
 * USAGE_PRINCIPAL_CODE. Coordonnées en NAD83 / MTM zone 7 (EPSG:32187).
 * Module sans dépendance au navigateur : utilisé par l'application et par scripts/import-eclairage.ts.
 */

/* ---------- NAD83 / MTM zone 7 → WGS84 (Mercator transverse inverse) ---------- */
export function mtm7ToWgs84(x: number, y: number): LngLat {
  const a = 6378137;
  const f = 1 / 298.257222101;
  const k0 = 0.9999;
  const lon0 = (-70.5 * Math.PI) / 180;
  const FE = 304800;
  const e2 = f * (2 - f);
  const ep2 = e2 / (1 - e2);
  const mu = y / k0 / (a * (1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256));
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const p =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const sin = Math.sin(p);
  const cos = Math.cos(p);
  const tan = Math.tan(p);
  const C = ep2 * cos ** 2;
  const T = tan ** 2;
  const N = a / Math.sqrt(1 - e2 * sin ** 2);
  const R = (a * (1 - e2)) / (1 - e2 * sin ** 2) ** 1.5;
  const D = (x - FE) / (N * k0);
  const lat =
    p -
    ((N * tan) / R) *
      (D ** 2 / 2 - ((5 + 3 * T + 10 * C - 4 * C ** 2 - 9 * ep2) * D ** 4) / 24 + ((61 + 90 * T + 298 * C + 45 * T ** 2 - 252 * ep2 - 3 * C ** 2) * D ** 6) / 720);
  const lon = lon0 + (D - ((1 + 2 * T + C) * D ** 3) / 6 + ((5 - 2 * C + 28 * T - 3 * C ** 2 + 8 * ep2 + 24 * T ** 2) * D ** 5) / 120) / cos;
  return [(lon * 180) / Math.PI, (lat * 180) / Math.PI];
}

/* ---------- Lecture du fichier ---------- */
export type Cell = string | number | boolean | Date | null | undefined;

/** CSV / TSV exporté d'Excel (séparateur détecté : tabulation, point-virgule ou virgule). */
export function parseDelimited(text: string): string[][] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  if (!lines.length) return [];
  const head = lines[0];
  const delim = ['\t', ';', ','].sort((x, y) => head.split(y).length - head.split(x).length)[0];
  return lines.map((line) => {
    const out: string[] = [];
    let cur = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') quoted = false;
        else cur += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === delim) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  });
}

function num(v: Cell): number {
  if (typeof v === 'number') return v;
  if (v == null) return NaN;
  return parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
}

function str(v: Cell): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

function year(v: Cell): number | undefined {
  if (v instanceof Date) return v.getFullYear();
  if (typeof v === 'number') {
    if (v > 1800 && v < 2100) return v;
    if (v > 1000) return new Date(Date.UTC(1899, 11, 30) + v * 86400000).getUTCFullYear(); // date sérielle Excel
    return undefined;
  }
  const m = str(v).match(/(18|19|20)\d{2}/);
  return m ? Number(m[0]) : undefined;
}

/** « De Saint-Vallier Est, Rue /  Québec » → « Rue de Saint-Vallier Est » */
export function formatToponyme(raw: string): string {
  const name = raw.split('/')[0].trim();
  const [base, type] = name.split(/,\s*/);
  if (!type) return base;
  const b = base.replace(/^(De la|De l'|De l’|Des|Du|De|D')\s?/i, (m) => m.toLowerCase());
  return `${type} ${b}`.replace(/\s+/g, ' ');
}

const LM_PER_W: Record<string, number> = { HPS: 100, SHP: 100, SODIUM: 100, LED: 125, DEL: 125, MH: 85, HM: 85, MV: 50, VM: 50, INC: 15, FLUO: 70 };

export interface LightingStats {
  total: number;
  active: number;
  inactive: number;
  bySource: { source: string; count: number }[];
  avgYear?: number;
  oldestYear?: number;
  ledShare: number;
  avgWatts?: number;
  topStreets: { street: string; count: number }[];
}

export interface ParseResult { lamps: Lamp[]; skipped: number; missing: string[] }

const REQUIRED = ['COORDONNEE_X', 'COORDONNEE_Y'];

export function parseLightingRows(rows: Cell[][]): ParseResult {
  const headerIdx = rows.findIndex((r) => r.some((c) => str(c).toUpperCase() === 'COORDONNEE_X'));
  if (headerIdx < 0) return { lamps: [], skipped: rows.length, missing: REQUIRED };
  const header = rows[headerIdx].map((c) => str(c).toUpperCase());
  const col = (name: string) => header.indexOf(name);
  const missing = REQUIRED.filter((n) => col(n) < 0);
  if (missing.length) return { lamps: [], skipped: rows.length, missing };
  const get = (r: Cell[], name: string): Cell => (col(name) >= 0 ? r[col(name)] : undefined);

  const lamps: Lamp[] = [];
  let skipped = 0;
  for (const r of rows.slice(headerIdx + 1)) {
    const x = num(get(r, 'COORDONNEE_X'));
    const y = num(get(r, 'COORDONNEE_Y'));
    if (!isFinite(x) || !isFinite(y) || x < 100000 || y < 4000000) { skipped++; continue; }
    const ll = mtm7ToWgs84(x, y);
    // garde-fou : grande région de Québec
    if (ll[1] < 46.6 || ll[1] > 47.1 || ll[0] < -71.6 || ll[0] > -70.9) { skipped++; continue; }
    const watts = parseInt(str(get(r, 'WATT_LAMPE_CODE')), 10) || num(get(r, 'WATT_VOLT_DESC')) || undefined;
    const source = str(get(r, 'SOURCE_LUMINAIRE_CODE')).toUpperCase() || 'INCONNU';
    const lumens = (watts ?? 150) * (LM_PER_W[source] ?? 85);
    const statut = str(get(r, 'STATUT_ACTIF')).toUpperCase();
    lamps.push({
      id: str(get(r, 'NO_EQUIPEMENT')) || str(get(r, 'OBJECTID')) || `L${lamps.length + 1}`,
      ll,
      ok: statut === '' || statut === 'A',
      edge: '',
      power: Math.min(1.4, lumens / 20000),
      watts,
      source,
      year: year(get(r, 'ANNEE_INSTALLATION')),
      street: formatToponyme(str(get(r, 'NOM_TOPONYMIE'))) || undefined,
      model: str(get(r, 'MODELE_DESC')) || undefined,
      usage: str(get(r, 'USAGE_PRINCIPAL_CODE')) || undefined,
    });
  }
  return { lamps, skipped, missing: [] };
}

export function lightingStats(lamps: Lamp[]): LightingStats {
  const by = new Map<string, number>();
  const streets = new Map<string, number>();
  let ys = 0, yn = 0, oldest = Infinity, ws = 0, wn = 0, active = 0;
  for (const l of lamps) {
    if (l.ok) active++;
    by.set(l.source ?? 'Fictif', (by.get(l.source ?? 'Fictif') ?? 0) + 1);
    if (l.street) streets.set(l.street, (streets.get(l.street) ?? 0) + 1);
    if (l.year) { ys += l.year; yn++; oldest = Math.min(oldest, l.year); }
    if (l.watts) { ws += l.watts; wn++; }
  }
  const led = (by.get('LED') ?? 0) + (by.get('DEL') ?? 0);
  return {
    total: lamps.length,
    active,
    inactive: lamps.length - active,
    bySource: [...by].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count),
    avgYear: yn ? Math.round(ys / yn) : undefined,
    oldestYear: yn ? oldest : undefined,
    ledShare: lamps.length ? led / lamps.length : 0,
    avgWatts: wn ? Math.round(ws / wn) : undefined,
    topStreets: [...streets].map(([street, count]) => ({ street, count })).sort((a, b) => b.count - a.count).slice(0, 6),
  };
}

