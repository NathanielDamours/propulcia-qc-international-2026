import type { AppEvent, EventCategory } from '../data/events';
import { LngLat, uv } from './geo';

/**
 * Lecture du jeu « Événements à venir » (programmation de la Ville de Québec).
 * Colonnes : Titre PROJET, Unite administrative responsable de l'activité (R), Unité administrative en soutien (S),
 * Promoteur, Description (courte), Format de l'événement, Catégorie, Nature, Type d'activité, Site(s) de l'activité,
 * Arrondissement, Quartier, Date et heure de début, Date et heure de fin, Diffusion COM, Type de représentation,
 * Description promotionnelle, Catégorie Web, Coût, Site internet du promoteur, Précisions activité, Si intempéries,
 * Cahier papier, Suivi COM, Affichage COM, Affichage STATUT.
 * Les valeurs de liste sont au format SharePoint « 7;#Statique » ou « 56;#Animation;#59;#Événement ».
 * Le fichier n'a pas de coordonnées : les sites sont géolocalisés avec le répertoire ci-dessous.
 * Module sans dépendance au navigateur.
 */

export const EVENT_COLUMNS = [
  'Titre PROJET',
  "Unite administrative responsable de l'activité (R)",
  "Unité administrative en soutien (S)",
  'Promoteur',
  'Description (courte)',
  "Format de l'événement",
  'Catégorie',
  'Nature ',
  "Type d'activité",
  "Site(s) de l'activité",
  'Arrondissement',
  'Quartier',
  'Date et heure de début',
  'Date et heure de fin',
  'Diffusion COM',
  'Type de représentation',
  'Description promotionnelle',
  'Catégorie Web',
  'Coût',
  'Site internet du promoteur',
  'Précisions activité',
  'Si intempéries',
  'Cahier papier',
  'Suivi COM',
  'Affichage COM',
  'Affichage STATUT',
] as const;

export type Cell = string | number | boolean | Date | null | undefined;

/* ---------- Répertoire des sites de Saint-Roch (géolocalisation par nom) ---------- */
export const SITES: { name: string; aliases: string[]; ll: LngLat }[] = [
  { name: "Place de l'Université du Québec", aliases: ['place de l universite du quebec', 'parvis de l universite', 'universite du quebec'], ll: uv(90, -30) },
  { name: 'Jardin de Saint-Roch', aliases: ['jardin de saint roch', 'jardin saint roch'], ll: uv(60, -90) },
  { name: 'Bibliothèque Gabrielle-Roy', aliases: ['gabrielle roy'], ll: uv(-40, 98) },
  { name: 'Église Saint-Roch', aliases: ['eglise saint roch', 'parvis de l eglise saint roch', 'parvis saint roch'], ll: uv(110, 100) },
  { name: 'Rue Saint-Joseph Est', aliases: ['rue saint joseph', 'saint joseph est'], ll: uv(40, 78) },
  { name: 'Rue de la Couronne', aliases: ['rue de la couronne'], ll: uv(-5, 160) },
  { name: 'Le Cercle', aliases: ['le cercle', 'cercle lab vivant'], ll: uv(-200, 92) },
  { name: 'Théâtre Impérial', aliases: ['imperial bell', 'theatre imperial', 'imperial'], ll: uv(-150, 64) },
  { name: 'Complexe Méduse', aliases: ['meduse'], ll: uv(200, -172) },
  { name: 'Parc des Pékans', aliases: ['parc des pekans', 'pekans'], ll: uv(-250, 182) },
  { name: 'Place Lorenzo-Verret', aliases: ['lorenzo verret'], ll: uv(-120, 60) },
  { name: 'Gare du Palais', aliases: ['gare du palais'], ll: [-71.21405, 46.81742] as LngLat },
  { name: 'Boulevard Charest Est', aliases: ['boulevard charest', 'charest est'], ll: uv(120, 0) },
  { name: 'Rue du Pont', aliases: ['rue du pont'], ll: uv(285, 80) },
  { name: 'Rue Dorchester', aliases: ['rue dorchester'], ll: uv(-185, 150) },
  { name: 'Centre communautaire L’Ancrage', aliases: ['ancrage'], ll: uv(-355, 300) },
  { name: 'Quartier Techno Hub', aliases: ['techno hub', 'quartier techno'], ll: uv(330, -14) },
  { name: 'Galerie Rouge Brique', aliases: ['rouge brique'], ll: uv(-14, 120) },
  { name: 'Parc Victoria', aliases: ['parc victoria'], ll: [-71.2305, 46.8176] as LngLat },
];

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’'`\-–—_,.;:()]/g, ' ').replace(/\s+/g, ' ').trim();

export function locateSite(raw: string): { name: string; ll: LngLat } | null {
  const parts = raw.split('/').map((p) => p.trim()).filter(Boolean);
  for (const part of parts.length ? parts : [raw]) {
    const n = norm(part);
    const hit = SITES.find((s) => s.aliases.some((a) => n.includes(a)) || n.includes(norm(s.name)));
    if (hit) return hit;
  }
  return null;
}

/** « 56;#Animation;#59;#Événement » → ['Animation', 'Événement'] */
export function lookupValues(v: Cell): string[] {
  const s = v == null ? '' : String(v).trim();
  if (!s) return [];
  if (!s.includes(';#')) return [s];
  const parts = s.split(';#');
  return parts.filter((_, i) => i % 2 === 1).map((x) => x.trim()).filter(Boolean);
}

