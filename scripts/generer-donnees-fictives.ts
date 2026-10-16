/**
 * Génère des fichiers FICTIFS au format exact des jeux de la Ville de Québec :
 *   public/donnees/eclairage.xlsx   → format « GI - LU quartier St-Roch » (éclairage public)
 *   public/donnees/evenements.xlsx  → format « Événements à venir »
 *
 *   npm run donnees:fictives
 *
 * Pour utiliser les vraies données, remplacez simplement ces deux fichiers
 * (même nom, .xlsx ou .csv). Les dates des événements sont calculées à partir d'aujourd'hui.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import writeXlsxFile from 'write-excel-file/node';
import { ALLEYS, STREETS, alleyEnds, intersection, pointOnStreet } from '../src/data/streets';
import { LngLat, rng, uv } from '../src/lib/geo';
import { mtm7ToWgs84 } from '../src/lib/lightingParse';
import { EVENT_COLUMNS } from '../src/lib/eventsParse';

const OUT = resolve('public/donnees');
mkdirSync(OUT, { recursive: true });
const r = rng(2026);
const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];

/* ---------- WGS84 → MTM zone 7 (inversion numérique de la conversion de l'application) ---------- */
function toMTM([lon, lat]: LngLat): [number, number] {
  let x = 249409.46 + (lon + 71.2258169) * 76226;
  let y = 5186072.461 + (lat - 46.8118925) * 111150;
  for (let i = 0; i < 6; i++) {
    const [lo, la] = mtm7ToWgs84(x, y);
    const [lox] = mtm7ToWgs84(x + 1, y);
    const [, lay] = mtm7ToWgs84(x, y + 1);
    x -= (lo - lon) / (lox - lo);
    y -= (la - lat) / (lay - la);
  }
  return [Math.round(x * 100) / 100, Math.round(y * 1000) / 1000];
}

/* ===================== ÉCLAIRAGE ===================== */
const LIGHT_COLUMNS = 'OBJECTID NO_SEQ CENTRE_CHAUSSEE_NO_SEQ CENTRE_INTERS_NO_SEQ TOPONYME_NO_SEQ COTE LECTURE_METRIQUE NUMERO_LECTURE NO_CIVIQUE SECTION_LIEU_PUBLIC INFO_GENERALE_NO_SEQ NO_EQUIPEMENT NO_LUMINAIRE NO_EQUIPEMENT_EE USAGE_PRINCIPAL_CODE MODELE_NO_SEQ MODELE_CODE MODELE_DESC ANNEE_INSTALLATION MONTAGE_DIVERS_EXISTE MONTAGE_DIVERS_CODE WATT_LAMPE_CODE VOLT_LAMPE_CODE WATT_VOLT_DESC SOURCE_LUMINAIRE_CODE CONTROLE_LUMINAIRE_CODE COULEUR_LUMINAIRE_CODE DISTRIBUTION_VERTICALE_LUMIERE DISTRIBUTION_LATERALE_LUMIERE POTENCE_EXISTE POTENCE_LONGUEUR_CODE POTENCE_MATERIEL_CODE POTENCE_MEMBRURE_CODE POTENCE_COULEUR_CODE PRECISION_POSITION STATUT_ACTIF COORDONNEE_X COORDONNEE_Y ROTATION SYMBOLOGIE TYPE_ENDROIT SEGMENT_CC_CI COTE_CC_CI NOM_TOPONYMIE DESCRIPTION_CC_CI_LIEU ARRONDISSEMENT_CODE'.split(' ');

const MODELS = {
  led: [{ seq: 112, code: 'DELURB', desc: 'DEL urbain (Québec)', w: [70, 90, 110] }],
  sodium: [
    { seq: 38, code: 'SEE22', desc: 'SEE-22 (Québec)', w: [150, 250] },
    { seq: 41, code: 'COB', desc: 'Cobra-head', w: [100, 150, 250] },
  ],
  deco: [{ seq: 57, code: 'LANT', desc: 'Lanterne patrimoniale', w: [100] }],
  mh: [{ seq: 64, code: 'MHPAR', desc: 'Projecteur halogénures', w: [175] }],
};

/** « Rue de la Couronne » → « De la Couronne, Rue » (forme du champ NOM_TOPONYMIE) */
function toponyme(name: string) {
  const [type, ...rest] = name.split(' ');
  const base = rest.join(' ');
  return `${base.charAt(0).toUpperCase()}${base.slice(1)}, ${type}`;
}

