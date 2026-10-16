import type { LngLat } from './geo';
import { mtm7ToWgs84 } from './lightingParse';

/**
 * Postes de police (GeoJSON) : public/donnees/postes-police.geojson.
 * Propriétés : NOM, ADRESSE, TELEPHONE, HORAIRE (« 24/7 » par défaut), POSITION (« approximative » si géocodage à vérifier).
 * Coordonnées WGS84 (longitude, latitude) ; MTM zone 7 acceptée.
 */
export interface PoliceStation {
  id: string;
  name: string;
  address: string;
  phone?: string;
  hours: string;
  ll: LngLat;
  approximate?: boolean;
}

export const POLICE_PROPERTIES = ['NOM', 'ADRESSE', 'TELEPHONE', 'HORAIRE', 'POSITION'] as const;

/** Repli si le fichier est absent : même contenu que le fichier du projet. */
export const DEMO_POLICE: PoliceStation[] = [
  { id: 'police-sq-autoroutier', name: 'Sûreté du Québec, Autoroutier de Québec', address: '5005 boul. Pierre-Bertrand, Québec (Québec) G2K 1M1', phone: '418 623-6249', hours: '24/7', ll: [-71.2867, 46.8437], approximate: true },
];

const key = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '_');

function toLngLat(c: unknown): LngLat | null {
  if (!Array.isArray(c) || c.length < 2) return null;
  const x = Number(c[0]);
  const y = Number(c[1]);
  if (!isFinite(x) || !isFinite(y)) return null;
  if (Math.abs(x) <= 180 && Math.abs(y) <= 90) return [x, y];
  if (x > 100000 && y > 4000000) return mtm7ToWgs84(x, y);
  return null;
}

export function parsePoliceGeoJSON(json: unknown): { stations: PoliceStation[]; total: number; skipped: number; error?: string } {
  const fc = json as { features?: { geometry?: { coordinates?: unknown }; properties?: Record<string, unknown> }[] };
  if (!fc || !Array.isArray(fc.features)) return { stations: [], total: 0, skipped: 0, error: 'Fichier GeoJSON invalide (FeatureCollection attendue)' };
  const stations: PoliceStation[] = [];
  let skipped = 0;
  fc.features.forEach((f, i) => {
    const props: Record<string, string> = {};
    for (const [k, v] of Object.entries(f.properties ?? {})) props[key(k)] = v == null ? '' : String(v).trim();
    const ll = toLngLat(f.geometry?.coordinates);
    const name = props.NOM || props.NOM_POSTE || props.NAME || '';
    if (!ll || !name) { skipped++; return; }
    stations.push({
      id: `police-${i}-${key(name).toLowerCase().slice(0, 24)}`,
      name,
      address: props.ADRESSE || props.ADRESSE_CIVIQUE || '',
      phone: props.TELEPHONE || props.TEL || undefined,
      hours: props.HORAIRE || '24/7',
      ll,
      approximate: /approx/i.test(props.POSITION ?? ''),
    });
  });
  return { stations, total: fc.features.length, skipped };
}