function str(v: Cell): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

/** « 13/08/2026 00:00 » (jj/mm/aaaa hh:mm), date Excel ou ISO → Date */
export function parseDate(v: Cell): Date | null {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') return new Date(Date.UTC(1899, 11, 30) + v * 86400000);
  const s = str(v);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4] ?? 0), Number(m[5] ?? 0));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

const CATEGORY_RULES: [RegExp, EventCategory][] = [
  [/projection|cinema|exposition/, 'art'],
  [/musique|concert|spectacle|chanson|dj/, 'musique'],
  [/sport|course|plein air|activite physique|velo|danse/, 'sport'],
  [/famille|enfant|jeunesse/, 'famille'],
  [/gastronom|marche|biere|culinaire|salon|kiosque|food|bouffe/, 'gastronomie'],
  [/conference|atelier|formation|science|universit|patrimoine|savoir/, 'savoir'],
  [/benevol|communaut|citoyen|corvee|entraide/, 'communaute'],
  [/art|exposition|culture|cinema|theatre|litterature|festival|fete|animation/, 'art'],
];

/** Les groupes de champs sont examinés dans l'ordre (type d'activité, puis catégorie web, nature, titre). */
export function guessCategory(groups: string[][]): EventCategory {
  for (const g of groups) {
    const t = norm(g.join(' '));
    if (!t) continue;
    for (const [re, cat] of CATEGORY_RULES) if (re.test(t)) return cat;
  }
  return 'communaute';
}

export interface EventsParseResult { events: AppEvent[]; total: number; outside: number; skipped: number; missing: string[] }

export function parseEventRows(rows: Cell[][], opts: { onlySaintRoch?: boolean } = {}): EventsParseResult {
  const onlySaintRoch = opts.onlySaintRoch ?? true;
  const headerIdx = rows.findIndex((r) => r.some((c) => norm(str(c)) === 'titre projet'));
  if (headerIdx < 0) return { events: [], total: 0, outside: 0, skipped: rows.length, missing: ['Titre PROJET'] };
  const header = rows[headerIdx].map((c) => norm(str(c)));
  const col = (name: string) => header.indexOf(norm(name));
  const missing = ['Titre PROJET', "Site(s) de l'activité", 'Date et heure de début'].filter((n) => col(n) < 0);
  if (missing.length) return { events: [], total: 0, outside: 0, skipped: rows.length, missing };
  const get = (r: Cell[], name: string): Cell => (col(name) >= 0 ? r[col(name)] : undefined);

  const events: AppEvent[] = [];
  let outside = 0, skipped = 0, total = 0;
  rows.slice(headerIdx + 1).forEach((r, i) => {
    const title = str(get(r, 'Titre PROJET'));
    if (!title) return;
    total++;
    if (/ne pas diffuser/i.test(str(get(r, 'Diffusion COM')))) { skipped++; return; }
    const start = parseDate(get(r, 'Date et heure de début'));
    if (!start) { skipped++; return; }
    let end = parseDate(get(r, 'Date et heure de fin')) ?? new Date(start.getTime() + 3 * 3600e3);
    const sitesRaw = str(get(r, "Site(s) de l'activité"));
    const quartier = lookupValues(get(r, 'Quartier')).join(' ');
    const site = locateSite(sitesRaw);
    const inSaintRoch = !!site || /saint roch/.test(norm(quartier));
    if (onlySaintRoch && !inSaintRoch) { outside++; return; }
    const allDay = start.getHours() === 0 && start.getMinutes() === 0;
    if (end.getHours() === 0 && end.getMinutes() === 0) end = new Date(end.getTime() + 86399e3); // fin « 00:00 » = toute la journée
    if (end < start) end = new Date(start.getTime() + 3 * 3600e3);
    const webCats = lookupValues(get(r, 'Catégorie Web'));
    const type = lookupValues(get(r, "Type d'activité"));
    const nature = lookupValues(get(r, 'Nature '));
    const format = lookupValues(get(r, "Format de l'événement"));
    const venue = site?.name ?? (sitesRaw.split('/').map((p) => p.trim()).filter(Boolean)[0] || 'Saint-Roch');
    events.push({
      id: `ev-${i}-${norm(title).replace(/\s/g, '-').slice(0, 40)}`,
      title,
      category: guessCategory([type, webCats.filter((c) => !/^(evenement|animation)$/.test(norm(c))), nature, [title]]),
      venue,
      ll: site?.ll ?? uv(60, 60),
      approximate: !site,
      start: start.toISOString(),
      end: end.toISOString(),
      allDay,
      description: str(get(r, 'Description promotionnelle')) || str(get(r, 'Description (courte)')) || 'Description à venir.',
      organizer: str(get(r, 'Promoteur')) || str(get(r, "Unite administrative responsable de l'activité (R)")) || 'Ville de Québec',
      price: str(get(r, 'Coût')) || 'Non précisé',
      attendees: 0,
      tags: [...new Set([...format, ...webCats.filter((c) => c !== 'Événement')])].slice(0, 5),
      cover: i % 12,
      website: str(get(r, 'Site internet du promoteur')) || undefined,
      weather: str(get(r, 'Si intempéries')) || undefined,
      details: str(get(r, 'Précisions activité')) || undefined,
      sites: sitesRaw,
    });
  });
  return { events, total, outside, skipped, missing: [] };
}