const lightRows: (string | number | Date | null)[][] = [];
let n = 0;
function addLamp(ll: LngLat, o: { street: string; from: string; to: string; side: string; kind: keyof typeof MODELS; usage: string; inactive?: boolean; civic: number; segment: number }) {
  n++;
  const m = pick(MODELS[o.kind]);
  const w = pick(m.w);
  const source = o.kind === 'led' ? 'LED' : o.kind === 'mh' ? 'MH' : 'HPS';
  const year = o.kind === 'led' ? 2018 + Math.floor(r() * 7) : o.kind === 'deco' ? 2005 + Math.floor(r() * 10) : 1984 + Math.floor(r() * 26);
  const [x, y] = toMTM(ll);
  const row: Record<string, string | number | Date | null> = {
    OBJECTID: 42000 + n, NO_SEQ: 101000 + n, CENTRE_CHAUSSEE_NO_SEQ: 105000 + o.segment, CENTRE_INTERS_NO_SEQ: null, TOPONYME_NO_SEQ: null,
    COTE: o.side, LECTURE_METRIQUE: null, NUMERO_LECTURE: 1, NO_CIVIQUE: o.civic, SECTION_LIEU_PUBLIC: null, INFO_GENERALE_NO_SEQ: 102000 + n,
    NO_EQUIPEMENT: 16000 + n, NO_LUMINAIRE: 1, NO_EQUIPEMENT_EE: `E-${16000 + n}`, USAGE_PRINCIPAL_CODE: o.usage, MODELE_NO_SEQ: m.seq,
    MODELE_CODE: m.code, MODELE_DESC: m.desc, ANNEE_INSTALLATION: new Date(Date.UTC(year, 0, 1)), MONTAGE_DIVERS_EXISTE: 'N', MONTAGE_DIVERS_CODE: null,
    WATT_LAMPE_CODE: `${w}W`, VOLT_LAMPE_CODE: 12, WATT_VOLT_DESC: `${w} W 120 V`, SOURCE_LUMINAIRE_CODE: source, CONTROLE_LUMINAIRE_CODE: 'AUC',
    COULEUR_LUMINAIRE_CODE: o.kind === 'deco' ? 'NO' : 'BV', DISTRIBUTION_VERTICALE_LUMIERE: null, DISTRIBUTION_LATERALE_LUMIERE: null,
    POTENCE_EXISTE: o.kind === 'deco' ? 'N' : 'O', POTENCE_LONGUEUR_CODE: o.kind === 'deco' ? null : pick(['1,8', '2,4', '3,0']), POTENCE_MATERIEL_CODE: o.kind === 'deco' ? null : 'AL',
    POTENCE_MEMBRURE_CODE: null, POTENCE_COULEUR_CODE: null, PRECISION_POSITION: 'AR', STATUT_ACTIF: o.inactive ? 'I' : 'A',
    COORDONNEE_X: x, COORDONNEE_Y: y, ROTATION: Math.round(r() * 3600) / 10, SYMBOLOGIE: 170042, TYPE_ENDROIT: 'T', SEGMENT_CC_CI: 1 + (o.segment % 30),
    COTE_CC_CI: null, NOM_TOPONYMIE: `${toponyme(o.street)} /  Québec`,
    DESCRIPTION_CC_CI_LIEU: `${toponyme(o.street)}    DE   ${toponyme(o.from)}    À   ${toponyme(o.to)}    --   Québec`, ARRONDISSEMENT_CODE: 1,
  };
  lightRows.push(LIGHT_COLUMNS.map((c) => row[c] ?? null));
}

let segment = 0;
for (const s of STREETS) {
  // Rues transversales, ordonnées le long de la rue
  const cross = STREETS.map((o) => ({ o, p: intersection(s, o) }))
    .filter((x) => x.p)
    .map((x) => ({ name: x.o.name, t: s.axis === 'ew' ? x.p![0] : x.p![1] }))
    .sort((a, b) => a.t - b.t);
  // Profil d'équipement : rues commerciales rénovées en DEL, boulevards au sodium haute pression,
  // quelques rues locales moins bien équipées (Saint-François, Commissaires)
  const kind: keyof typeof MODELS = s.kind === 'commerciale' ? 'led' : 'sodium';
  const weak = ['st-francois', 'commissaires'].includes(s.id);
  const spacing = s.kind === 'commerciale' ? 18 : s.kind === 'boulevard' ? 24 : weak ? 60 : 28;
  const bothSides = !weak;
  let lastBetween = '';
  for (let t = s.from + 8, k = 0; t <= s.to; t += spacing, k++) {
    const between = cross.filter((c) => c.t <= t).pop() ?? cross[0];
    const next = cross.find((c) => c.t > t) ?? cross[cross.length - 1];
    if (between?.name !== lastBetween) { segment++; lastBetween = between?.name ?? ''; }
    for (const side of bothSides ? [-1, 1] : [k % 2 ? -1 : 1]) {
      const off = side * 7 + (r() - 0.5) * 2;
      const shift = side === 1 ? 0 : spacing / 2;
      const tt = Math.min(s.to, t + shift);
      addLamp(pointOnStreet(s, tt, off), {
        street: s.name, from: between?.name ?? s.name, to: next?.name ?? s.name,
        side: s.axis === 'ew' ? (side > 0 ? 'N' : 'S') : side > 0 ? 'E' : 'O',
        kind: s.id === 'st-joseph' && r() < 0.25 ? 'deco' : kind, usage: 'RU',
        inactive: r() < 0.025, civic: 100 + Math.round((tt - s.from) / 4) * 2 + (side > 0 ? 1 : 0), segment,
      });
    }
  }
}
// Ruelles : peu ou pas éclairées
for (const a of ALLEYS) {
  const ends = alleyEnds(a);
  if (!ends || r() < 0.5) continue;
  const [[u1, v1], [u2, v2]] = ends;
  addLamp(uv((u1 + u2) / 2, (v1 + v2) / 2), { street: `Ruelle ${a.name.replace(/^(Ruelle|Passage) /, '')}`, from: a.name, to: a.name, side: 'N', kind: 'mh', usage: 'RL', civic: 0, segment: ++segment });
}
// Parcs et places
for (const [u, v, name] of [[60, -90, 'Jardin de Saint-Roch'], [-250, 182, 'Parc des Pékans'], [90, -30, "Place de l'Université-du-Québec"]] as const) {
  for (let i = 0; i < 6; i++) addLamp(uv(u + (r() - 0.5) * 50, v + (r() - 0.5) * 40), { street: `Parc ${name}`, from: name, to: name, side: 'N', kind: 'deco', usage: 'PA', civic: 0, segment: ++segment });
}

