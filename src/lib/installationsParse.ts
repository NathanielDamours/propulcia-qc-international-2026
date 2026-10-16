import type { Place, PlaceCategory } from '../data/places';
import { STREETS, pointOnStreet } from '../data/streets';
import { LngLat, hash, uv } from './geo';
import { Cell, findStreet, norm, positionOnStreet } from './businessParse';

/**
 * Lecture du jeu « Liste des installations » (équipements municipaux de la Ville de Québec).
 * Colonnes : Arrondissement_0, Nom_Type_No_Installation_calculé, Adresse, Type d'équipement texte.
 *   Nom_Type_No_Installation_calculé = « Bibliothèque Gabrielle-Roy - Bibliothèque - ACL - B0017-1 »
 *   Adresse                          = « 350 Rue Saint-Joseph E, Québec, QC G1K 2T6 »
 * Le jeu couvre toute la ville : on conserve Saint-Roch (code postal G1K ou rue du quartier).
 * Position : lieu connu du même nom, sinon numéro civique le long de la rue, sinon position stable sur la rue.
 * Module sans dépendance au navigateur.
 */

export const INSTALLATION_COLUMNS = ['Arrondissement_0', 'Nom_Type_No_Installation_calculé', 'Adresse', "Type d'équipement texte"] as const;

export interface ParsedAddress { civic?: number; type: string; street: string; city?: string; postal?: string }

const SUFFIX: Record<string, string> = { e: 'Est', est: 'Est', o: 'Ouest', ouest: 'Ouest', n: 'Nord', s: 'Sud' };

/** « 350 Rue Saint-Joseph E, Québec, QC G1K 2T6 » → { civic: 350, type: 'Rue', street: 'Saint-Joseph Est', postal: 'G1K 2T6' } */
export function parseAddress(raw: string): ParsedAddress {
  const [first, ...rest] = raw.split(',').map((x) => x.trim());
  const postal = raw.match(/[A-Z]\d[A-Z]\s?\d[A-Z]\d/i)?.[0]?.toUpperCase();
  const m = first.match(/^(\d+)(?:-\d+)?[A-Z]?\s+(.*)$/i);
  const civic = m ? Number(m[1]) : undefined;
  let rest1 = (m ? m[2] : first).trim();
  const tm = rest1.match(/^(rue|boulevard|boul\.?|bd|avenue|av\.?|côte|cote|place|ruelle|chemin|parc|promenade)\s+(.*)$/i);
  let type = 'Rue';
  if (tm) {
    type = /^boul|^bd/i.test(tm[1]) ? 'Boulevard' : /^av/i.test(tm[1]) ? 'Avenue' : tm[1].charAt(0).toUpperCase() + tm[1].slice(1).toLowerCase();
    rest1 = tm[2];
  }
  const parts = rest1.split(/\s+/);
  const last = parts[parts.length - 1]?.toLowerCase().replace('.', '');
  if (parts.length > 1 && SUFFIX[last]) parts[parts.length - 1] = SUFFIX[last];
  return { civic, type, street: parts.join(' '), city: rest[0], postal };
}

/** « Nom - Type - Arrondissement - Code » (le nom peut lui-même contenir des tirets) */
export function splitInstallationName(raw: string): { name: string; type?: string; arr?: string; code?: string } {
  const parts = raw.split(/\s+-\s+/).map((x) => x.trim());
  if (parts.length >= 4) {
    const code = parts.pop()!;
    const arr = parts.pop()!;
    const type = parts.pop()!;
    return { name: parts.join(' - '), type, arr, code };
  }
  return { name: raw.trim() };
}

const CATEGORY_RULES: [RegExp, PlaceCategory][] = [
  [/bibliotheque|salle de spectacle|theatre|musee|centre culturel|galerie|maison de la culture/, 'culture'],
  [/arena|piscine|gymnase|centre sportif|terrain|patinoire|plateau sportif|stade|tennis|skatepark|planchodrome|jeux d eau/, 'loisirs'],
  [/parc|jardin|aire de jeux|place publique|espace vert|square/, 'parc'],
  [/centre communautaire|centre de loisirs|maison des jeunes|centre des aines|local communautaire|organisme/, 'organisme'],
];
export function installationCategory(type: string, name: string): PlaceCategory {
  const t = norm(`${type} ${name}`);
  for (const [re, c] of CATEGORY_RULES) if (re.test(t)) return c;
  return 'institution';
}

