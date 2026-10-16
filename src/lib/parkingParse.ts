import type { Parking } from '../data/parkings';
import { LngLat, hash } from './geo';
import { mtm7ToWgs84 } from './lightingParse';

/**
 * Lecture du jeu « Stationnements municipaux hors rue » (GeoJSON de la Ville de Québec).
 * Propriétés : ARRONDISSEMENT, QUARTIER, NOM, ADRESSE_À_PROXIMITÉ, NOMBRE_DE_CASES, TYPE_INT_EXT.
 * Coordonnées en longitude/latitude (WGS84) ; des coordonnées MTM zone 7 sont aussi acceptées.
 * Seuls les champs du jeu sont utilisés (aucun tarif ni disponibilité).
 */

export const PARKING_PROPERTIES = ['ARRONDISSEMENT', 'QUARTIER', 'NOM', 'ADRESSE_À_PROXIMITÉ', 'NOMBRE_DE_CASES', 'TYPE_INT_EXT'] as const;

const key = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '_');

interface Feature { type?: string; geometry?: { type?: string; coordinates?: unknown }; properties?: Record<string, unknown> }

export interface ParkingParseResult { parkings: Parking[]; total: number; skipped: number; error?: string }

function toLngLat(c: unknown): LngLat | null {
  if (!Array.isArray(c) || c.length < 2) return null;
  // MultiPoint / Polygon : on prend le premier point ou le centre approximatif
  if (Array.isArray(c[0])) {
    const pts = (c as unknown[]).flat(2).filter((x) => typeof x === 'number') as number[];
    if (pts.length < 2) return null;
    let sx = 0, sy = 0, n = 0;
    for (let i = 0; i + 1 < pts.length; i += 2) { sx += pts[i]; sy += pts[i + 1]; n++; }
    return toLngLat([sx / n, sy / n]);
  }
  const x = Number(c[0]);
  const y = Number(c[1]);
  if (!isFinite(x) || !isFinite(y)) return null;
  if (Math.abs(x) <= 180 && Math.abs(y) <= 90) return [x, y];
  if (x > 100000 && y > 4000000) return mtm7ToWgs84(x, y);
  return null;
}

export function parseParkingGeoJSON(json: unknown): ParkingParseResult {
  const fc = json as { type?: string; features?: Feature[] };
  if (!fc || !Array.isArray(fc.features)) return { parkings: [], total: 0, skipped: 0, error: 'Fichier GeoJSON invalide (FeatureCollection attendue)' };
  const parkings: Parking[] = [];
  let skipped = 0;
  fc.features.forEach((f, i) => {
    const props: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(f.properties ?? {})) props[key(k)] = v;
    const ll = toLngLat(f.geometry?.coordinates);
    const name = String(props.NOM ?? '').trim();
    if (!ll || !name) { skipped++; return; }
    const cases = Number(String(props.NOMBRE_DE_CASES ?? '').replace(/\s/g, ''));
    const typeLabel = String(props.TYPE_INT_EXT ?? '').trim();
    parkings.push({
      id: `mun-${i}-${hash(name).toString(36)}`,
      name,
      ll,
      address: String(props.ADRESSE_A_PROXIMITE ?? '').trim() || 'Adresse non précisée',
      indoor: /int/i.test(typeLabel),
      typeLabel: typeLabel || 'Non précisé',
      capacity: isFinite(cases) && cases > 0 ? cases : 0,
      quartier: String(props.QUARTIER ?? '').trim() || undefined,
      arrondissement: String(props.ARRONDISSEMENT ?? '').trim() || undefined,
    });
  });
  return { parkings, total: fc.features.length, skipped };
}