await writeXlsxFile([LIGHT_COLUMNS, ...lightRows] as never, { sheet: 'LU St-Roch', dateFormat: 'yyyy-mm-dd' }).toFile(resolve(OUT, 'eclairage.xlsx'));
console.log(`eclairage.xlsx : ${lightRows.length} luminaires fictifs`);

/* ===================== ÉVÉNEMENTS ===================== */
const pad = (x: number) => String(x).padStart(2, '0');
function when(dayOffset: number, h: number, m = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const Q_STROCH = '71;#Saint-Roch';
const Q_VQ = '68;#Vieux-Québec - Cap-Blanc - Colline parlementaire';
const Q_LIM = '74;#Vieux-Limoilou';
type E = Partial<Record<(typeof EVENT_COLUMNS)[number], string>>;
const base = (e: E): E => ({
  "Unite administrative responsable de l'activité (R)": '', "Unité administrative en soutien (S)": '', Arrondissement: '45;#ACL', 'Diffusion COM': 'À diffuser',
  'Type de représentation': 'Redirection vers site promoteur', 'Suivi COM': 'Diffusé', 'Affichage COM': 'Ne pas afficher', 'Affichage STATUT': 'Oui ', 'Cahier papier': '', ...e,
});

const EVENTS_ROWS: E[] = [
  // Ligne fournie en exemple (données publiques, conservée telle quelle)
  base({ 'Titre PROJET': 'Festibière de Québec 2026', Promoteur: 'Productions Culturelles Québec', 'Description (courte)': 'Salon de microbrasseries et animations', "Format de l'événement": '7;#Statique', Catégorie: "8;#B - D'envergure", 'Nature ': '25;#Culturel', "Type d'activité": '22;#Salon - Kiosque - Marché', "Site(s) de l'activité": " Quais d'Espace 400e / Place de l'Université du Québec /", Quartier: Q_VQ, 'Date et heure de début': '13/08/2026 00:00', 'Date et heure de fin': '16/08/2026 00:00', 'Catégorie Web': '56;#Animation;#59;#Événement;#69;#Fête et festival;#71;#Musique;#73;#Salon, kiosque et marché', Coût: 'Gratuit et payant', 'Site internet du promoteur': '' }),
  base({ 'Titre PROJET': 'Nuit lumineuse sur Saint-Joseph', Promoteur: 'SDC Centre-Ville (fictif)', 'Description (courte)': 'Projections et installations lumineuses', "Format de l'événement": '8;#Déambulatoire', Catégorie: '9;#C - Local', 'Nature ': '25;#Culturel', "Type d'activité": '31;#Animation urbaine', "Site(s) de l'activité": ' Rue Saint-Joseph Est (de la Couronne à du Pont) /', Quartier: Q_STROCH, 'Date et heure de début': when(0, 19), 'Date et heure de fin': when(0, 23), 'Description promotionnelle': 'Projections monumentales, installations lumineuses et DJ sur la rue piétonne. Une soirée pour redécouvrir le quartier autrement.', 'Catégorie Web': '56;#Animation;#59;#Événement;#80;#Arts visuels', Coût: 'Gratuit', 'Site internet du promoteur': 'www.exemple-sdc-centreville.ca', 'Si intempéries': 'Remis au lendemain' }),
  base({ 'Titre PROJET': 'Jazz au Cercle — Trio Basse-Ville', Promoteur: 'Le Cercle (fictif)', 'Description (courte)': 'Soirée jazz intime', "Format de l'événement": '7;#Statique', Catégorie: '9;#C - Local', 'Nature ': '25;#Culturel', "Type d'activité": '24;#Spectacle', "Site(s) de l'activité": ' Le Cercle /', Quartier: Q_STROCH, 'Date et heure de début': when(0, 21), 'Date et heure de fin': when(0, 23, 30), 'Description promotionnelle': 'Soirée jazz intime avec un trio local et invités surprises.', 'Catégorie Web': '71;#Musique;#75;#Spectacle', Coût: '25 $' }),
  base({ 'Titre PROJET': "Marché d'automne du Jardin", Promoteur: 'Marché public (fictif)', 'Description (courte)': 'Producteurs régionaux et dégustations', "Format de l'événement": '7;#Statique', Catégorie: '9;#C - Local', 'Nature ': '26;#Commercial', "Type d'activité": '22;#Salon - Kiosque - Marché', "Site(s) de l'activité": ' Jardin de Saint-Roch /', Quartier: Q_STROCH, 'Date et heure de début': when(1, 10), 'Date et heure de fin': when(1, 17), 'Description promotionnelle': 'Producteurs de la région, courges, cidres et pâtisseries. Animation musicale et dégustations.', 'Catégorie Web': '73;#Salon, kiosque et marché;#62;#Famille', Coût: 'Gratuit', 'Si intempéries': 'Sous chapiteau' }),
  base({ 'Titre PROJET': 'Conférence : la ville apprenante', Promoteur: 'Université du Québec (fictif)', 'Description (courte)': 'Table ronde sur le quartier universitaire', "Format de l'événement": '7;#Statique', Catégorie: '9;#C - Local', 'Nature ': '27;#Éducatif', "Type d'activité": '28;#Conférence', "Site(s) de l'activité": " Place de l'Université du Québec /", Quartier: Q_STROCH, 'Date et heure de début': when(2, 18, 30), 'Date et heure de fin': when(2, 20), 'Description promotionnelle': 'Comment un quartier universitaire peut-il revitaliser un centre-ville ? Table ronde avec chercheurs et organismes du milieu.', 'Catégorie Web': '65;#Conférence et atelier', Coût: 'Gratuit (inscription requise)' }),
  base({ 'Titre PROJET': 'Course nocturne 5 km du Pont', Promoteur: 'Les Coureurs du Roch (fictif)', 'Description (courte)': 'Course éclairée en soirée', "Format de l'événement": '8;#Déambulatoire', Catégorie: '9;#C - Local', 'Nature ': '28;#Sportif', "Type d'activité": '33;#Course', "Site(s) de l'activité": ' Rue du Pont / Parc Victoria /', Quartier: Q_STROCH, 'Date et heure de début': when(3, 19, 30), 'Date et heure de fin': when(3, 21), 'Description promotionnelle': 'Parcours éclairé de 5 km à travers Saint-Roch et le long de la rivière Saint-Charles.', 'Catégorie Web': '77;#Sport et plein air', Coût: '15 $', 'Précisions activité': 'Lampes frontales fournies' }),
  base({ 'Titre PROJET': 'Atelier BD jeunesse', Promoteur: 'Bibliothèque de Québec', 'Description (courte)': 'Initiation à la bande dessinée', "Format de l'événement": '7;#Statique', Catégorie: '9;#C - Local', 'Nature ': '27;#Éducatif', "Type d'activité": '29;#Atelier', "Site(s) de l'activité": ' Bibliothèque Gabrielle-Roy /', Quartier: Q_STROCH, 'Date et heure de début': when(4, 13, 30), 'Date et heure de fin': when(4, 15, 30), 'Description promotionnelle': 'Initiation à la bande dessinée pour les 8-12 ans avec une illustratrice québécoise.', 'Catégorie Web': '62;#Famille;#65;#Conférence et atelier', Coût: 'Gratuit' }),
  base({ 'Titre PROJET': 'Vernissage — Murs de Saint-Roch', Promoteur: 'Galerie Rouge Brique (fictif)', 'Description (courte)': "Exposition photo d'art public", "Format de l'événement": '7;#Statique', Catégorie: '9;#C - Local', 'Nature ': '25;#Culturel', "Type d'activité": '23;#Exposition', "Site(s) de l'activité": ' Galerie Rouge Brique /', Quartier: Q_STROCH, 'Date et heure de début': when(5, 17), 'Date et heure de fin': when(5, 20), 'Description promotionnelle': 'Exposition photo des murales et œuvres d’art public du quartier. Rencontre avec les artistes.', 'Catégorie Web': '80;#Arts visuels', Coût: 'Gratuit' }),
  base({ 'Titre PROJET': 'Grande corvée de propreté', Promoteur: 'Centre communautaire L’Ancrage (fictif)', 'Description (courte)': 'Corvée citoyenne', "Format de l'événement": '8;#Déambulatoire', Catégorie: '9;#C - Local', 'Nature ': '29;#Communautaire', "Type d'activité": '35;#Activité citoyenne', "Site(s) de l'activité": ' Parc des Pékans /', Quartier: Q_STROCH, 'Date et heure de début': when(6, 9, 30), 'Date et heure de fin': when(6, 12), 'Description promotionnelle': 'Nettoyons ensemble les parcs et ruelles. Gants, sacs et café fournis.', 'Catégorie Web': '82;#Bénévolat et communauté', Coût: 'Gratuit' }),
  base({ 'Titre PROJET': "Concert d'orgue à l'Église Saint-Roch", Promoteur: 'Fabrique Saint-Roch (fictif)', 'Description (courte)': 'Récital orgue et chœur', "Format de l'événement": '7;#Statique', Catégorie: '9;#C - Local', 'Nature ': '25;#Culturel', "Type d'activité": '24;#Spectacle', "Site(s) de l'activité": ' Église Saint-Roch /', Quartier: Q_STROCH, 'Date et heure de début': when(8, 19, 30), 'Date et heure de fin': when(8, 21), 'Description promotionnelle': 'Récital d’orgue et chœur dans l’acoustique exceptionnelle de la plus grande église de Québec.', 'Catégorie Web': '71;#Musique', Coût: '20 $' }),
  base({ 'Titre PROJET': 'Rallye des camions de rue', Promoteur: 'Collectif Bouffe de rue (fictif)', 'Description (courte)': 'Cuisine de rue', "Format de l'événement": '7;#Statique', Catégorie: "8;#B - D'envergure", 'Nature ': '26;#Commercial', "Type d'activité": '22;#Salon - Kiosque - Marché', "Site(s) de l'activité": " Place de l'Université du Québec / Boulevard Charest Est /", Quartier: Q_STROCH, 'Date et heure de début': when(10, 11), 'Date et heure de fin': when(10, 20), 'Description promotionnelle': 'Une douzaine de camions de cuisine de rue, musique et tables à pique-nique.', 'Catégorie Web': '73;#Salon, kiosque et marché;#62;#Famille', Coût: 'Entrée libre' }),
  base({ 'Titre PROJET': 'Hackathon Saint-Roch 2026 — Finale', Promoteur: 'Quartier Techno Hub (fictif)', 'Description (courte)': 'Présentation des projets', "Format de l'événement": '7;#Statique', Catégorie: '9;#C - Local', 'Nature ': '27;#Éducatif', "Type d'activité": '28;#Conférence', "Site(s) de l'activité": ' Quartier Techno Hub /', Quartier: Q_STROCH, 'Date et heure de début': when(12, 9), 'Date et heure de fin': when(12, 17), 'Description promotionnelle': 'Présentation des projets citoyens et technologiques pour la revitalisation du quartier.', 'Catégorie Web': '65;#Conférence et atelier', Coût: 'Gratuit' }),
  base({ 'Titre PROJET': 'Bal de rue latino', Promoteur: 'Studio Danse Couronne (fictif)', 'Description (courte)': 'Initiation et bal ouvert', "Format de l'événement": '7;#Statique', Catégorie: '9;#C - Local', 'Nature ': '25;#Culturel', "Type d'activité": '31;#Animation urbaine', "Site(s) de l'activité": ' Rue de la Couronne /', Quartier: Q_STROCH, 'Date et heure de début': when(14, 19), 'Date et heure de fin': when(14, 23), 'Description promotionnelle': 'Initiation à la salsa et à la bachata, puis bal ouvert à tous sous les guirlandes.', 'Catégorie Web': '56;#Animation;#71;#Musique', Coût: 'Gratuit', 'Si intempéries': 'Annulé' }),
  base({ 'Titre PROJET': 'Festival des lumières d’hiver', Promoteur: 'Ville de Québec (fictif)', 'Description (courte)': 'Parcours lumineux sur plusieurs jours', "Format de l'événement": '8;#Déambulatoire', Catégorie: "8;#B - D'envergure", 'Nature ': '25;#Culturel', "Type d'activité": '31;#Animation urbaine', "Site(s) de l'activité": ' Jardin de Saint-Roch / Rue Saint-Joseph Est /', Quartier: Q_STROCH, 'Date et heure de début': when(30, 0), 'Date et heure de fin': when(40, 0), 'Description promotionnelle': 'Dix jours d’installations lumineuses interactives dans le quartier.', 'Catégorie Web': '69;#Fête et festival;#80;#Arts visuels', Coût: 'Gratuit' }),
  base({ 'Titre PROJET': 'Marché de Noël de Saint-Roch', Promoteur: 'SDC Centre-Ville (fictif)', 'Description (courte)': 'Artisans et produits locaux', "Format de l'événement": '7;#Statique', Catégorie: "8;#B - D'envergure", 'Nature ': '26;#Commercial', "Type d'activité": '22;#Salon - Kiosque - Marché', "Site(s) de l'activité": " Parvis de l'église Saint-Roch /", Quartier: Q_STROCH, 'Date et heure de début': when(50, 0), 'Date et heure de fin': when(60, 0), 'Description promotionnelle': 'Chalets d’artisans, vin chaud et chorales sur le parvis de l’église.', 'Catégorie Web': '73;#Salon, kiosque et marché;#62;#Famille', Coût: 'Gratuit' }),
  base({ 'Titre PROJET': 'Soirée de contes à la Bibliothèque', Promoteur: 'Bibliothèque de Québec', 'Description (courte)': 'Contes pour adultes', "Format de l'événement": '7;#Statique', Catégorie: '9;#C - Local', 'Nature ': '25;#Culturel', "Type d'activité": '24;#Spectacle', "Site(s) de l'activité": ' Bibliothèque Gabrielle-Roy /', Quartier: Q_STROCH, 'Date et heure de début': when(18, 19), 'Date et heure de fin': when(18, 21), 'Description promotionnelle': 'Trois conteurs, une soirée chaleureuse au cœur de la bibliothèque.', 'Catégorie Web': '75;#Spectacle', Coût: 'Gratuit' }),
  base({ 'Titre PROJET': 'Atelier vélo d’hiver', Promoteur: 'Vélo Roch (fictif)', 'Description (courte)': 'Préparer son vélo pour l’hiver', "Format de l'événement": '7;#Statique', Catégorie: '9;#C - Local', 'Nature ': '28;#Sportif', "Type d'activité": '29;#Atelier', "Site(s) de l'activité": ' Place Lorenzo-Verret /', Quartier: Q_STROCH, 'Date et heure de début': when(21, 10), 'Date et heure de fin': when(21, 14), 'Description promotionnelle': 'Mécanique de base, pneus à crampons et éclairage : roulez en sécurité tout l’hiver.', 'Catégorie Web': '77;#Sport et plein air', Coût: 'Gratuit' }),
  base({ 'Titre PROJET': 'Exposition Méduse : Matières urbaines', Promoteur: 'Complexe Méduse (fictif)', 'Description (courte)': 'Art contemporain', "Format de l'événement": '7;#Statique', Catégorie: '9;#C - Local', 'Nature ': '25;#Culturel', "Type d'activité": '23;#Exposition', "Site(s) de l'activité": ' Complexe Méduse /', Quartier: Q_STROCH, 'Date et heure de début': when(7, 0), 'Date et heure de fin': when(45, 0), 'Description promotionnelle': 'Six artistes explorent les matériaux de la ville en transformation.', 'Catégorie Web': '80;#Arts visuels', Coût: '5 $' }),
  base({ 'Titre PROJET': 'Cinéma en plein air (fictif)', Promoteur: 'Ciné-Quartier (fictif)', 'Description (courte)': 'Projection extérieure', "Format de l'événement": '7;#Statique', Catégorie: '9;#C - Local', 'Nature ': '25;#Culturel', "Type d'activité": '25;#Projection', "Site(s) de l'activité": ' Ruelle verte du quartier (site à confirmer) /', Quartier: Q_STROCH, 'Date et heure de début': when(16, 19, 30), 'Date et heure de fin': when(16, 22), 'Description promotionnelle': 'Projection d’un film d’animation québécois. Apportez votre chaise !', 'Catégorie Web': '67;#Cinéma;#62;#Famille', Coût: 'Gratuit', 'Si intempéries': 'Remis' }),
  base({ 'Titre PROJET': 'Réunion de planification interne', Promoteur: 'Ville de Québec', 'Description (courte)': 'Activité non publique', "Format de l'événement": '7;#Statique', Catégorie: '9;#C - Local', 'Nature ': '30;#Administratif', "Type d'activité": '36;#Autre', "Site(s) de l'activité": " Place de l'Université du Québec /", Quartier: Q_STROCH, 'Date et heure de début': when(9, 9), 'Date et heure de fin': when(9, 11), 'Diffusion COM': 'Ne pas diffuser', Coût: '' }),
  // Hors Saint-Roch : présents dans le fichier de la Ville, filtrés par l'application
  base({ 'Titre PROJET': 'Spectacle sur les Plaines', Promoteur: 'Productions fictives', 'Description (courte)': 'Grand spectacle extérieur', "Format de l'événement": '7;#Statique', Catégorie: "7;#A - Majeur", 'Nature ': '25;#Culturel', "Type d'activité": '24;#Spectacle', "Site(s) de l'activité": " Plaines d'Abraham /", Quartier: '69;#Montcalm', 'Date et heure de début': when(11, 20), 'Date et heure de fin': when(11, 23), 'Catégorie Web': '71;#Musique', Coût: 'Payant' }),
  base({ 'Titre PROJET': 'Marché de Limoilou', Promoteur: 'Marché fictif', 'Description (courte)': 'Marché de quartier', "Format de l'événement": '7;#Statique', Catégorie: '9;#C - Local', 'Nature ': '26;#Commercial', "Type d'activité": '22;#Salon - Kiosque - Marché', "Site(s) de l'activité": ' Parc Cartier-Brébeuf /', Quartier: Q_LIM, 'Date et heure de début': when(4, 10), 'Date et heure de fin': when(4, 16), 'Catégorie Web': '73;#Salon, kiosque et marché', Coût: 'Gratuit' }),
  base({ 'Titre PROJET': 'Visite guidée du Vieux-Port', Promoteur: 'Guides fictifs', 'Description (courte)': 'Visite patrimoniale', "Format de l'événement": '8;#Déambulatoire', Catégorie: '9;#C - Local', 'Nature ': '25;#Culturel', "Type d'activité": '34;#Visite', "Site(s) de l'activité": ' Place des Canotiers /', Quartier: Q_VQ, 'Date et heure de début': when(6, 14), 'Date et heure de fin': when(6, 16), 'Catégorie Web': '84;#Patrimoine', Coût: '12 $' }),
];

const eventRows = [[...EVENT_COLUMNS], ...EVENTS_ROWS.map((e) => EVENT_COLUMNS.map((c) => e[c] ?? ''))];
await writeXlsxFile(eventRows as never, { sheet: 'Événements' }).toFile(resolve(OUT, 'evenements.xlsx'));
console.log(`evenements.xlsx : ${EVENTS_ROWS.length} événements fictifs`);

/* ===================== REGISTRE DES ENTREPRISES ===================== */
// Les 4 premières lignes proviennent de l'exemple fourni ; toutes les autres sont fictives.
const BIZ_STREETS: [string, string, number][] = [
  ['Rue', 'Saint-Joseph Est', 22], ['Boulevard', 'Charest Est', 16], ['Rue', 'de la Couronne', 12], ['Rue', 'du Pont', 9], ['Rue', 'Dorchester', 8],
  ['Rue', 'du Roi', 7], ['Rue', 'Saint-Vallier Est', 7], ['Rue', 'de la Reine', 5], ['Rue', 'du Prince-Édouard', 5], ['Rue', 'Caron', 4],
  ['Boulevard', 'Langelier', 4], ['Rue', 'Saint-François Est', 3], ['Rue', 'de la Croix-Rouge', 2], ['Boulevard', 'Jean-Lesage', 2],
  ['Rue', 'de la Chapelle', 2], ['Rue', 'de la Gare-du-Palais', 2],
  // Rues hors du réseau simplifié de l'application (pour tester les « rues inconnues »)
  ['Rue', 'Saint-Anselme', 1], ['Rue', "de l'Église", 1],
];
const BIZ_NAMES: Record<string, { w: number; a: string[]; b: string[] }> = {
  restaurant: { w: 18, a: ['Bistro', 'Brasserie', 'Cantine', 'Pizzeria', 'Comptoir', 'Taverne', 'Resto', 'Sushi', 'Ramen', 'Grill'], b: ['du Roch', 'Basse-Ville', 'Le Faubourg', 'du Parvis', 'La Fabrique', 'Le Quai', 'Saint-Vallier', 'des Artisans', 'Le Tramway', 'Couronne', 'Boréal', 'du Jardin', 'Charest', 'La Cour', 'Le Comptoir'] },
  cafe: { w: 7, a: ['Café', 'Boulangerie', 'Pâtisserie', 'Torréfacteur', 'Salon de thé'], b: ['Ronde', 'du Coin', 'Saint-Roch', 'La Mie', 'Le Grain', 'Matin', 'Aube', 'Givre'] },
  commerce: { w: 30, a: ['Boutique', 'Friperie', 'Épicerie', 'Fleuriste', 'Librairie', 'Quincaillerie', 'Optique', 'Dépanneur', 'Atelier vélo', 'Magasin', 'Bijouterie', 'Chaussures'], b: ['Orange', 'du Quartier', 'Lumière', 'Fil Rouge', 'Le Comptoir', 'Bleu Marine', 'Saint-Joseph', 'Nordique', 'Mélisse', 'Cerise', 'Le Repère', 'Ardoise', 'Simone', 'Odette', 'Gaston'] },
  services: { w: 20, a: ['Cabinet', 'Clinique', 'Notaires', 'Avocats', 'Comptables', 'Assurances', 'Coiffure', 'Architectes', 'Physiothérapie', 'Courtier immobilier', 'Dentistes'], b: ['Tremblay & associés', 'Gagnon Roy', 'Basse-Ville', 'Côté Lavoie', 'du Centre', 'Bouchard Pelletier', 'Saint-Roch', 'Morin Fortin', 'Boréal', 'Lapointe'] },
  techno: { w: 10, a: ['Studio', 'Labs', 'Interactive', 'Numérique', 'Games', 'Data'], b: ['Pixel Nord', 'Hélix', 'Basse-Ville', 'Orbite', 'Quai 5', 'Polaris', 'Atome', 'Ricochet', 'Brume'] },
  hotel: { w: 3, a: ['Hôtel', 'Auberge', 'Suites', 'Résidence de tourisme'], b: ['du Faubourg', 'Saint-Roch', 'Le Rempart', 'La Gare', 'Couronne'] },
  organisme: { w: 7, a: ['Coopérative', 'Fondation', 'Association', 'Maison des', 'Centre communautaire'], b: ['du quartier', 'Saint-Roch', 'jeunes du centre', 'aînés', 'L’Escale', 'Le Pont'] },
  culture: { w: 5, a: ['Galerie', 'Théâtre', 'Productions', 'Salle', 'Atelier d’art'], b: ['Rouge', 'La Boîte noire', 'Saint-Roch', 'Le Hangar', 'Mosaïque'] },
};
const bizRows: string[][] = [
  ['Rue', 'Caron', 'Le Passage (Résidence de tourisme)'],
  ['Rue', 'Caron', 'Guerin Tremblay Blouin Morneau Avocats'],
  ['Boulevard', 'Charest Est', 'Familiprix'],
  ['Boulevard', 'Charest Est', 'Rodeo FX'],
];
const usedNames = new Set(bizRows.map((x) => x[2]));
const streetPool = BIZ_STREETS.flatMap(([t, n, w]) => Array.from({ length: w }, () => [t, n] as const));
const catPool = Object.entries(BIZ_NAMES).flatMap(([c, v]) => Array.from({ length: v.w }, () => c));
let guard = 0;
while (bizRows.length < 514 && guard++ < 20000) {
  const c = BIZ_NAMES[pick(catPool)];
  const name = `${pick(c.a)} ${pick(c.b)}`;
  if (usedNames.has(name)) continue;
  usedNames.add(name);
  const [t, st] = pick(streetPool);
  bizRows.push([t, st, name]);
}
await writeXlsxFile([['Type rue', 'Nom rue', 'Marque de Commerce'], ...bizRows] as never, { sheet: 'Entreprises' }).toFile(resolve(OUT, 'commerces.xlsx'));
console.log(`commerces.xlsx : ${bizRows.length} entreprises (4 de l'exemple + fictives)`);

/* ===================== STATIONNEMENTS MUNICIPAUX HORS RUE (GeoJSON) ===================== */
// Même structure que « StationnementsMunicipauxHorsRues » ; noms, adresses et capacités fictifs.
const LOTS: [string, string, number, 'Intérieur' | 'Extérieur', number, number, string][] = [
  ['Stationnement de la Couronne', '400, rue de la Couronne', 420, 'Intérieur', 30, 20, 'Saint-Roch'],
  ['Stationnement Gabrielle-Roy', '350, rue Saint-Joseph Est', 260, 'Intérieur', -60, 115, 'Saint-Roch'],
  ['Stationnement Charest-Est', '700, boulevard Charest Est', 180, 'Extérieur', 200, -20, 'Saint-Roch'],
  ['Stationnement de la Gare', 'Rue de la Gare-du-Palais', 310, 'Extérieur', 940, 120, 'Saint-Roch'],
  ['Stationnement Langelier', 'Boulevard Langelier', 90, 'Extérieur', -560, 50, 'Saint-Roch'],
  ['Stationnement du Pont', '200, rue du Pont', 75, 'Extérieur', 300, 300, 'Saint-Roch'],
  ['Stationnement Dorchester', '515, rue Dorchester', 140, 'Intérieur', -195, 250, 'Saint-Roch'],
  ['Stationnement du Jardin', 'Rue Saint-Vallier Est', 60, 'Extérieur', -80, -110, 'Saint-Roch'],
];
const geojson = {
  type: 'FeatureCollection',
  name: 'StationnementsMunicipauxHorsRues',
  features: LOTS.map(([nom, adresse, cases, type, u, v, quartier]) => {
    const [lon, lat] = uv(u, v);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [Math.round(lon * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6] },
      properties: { ARRONDISSEMENT: 'La Cité-Limoilou', QUARTIER: quartier, NOM: nom, ADRESSE_À_PROXIMITÉ: adresse, NOMBRE_DE_CASES: cases, TYPE_INT_EXT: type },
    };
  }),
};
writeFileSync(resolve(OUT, 'stationnements.geojson'), JSON.stringify(geojson, null, '\t'));
console.log(`stationnements.geojson : ${LOTS.length} stationnements municipaux fictifs`);