/** Numéros civiques des rues « Est » de Saint-Roch : ~1,6 numéro par mètre vers l'est (calé sur Saint-Joseph Est : n° 350 ≈ u -40). */
function positionFromCivic(s: (typeof STREETS)[number], civic: number, key: string): LngLat {
  if (s.axis !== 'ew' || !/Est$/.test(s.name)) return positionOnStreet(s, key);
  const t = Math.max(s.from + 10, Math.min(s.to - 10, -40 + (civic - 350) * 0.625));
  return pointOnStreet(s, t, civic % 2 === 0 ? -12 : 12);
}

const nameKey = (s: string) => norm(s).replace(/\s/g, '');

export interface InstallationsParseResult { places: Place[]; total: number; outside: number; located: number; byType: { type: string; count: number }[]; missing: string[] }

export function parseInstallationRows(rows: Cell[][]): InstallationsParseResult {
  const str = (v: Cell) => (v == null ? '' : String(v).trim());
  const headerIdx = rows.findIndex((r) => r.some((c) => norm(str(c)).startsWith('nom type no installation')));
  if (headerIdx < 0) return { places: [], total: 0, outside: 0, located: 0, byType: [], missing: [...INSTALLATION_COLUMNS] };
  const header = rows[headerIdx].map((c) => norm(str(c)));
  const col = (n: string) => header.findIndex((h) => h === norm(n) || h.startsWith(norm(n)));
  const iName = col('Nom_Type_No_Installation');
  const iAddr = col('Adresse');
  const iType = col("Type d'équipement");
  const iArr = col('Arrondissement');
  const missing = [iName < 0 && 'Nom_Type_No_Installation_calculé', iAddr < 0 && 'Adresse'].filter(Boolean) as string[];
  if (missing.length) return { places: [], total: 0, outside: 0, located: 0, byType: [], missing };

  const places: Place[] = [];
  const types = new Map<string, number>();
  let total = 0, outside = 0;
  for (const r of rows.slice(headerIdx + 1)) {
    const rawName = str(r[iName]);
    if (!rawName) continue;
    total++;
    const { name, type: typeFromName, code } = splitInstallationName(rawName);
    const type = (iType >= 0 ? str(r[iType]) : '') || typeFromName || 'Installation';
    const addressRaw = str(r[iAddr]);
    const addr = parseAddress(addressRaw);
    const street = findStreet(addr.type, addr.street);
    const inSaintRoch = addr.postal?.startsWith('G1K') || (!!street && !addr.postal);
    if (!inSaintRoch) { outside++; continue; }
    types.set(type, (types.get(type) ?? 0) + 1);
    const key = `${nameKey(name)}|${code ?? ''}`;
    const ll: LngLat | null = street ? (addr.civic ? positionFromCivic(street, addr.civic, key) : positionOnStreet(street, key)) : null;
    places.push({
      id: `ins-${hash(key).toString(36)}`,
      name,
      category: installationCategory(type, name),
      ll: ll ?? uv(0, 0),
      address: addressRaw.replace(/,\s*Québec,\s*QC/i, ''),
      description: `Installation municipale de la Ville de Québec : ${type.toLowerCase()}${code ? ` (n° ${code})` : ''}.`,
      safety: 0,
      reviews: 0,
      rating: 0,
      hours: '',
      tags: [type],
      isOrganization: true,
      registry: true,
      installation: true,
      located: !!ll,
      approxPosition: true,
      code,
      arrondissement: iArr >= 0 ? str(r[iArr]) : undefined,
    });
  }
  return {
    places,
    total,
    outside,
    located: places.filter((p) => p.located).length,
    byType: [...types].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    missing: [],
  };
}
