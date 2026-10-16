import { Cell, parseDelimited } from './lightingParse';
import type { LngLat } from './geo';

/**
 * Arrêts d'autobus du RTC — fichier stops.txt du GTFS (données ouvertes du Réseau de transport de la Capitale).
 * Colonnes GTFS : stop_id, stop_code, stop_name, stop_desc, stop_lat, stop_lon, zone_id, stop_url,
 * location_type, parent_station, wheelchair_boarding (seules stop_id, stop_name, stop_lat, stop_lon sont obligatoires).
 * Le GTFS couvre toute la ville : on ne garde que les arrêts situés dans Saint-Roch et ses abords.
 */

export interface BusStop {
  id: string;
  code?: string;
  name: string;
  ll: LngLat;
  wheelchair?: boolean;
  url?: string;
  desc?: string;
}

/** Saint-Roch et ses abords immédiats (lon/lat) */
export const SAINT_ROCH_BBOX = { minLon: -71.2385, maxLon: -71.2095, minLat: 46.8065, maxLat: 46.8215 };

export interface StopsParseResult { stops: BusStop[]; total: number; outside: number; missing: string[] }

export function parseStopsText(text: string): StopsParseResult {
  return parseStopsRows(parseDelimited(text));
}

export function parseStopsRows(rows: Cell[][]): StopsParseResult {
  const str = (v: Cell) => (v == null ? '' : String(v).trim());
  if (!rows.length) return { stops: [], total: 0, outside: 0, missing: ['stop_id', 'stop_lat', 'stop_lon'] };
  const header = rows[0].map((c) => str(c).toLowerCase().replace(/^﻿/, ''));
  const col = (n: string) => header.indexOf(n);
  const missing = ['stop_id', 'stop_name', 'stop_lat', 'stop_lon'].filter((n) => col(n) < 0);
  if (missing.length) return { stops: [], total: 0, outside: 0, missing };
  const stops: BusStop[] = [];
  let total = 0, outside = 0;
  for (const r of rows.slice(1)) {
    const id = str(r[col('stop_id')]);
    if (!id) continue;
    const type = col('location_type') >= 0 ? str(r[col('location_type')]) : '';
    if (type && type !== '0') continue; // gares, entrées, etc. : seuls les points d'arrêt
    total++;
    const lat = Number(str(r[col('stop_lat')]).replace(',', '.'));
    const lon = Number(str(r[col('stop_lon')]).replace(',', '.'));
    const b = SAINT_ROCH_BBOX;
    if (!(lon >= b.minLon && lon <= b.maxLon && lat >= b.minLat && lat <= b.maxLat)) { outside++; continue; }
    const wc = col('wheelchair_boarding') >= 0 ? str(r[col('wheelchair_boarding')]) : '';
    stops.push({
      id,
      code: col('stop_code') >= 0 ? str(r[col('stop_code')]) || undefined : undefined,
      // stop_desc (« Charest Est / de la Couronne ») est plus parlant que stop_name (« de la Couronne »)
      name: (col('stop_desc') >= 0 && str(r[col('stop_desc')]).replace(/\s*\/\s*/g, ' / ')) || str(r[col('stop_name')]) || `Arrêt ${id}`,
      ll: [lon, lat],
      wheelchair: wc === '1' ? true : wc === '2' ? false : undefined,
      url: col('stop_url') >= 0 ? str(r[col('stop_url')]) || undefined : undefined,
      desc: str(r[col('stop_name')]) || undefined,
    });
  }
  return { stops, total, outside, missing: [] };
}