/* ===================== LISTE DES INSTALLATIONS ===================== */
// Première ligne : exemple fourni. Les autres sont fictives ; quelques-unes hors Saint-Roch (filtrées par l'application).
const INSTALLATIONS: [string, string, string, string, string][] = [
  ['ACL', 'Bibliothèque Gabrielle-Roy', 'Bibliothèque', '350 Rue Saint-Joseph E, Québec, QC G1K 2T6', 'B0017-1'],
  ['ACL', 'Centre communautaire Saint-Roch', 'Centre communautaire', '230 Rue du Prince-Édouard, Québec, QC G1K 2M4', 'C0102-1'],
  ['ACL', 'Gymnase de l’école du Roi', 'Gymnase', '310 Rue du Roi, Québec, QC G1K 2W5', 'G0211-1'],
  ['ACL', 'Jardin de Saint-Roch', 'Parc', '410 Rue Saint-Vallier E, Québec, QC G1K 3P1', 'P0450-1'],
  ['ACL', 'Parc des Pékans', 'Parc', '255 Rue Saint-François E, Québec, QC G1K 2X9', 'P0461-1'],
  ['ACL', 'Aire de jeux de la Reine', 'Aire de jeux', '480 Rue de la Reine, Québec, QC G1K 2R4', 'P0472-1'],
  ['ACL', 'Maison des jeunes du Pont', 'Maison des jeunes', '150 Rue du Pont, Québec, QC G1K 6M1', 'C0115-1'],
  ['ACL', 'Plateau sportif Dorchester', 'Plateau sportif', '520 Rue Dorchester, Québec, QC G1K 5Z9', 'S0320-1'],
  ['ACL', 'Patinoire extérieure du Jardin', 'Patinoire', '420 Rue Saint-Vallier E, Québec, QC G1K 3P1', 'S0331-1'],
  ['ACL', 'Centre des aînés de la Couronne', 'Centre des aînés', '460 Rue de la Couronne, Québec, QC G1K 6E9', 'C0128-1'],
  ['ACL', 'Salle communautaire Caron', 'Local communautaire', '190 Rue Caron, Québec, QC G1K 5V3', 'C0133-1'],
  ['ACL', 'Jeux d’eau Langelier', 'Jeux d\'eau', '120 Boulevard Langelier, Québec, QC G1K 5N4', 'S0342-1'],
  ['ACL', 'Bureau d’arrondissement (point de service)', 'Bureau administratif', '650 Boulevard Charest E, Québec, QC G1K 3J9', 'A0010-1'],
  ['ACL', 'Place de la Gare', 'Place publique', '450 Rue de la Gare-du-Palais, Québec, QC G1K 3X2', 'P0480-1'],
  ['ACL', 'Centre de loisirs du Prince-Édouard', 'Centre de loisirs', '520 Rue du Prince-Édouard, Québec, QC G1K 2N1', 'C0140-1'],
  // Hors Saint-Roch
  ['ACL', 'Bibliothèque Saint-Jean-Baptiste (fictif)', 'Bibliothèque', '755 Rue Saint-Jean, Québec, QC G1R 1R1', 'B0021-1'],
  ['ACL', 'Aréna de Limoilou (fictif)', 'Aréna', '1100 3e Avenue, Québec, QC G1L 2X4', 'S0101-1'],
  ['SFL', 'Piscine de Sainte-Foy (fictif)', 'Piscine', '930 Avenue Roland-Beaudin, Québec, QC G1V 4H8', 'S0205-1'],
  ['CHA', 'Centre communautaire de Charlesbourg (fictif)', 'Centre communautaire', '7950 1re Avenue, Québec, QC G1H 2Y4', 'C0301-1'],
  ['BEA', 'Parc de la Plage-Jacques-Cartier (fictif)', 'Parc', '3635 Chemin du Fleuve, Québec, QC G1W 4Z8', 'P0901-1'],
];
const insRows = INSTALLATIONS.map(([arr, nom, type, adresse, code]) => [arr, `${nom} - ${type} - ${arr} - ${code}`, adresse, type]);
await writeXlsxFile([['Arrondissement_0', 'Nom_Type_No_Installation_calculé', 'Adresse', "Type d'équipement texte"], ...insRows] as never, { sheet: 'Installations' }).toFile(resolve(OUT, 'installations.xlsx'));
console.log(`installations.xlsx : ${insRows.length} installations (1 de l'exemple + fictives, dont 5 hors Saint-Roch)`);

/* Arrêts d'autobus : public/donnees/stops.txt est le vrai fichier du GTFS du RTC (non généré). */
