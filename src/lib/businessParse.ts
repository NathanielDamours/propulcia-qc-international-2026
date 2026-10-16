import type { Place, PlaceCategory } from '../data/places';
import { STREETS, pointOnStreet } from '../data/streets';
import { LngLat, hash, rng, uv } from './geo';

/**
 * Lecture du « Registre des entreprises » de Saint-Roch (DEGP - Entreprises St-Roch).
 * Colonnes : « Type rue », « Nom rue », « Marque de Commerce ».
 * Le fichier n'a ni numéro civique ni coordonnées : chaque commerce est placé à une position
 * stable (dérivée de son nom) le long de sa rue, dans la portion de la rue située à Saint-Roch.
 * Module sans dépendance au navigateur.
 */

export const BUSINESS_COLUMNS = ['Type rue', 'Nom rue', 'Marque de Commerce'] as const;

export type Cell = string | number | boolean | Date | null | undefined;

export const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’'`\-–—_,.;:()&/]/g, ' ').replace(/\s+/g, ' ').trim();

const ARTICLES = /^(de la|de l|des|du|de|d|la|le|les|l)\s+/;
/** « Rue de la Couronne » / « Couronne » / « De la Couronne » → « couronne » */
function streetKey(name: string) {
  return norm(name).replace(/^(rue|boulevard|boul|avenue|av|cote|place|ruelle|passage)\s+/, '').replace(ARTICLES, '').trim();
}

const STREET_INDEX = new Map(STREETS.map((s) => [streetKey(s.name), s]));

export function findStreet(type: string, name: string) {
  const key = streetKey(`${type} ${name}`);
  return STREET_INDEX.get(key) ?? STREET_INDEX.get(streetKey(name)) ?? [...STREET_INDEX].find(([k]) => k.startsWith(key) || key.startsWith(k))?.[1];
}

/** Position stable le long de la rue (même commerce → même point à chaque chargement). */
export function positionOnStreet(s: (typeof STREETS)[number], key: string): LngLat {
  const r = rng(hash(key));
  const t = s.from + 20 + r() * Math.max(10, s.to - s.from - 40);
  const side = (r() > 0.5 ? 1 : -1) * (10 + r() * 6);
  return pointOnStreet(s, t, side);
}

const RULES: [RegExp, PlaceCategory][] = [
  [/hotel|auberge|residence de tourisme|gite|hebergement|appartements touristiques|suites/, 'hotel'],
  [/restaurant|resto|bistro|brasserie|pizzeria|pizza|sushi|ramen|grill|cantine|taverne|\bpub\b|\bbar\b|traiteur|burger|poke|taqueria|bouffe/, 'restaurant'],
  [/cafe|boulangerie|patisserie|torref|chocolat|creme glacee|salon de the/, 'cafe'],
  [/universite|ecole|cegep|college|institut|ministere|gouvernement|ville de quebec|centre de services/, 'institution'],
  [/organisme|cooperative|coop\b|fondation|association|centre communautaire|maison des|entraide|regroupement/, 'organisme'],
  [/theatre|galerie|musee|cinema|salle de spectacle|productions|artistes|atelier d art|danse/, 'culture'],
  [/\bfx\b|studio|numerique|logiciel|techno|\blabs?\b|digital|jeux|games|informatique|\bia\b|software|interactive|web|data/, 'techno'],
  [/avocat|notaire|comptable|\bcpa\b|assurance|banque|caisse|desjardins|clinique|dentiste|cabinet|conseil|architecte|immobilier|coiffure|esthetique|physio|optometr|ingenieur|courtier/, 'services'],
  [/pharmacie|familiprix|jean coutu|uniprix|boutique|friperie|epicerie|marche|depanneur|fleuriste|librairie|optique|quincaillerie|vetement|chaussure|bijout|sport|velo|magasin/, 'commerce'],
];

export function guessBusinessCategory(name: string): PlaceCategory {
  const n = norm(name);
  for (const [re, c] of RULES) if (re.test(n)) return c;
  return 'commerce';
}

export interface BusinessParseResult {
  places: Place[];
  total: number;
  located: number;
  unknownStreets: { street: string; count: number }[];
  missing: string[];
}

export function parseBusinessRows(rows: Cell[][]): BusinessParseResult {
  const str = (v: Cell) => (v == null ? '' : String(v).trim());
  const headerIdx = rows.findIndex((r) => r.some((c) => norm(str(c)) === 'marque de commerce'));
  if (headerIdx < 0) return { places: [], total: 0, located: 0, unknownStreets: [], missing: [...BUSINESS_COLUMNS] };
  const header = rows[headerIdx].map((c) => norm(str(c)));
  const col = (n: string) => header.indexOf(norm(n));
  const missing = BUSINESS_COLUMNS.filter((n) => col(n) < 0);
  if (missing.length) return { places: [], total: 0, located: 0, unknownStreets: [], missing };

  const places: Place[] = [];
  const unknown = new Map<string, number>();
  const seen = new Set<string>();
  let total = 0;
  for (const r of rows.slice(headerIdx + 1)) {
    const name = str(r[col('Marque de Commerce')]);
    const type = str(r[col('Type rue')]);
    const street = str(r[col('Nom rue')]);
    if (!name) continue;
    total++;
    const key = `${norm(name)}|${norm(type)}|${norm(street)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const s = findStreet(type, street);
    const address = `${type} ${street}`.trim();
    if (!s) unknown.set(address, (unknown.get(address) ?? 0) + 1);
    const category = guessBusinessCategory(name);
    places.push({
      id: `reg-${hash(key).toString(36)}`,
      name,
      category,
      ll: s ? positionOnStreet(s, key) : uv(0, 0),
      address: s ? s.name : address,
      description: `Entreprise inscrite au registre des entreprises de Saint-Roch, ${s ? s.name : address}.`,
      safety: 0,
      reviews: 0,
      rating: 0,
      hours: '',
      tags: [],
      registry: true,
      located: !!s,
    });
  }
  return {
    places,
    total,
    located: places.filter((p) => p.located).length,
    unknownStreets: [...unknown].map(([street, count]) => ({ street, count })).sort((a, b) => b.count - a.count),
    missing: [],
  };
}
