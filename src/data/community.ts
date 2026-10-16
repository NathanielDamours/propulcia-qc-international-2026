import { LngLat, uv } from '../lib/geo';

/* ===================== GROUPES ===================== */
export type GroupCategory = 'etudiants' | 'sorties' | 'sports' | 'culture' | 'benevolat' | 'famille';
export interface GroupActivity { id: string; title: string; when: string; where: string }
export interface ChatMessage { id: string; author: string; text: string; time: string; me?: boolean }
export interface Group {
  id: string;
  name: string;
  category: GroupCategory;
  description: string;
  members: number;
  admins: string[];
  activities: GroupActivity[];
  messages: ChatMessage[];
  tags: string[];
  /** Groupe créé dans l'application (cet appareil) */
  userCreated?: boolean;
}

export const GROUP_META: Record<GroupCategory, { label: string; color: string; gradient: [string, string]; icon: string }> = {
  etudiants: { label: 'Étudiants', color: '#3B82F6', gradient: ['#4776E6', '#8E54E9'], icon: 'graduation-cap' },
  sorties: { label: 'Sorties', color: '#EC4899', gradient: ['#EE0979', '#FF6A00'], icon: 'party-popper' },
  sports: { label: 'Sports', color: '#10B981', gradient: ['#0BA360', '#3CBA92'], icon: 'dumbbell' },
  culture: { label: 'Culture', color: '#8B5CF6', gradient: ['#834D9B', '#D04ED6'], icon: 'drama' },
  benevolat: { label: 'Bénévolat', color: '#F59E0B', gradient: ['#F09819', '#EDDE5D'], icon: 'hand-heart' },
  famille: { label: 'Famille', color: '#14B8A6', gradient: ['#1D976C', '#93F9B9'], icon: 'baby' },
};

export const GROUPS: Group[] = [
  {
    id: 'g-etudiants', name: 'Étudiants de Saint-Roch', category: 'etudiants', members: 418, admins: ['Léa M.', 'Karim B.'],
    description: 'Le point de rencontre des étudiant·e·s de l’UQ, de l’ENAP, de l’INRS, de la TÉLUQ et des cégeps du centre-ville : entraide, colocs, sorties et bons plans.',
    activities: [
      { id: 'a1', title: 'Soirée d’accueil des nouveaux', when: 'Jeudi · 18 h', where: 'Brasserie La Couronne' },
      { id: 'a2', title: 'Session d’étude en groupe', when: 'Dimanche · 13 h', where: 'Bibliothèque Gabrielle-Roy' },
    ],
    messages: [
      { id: 'm1', author: 'Léa M.', text: 'Bienvenue à tous les nouveaux ! N’hésitez pas à vous présenter 👋', time: '09:12' },
      { id: 'm2', author: 'Samuel T.', text: 'Quelqu’un a une chambre à louer près de la rue du Roi pour janvier ?', time: '10:04' },
      { id: 'm3', author: 'Karim B.', text: 'Rappel : soirée d’accueil jeudi, on réserve une grande table 🍻', time: '11:30' },
    ],
    tags: ['Entraide', 'Logement', 'Sorties'],
  },
  {
    id: 'g-coureurs', name: 'Les Coureurs du Roch', category: 'sports', members: 156, admins: ['Mathieu G.'],
    description: 'Course à pied en groupe, tous niveaux. Parcours éclairés en soirée le long de la rivière Saint-Charles.',
    activities: [
      { id: 'a1', title: 'Sortie 5 km tranquille', when: 'Mardi · 18 h 30', where: 'Départ Jardin de Saint-Roch' },
      { id: 'a2', title: 'Fractionné', when: 'Samedi · 8 h', where: 'Parc Victoria' },
    ],
    messages: [
      { id: 'm1', author: 'Mathieu G.', text: 'On garde le parcours de la rue Saint-Joseph ce soir, mieux éclairé 👍', time: '16:40' },
      { id: 'm2', author: 'Inès R.', text: 'Je serai là ! Quelqu’un a une lampe frontale de trop ?', time: '17:02' },
    ],
    tags: ['Course', 'Soirée'],
  },
  {
    id: 'g-sorties', name: 'Sorties & découvertes', category: 'sorties', members: 289, admins: ['Camille D.'],
    description: 'Spectacles, nouveaux restos, 5 à 7 : on découvre Saint-Roch ensemble, sans se ruiner.',
    activities: [{ id: 'a1', title: 'Jazz au Cercle', when: 'Ce soir · 21 h', where: 'Le Cercle' }],
    messages: [
      { id: 'm1', author: 'Camille D.', text: 'Qui vient au jazz ce soir ? On se rejoint devant à 20 h 45.', time: '12:15' },
      { id: 'm2', author: 'Olivier P.', text: 'Partant ! Je ramène deux amis.', time: '12:40' },
    ],
    tags: ['Spectacles', 'Restos'],
  },
  {
    id: 'g-culture', name: 'Art public & patrimoine', category: 'culture', members: 97, admins: ['Hélène V.'],
    description: 'Balades commentées pour découvrir les murales, sculptures et bâtiments patrimoniaux du quartier.',
    activities: [{ id: 'a1', title: 'Balade des murales', when: 'Samedi · 14 h', where: 'Église Saint-Roch' }],
    messages: [{ id: 'm1', author: 'Hélène V.', text: 'Prochaine balade : les œuvres de la rue de la Couronne 🎨', time: '08:55' }],
    tags: ['Murales', 'Histoire'],
  },
  {
    id: 'g-benevoles', name: 'Bénévoles du quartier', category: 'benevolat', members: 203, admins: ['Nadia L.'],
    description: 'Repas communautaires, corvées de propreté, accompagnement : donnez un coup de main aux organismes de Saint-Roch.',
    activities: [
      { id: 'a1', title: 'Grande corvée de propreté', when: 'Samedi · 9 h 30', where: 'Parc des Pékans' },
      { id: 'a2', title: 'Service du repas communautaire', when: 'Mercredi · 11 h', where: 'Centre L’Ancrage' },
    ],
    messages: [{ id: 'm1', author: 'Nadia L.', text: 'Il nous manque 6 personnes pour samedi, qui est dispo ? 🙏', time: '14:22' }],
    tags: ['Entraide', 'Environnement'],
  },
  {
    id: 'g-familles', name: 'Familles du centre-ville', category: 'famille', members: 134, admins: ['Julie et Marc'],
    description: 'Parents du quartier : activités pour enfants, échanges de vêtements, parcs et sorties familiales.',
    activities: [{ id: 'a1', title: 'Heure du conte', when: 'Dimanche · 10 h', where: 'Bibliothèque Gabrielle-Roy' }],
    messages: [{ id: 'm1', author: 'Julie', text: 'Le marché du Jardin samedi est parfait pour les petits 🎃', time: '19:05' }],
    tags: ['Enfants', 'Parcs'],
  },
];

/* ===================== COLLABORATIONS ===================== */
export interface Proposal {
  id: string;
  annonceId: string;
  company: string;
  service: string;
  message: string;
  price: string;
  status: 'en-attente' | 'acceptee' | 'refusee';
  mine?: boolean;
  chat: ChatMessage[];
}
export interface Annonce {
  id: string;
  title: string;
  company: string;
  companyColor: string;
  description: string;
  needs: string[];
  date: string;
  budget: string;
  location: string;
  mine?: boolean;
  createdAt: string;
}

export const MY_COMPANY = 'Larian Studios';

export const ANNONCES: Annonce[] = [
  { id: 'an-noel', title: 'Party de Noël pour 200 personnes', company: MY_COMPANY, companyColor: '#06B6D4', description: 'Nous organisons le party de fin d’année de nos clients et partenaires (200 invités). Nous cherchons une salle dans Saint-Roch, un traiteur local et la location de chaises et tables.', needs: ['Salle', 'Traiteur', 'Chaises & tables'], date: '12 décembre 2026', budget: '12 000 – 15 000 $', location: 'Saint-Roch', mine: true, createdAt: 'il y a 3 jours' },
  { id: 'an-vitrine', title: 'Artistes pour habiller nos vitrines', company: 'Atelier Fil & Bois', companyColor: '#EC4899', description: 'Nous cherchons un·e artiste ou collectif pour créer une vitrine hivernale sur la rue du Roi.', needs: ['Artiste', 'Design'], date: 'Novembre 2026', budget: '1 500 $', location: 'Rue du Roi', createdAt: 'il y a 1 jour' },
  { id: 'an-festival', title: 'Bénévoles et commanditaires — Nuit lumineuse', company: 'SDC Centre-Ville', companyColor: '#F59E0B', description: 'Recherche de commerces partenaires pour prolonger leurs heures d’ouverture et offrir une activité pendant la Nuit lumineuse.', needs: ['Commandite', 'Animation', 'Bénévoles'], date: 'Ce soir', budget: 'À discuter', location: 'Rue Saint-Joseph Est', createdAt: 'il y a 6 jours' },
  { id: 'an-conference', title: 'Traiteur pour une conférence (80 pers.)', company: 'Université du Québec', companyColor: '#3B82F6', description: 'Pause-café et cocktail dînatoire pour une conférence universitaire. Options végé et sans allergènes obligatoires.', needs: ['Traiteur', 'Service'], date: 'Dans 2 semaines', budget: '3 000 $', location: 'Pôle Saint-Roch', createdAt: 'il y a 2 jours' },
  { id: 'an-tech', title: 'Partenaire pour un atelier code jeunesse', company: 'Quartier Techno Hub', companyColor: '#06B6D4', description: 'Nous voulons co-organiser un atelier de programmation pour les ados avec un organisme jeunesse du quartier.', needs: ['Organisme jeunesse', 'Local'], date: 'Janvier 2027', budget: 'Bénévole + matériel', location: 'Boulevard Charest Est', createdAt: 'il y a 5 heures' },
  { id: 'an-livraison', title: 'Livraison à vélo partagée', company: 'Épicerie Le Marché du Roi', companyColor: '#22C55E', description: 'On cherche 2-3 commerces voisins pour mutualiser un service de livraison à vélo-cargo.', needs: ['Logistique', 'Commerces'], date: 'Dès maintenant', budget: 'Partage des coûts', location: 'Saint-Roch', createdAt: 'il y a 1 semaine' },
];

export const PROPOSALS: Proposal[] = [
  { id: 'pr-1', annonceId: 'an-noel', company: 'Le Grand Hall Saint-Roch', service: 'Salle', message: 'Notre salle accueille 250 personnes debout ou 200 assises, avec scène et éclairage.', price: '4 800 $', status: 'en-attente', chat: [
    { id: 'c1', author: 'Le Grand Hall', text: 'Bonjour ! Notre salle est disponible le 12 décembre. Voulez-vous organiser une visite ?', time: 'Lun. 10:12' },
    { id: 'c2', author: MY_COMPANY, text: 'Bonjour, oui avec plaisir. Est-ce que le mobilier est inclus ?', time: 'Lun. 10:40', me: true },
    { id: 'c3', author: 'Le Grand Hall', text: 'Les tables oui, les chaises sont en supplément (3 $ / chaise).', time: 'Lun. 11:02' },
  ] },
  { id: 'pr-2', annonceId: 'an-noel', company: 'Traiteur La Fabrique', service: 'Traiteur', message: 'Menu des fêtes 100 % produits du Québec, 5 services en bouchées.', price: '42 $ / personne', status: 'en-attente', chat: [
    { id: 'c1', author: 'La Fabrique', text: 'Voici notre menu des fêtes en pièce jointe. Nous pouvons adapter pour les allergies.', time: 'Mar. 14:20' },
  ] },
  { id: 'pr-3', annonceId: 'an-noel', company: 'Location Festive QC', service: 'Chaises & tables', message: '200 chaises Chiavari + 25 tables rondes, livraison et montage inclus.', price: '1 950 $', status: 'acceptee', chat: [
    { id: 'c1', author: 'Location Festive', text: 'Merci de nous avoir choisis ! Livraison prévue le 12 à 13 h.', time: 'Hier 09:15' },
    { id: 'c2', author: MY_COMPANY, text: 'Parfait, merci ! L’accès se fait par la rue du Roi.', time: 'Hier 09:30', me: true },
  ] },
  { id: 'pr-4', annonceId: 'an-vitrine', company: MY_COMPANY, service: 'Design', message: 'Nous pouvons concevoir une vitrine lumineuse interactive avec des illustrations du quartier.', price: '1 400 $', status: 'en-attente', mine: true, chat: [
    { id: 'c1', author: MY_COMPANY, text: 'Bonjour ! Voici notre proposition pour votre vitrine hivernale ✨', time: 'Mer. 16:00', me: true },
    { id: 'c2', author: 'Atelier Fil & Bois', text: 'Superbe idée ! Pouvez-vous nous envoyer quelques croquis ?', time: 'Mer. 17:12' },
  ] },
];

/* ===================== SIGNALEMENTS ===================== */
export type ReportCategory =
  // Sécurité (personnes et situations)
  | 'agressif' | 'comportement' | 'insecurite' | 'manifestation' | 'passage' | 'mal-eclairee'
  // Infrastructure
  | 'lampadaire' | 'graffiti' | 'trottoir' | 'nid-de-poule' | 'mobilier';
export type ReportGroup = 'securite' | 'infrastructure';
export type ReportStatus = 'nouveau' | 'en-analyse' | 'planifie' | 'resolu';
export interface Report {
  id: string;
  category: ReportCategory;
  ll: LngLat;
  description: string;
  photo?: string;
  createdAt: string;
  status: ReportStatus;
  author: string;
  mine?: boolean;
  votes: number;
}

/**
 * gravity  : points retirés au score de sécurité d'un trajet qui passe au cœur de l'alerte (0 = aucun effet)
 * halfLife : demi-vie de l'alerte en heures (son poids diminue de moitié à chaque demi-vie)
 * radius   : zone d'influence (m) · ttlHours : au-delà, l'alerte n'est plus affichée comme active
 * darkens  : réduit l'éclairage estimé autour du point (lampadaire défectueux, rue mal éclairée)
 */
export const REPORT_META: Record<ReportCategory, { label: string; color: string; icon: string; gravity: number; halfLife?: number; group: ReportGroup; radius: number; ttlHours?: number; darkens?: boolean }> = {
  agressif: { label: 'Individu agressif', color: '#EF4444', icon: 'skull', gravity: 25, halfLife: 1, group: 'securite', radius: 70, ttlHours: 3 },
  comportement: { label: 'Comportement dangereux', color: '#EF4444', icon: 'triangle-alert', gravity: 20, halfLife: 1, group: 'securite', radius: 60, ttlHours: 3 },
  insecurite: { label: 'Sentiment d’insécurité', color: '#F59E0B', icon: 'shield-alert', gravity: 8, halfLife: 24 * 7, group: 'securite', radius: 50, ttlHours: 24 * 14 },
  manifestation: { label: 'Manifestation', color: '#F59E0B', icon: 'megaphone', gravity: 12, halfLife: 2, group: 'securite', radius: 80, ttlHours: 6 },
  passage: { label: 'Passage dangereux', color: '#64748B', icon: 'construction', gravity: 10, halfLife: 24 * 14, group: 'securite', radius: 40, ttlHours: 24 * 30 },
  'mal-eclairee': { label: 'Rue mal éclairée', color: '#64748B', icon: 'flashlight', gravity: 0, group: 'securite', radius: 55, darkens: true },
  lampadaire: { label: 'Lampadaire défectueux', color: '#F59E0B', icon: 'lamp', gravity: 0, group: 'infrastructure', radius: 55, darkens: true },
  graffiti: { label: 'Graffiti', color: '#A855F7', icon: 'spray-can', gravity: 0, group: 'infrastructure', radius: 30 },
  trottoir: { label: 'Trottoir endommagé', color: '#EF4444', icon: 'footprints', gravity: 0, group: 'infrastructure', radius: 35 },
  'nid-de-poule': { label: 'Nid-de-poule', color: '#F97316', icon: 'circle-dot', gravity: 0, group: 'infrastructure', radius: 35 },
  mobilier: { label: 'Mobilier urbain brisé', color: '#64748B', icon: 'armchair', gravity: 0, group: 'infrastructure', radius: 35 },
};

export const SAFETY_CATS = (Object.keys(REPORT_META) as ReportCategory[]).filter((c) => REPORT_META[c].group === 'securite');
export const INFRA_CATS = (Object.keys(REPORT_META) as ReportCategory[]).filter((c) => REPORT_META[c].group === 'infrastructure');

/** Un signalement est actif s'il n'est pas résolu et, pour les situations temporaires, s'il est récent. */
export function isActiveReport(r: { category: ReportCategory; status: string; createdAt: string }, now = Date.now()): boolean {
  if (r.status === 'resolu') return false;
  const ttl = REPORT_META[r.category].ttlHours;
  return !ttl || now - new Date(r.createdAt).getTime() < ttl * 3600e3;
}

export const STATUS_META: Record<ReportStatus, { label: string; color: string }> = {
  nouveau: { label: 'Nouveau', color: '#3B82F6' },
  'en-analyse': { label: 'En analyse', color: '#F59E0B' },
  planifie: { label: 'Planifié', color: '#8B5CF6' },
  resolu: { label: 'Résolu', color: '#10B981' },
};

const ago = (h: number) => new Date(Date.now() - h * 3600e3).toISOString();

export const REPORTS: Report[] = [
  { id: 'r1', category: 'lampadaire', ll: uv(-250, 170), description: 'Deux lampadaires éteints depuis une semaine, la ruelle est très sombre le soir.', createdAt: ago(20), status: 'en-analyse', author: 'Citoyen·ne', votes: 14 },
  { id: 'r2', category: 'trottoir', ll: uv(-178, 120), description: 'Dalle soulevée sur la rue Dorchester, risque de chute.', createdAt: ago(48), status: 'nouveau', author: 'Citoyen·ne', votes: 6 },
  { id: 'r3', category: 'graffiti', ll: uv(60, 128), description: 'Graffiti sur la façade d’un commerce (rue du Roi).', createdAt: ago(5), status: 'nouveau', author: 'Commerçant·e', votes: 3 },
  { id: 'r4', category: 'nid-de-poule', ll: uv(250, -3), description: 'Gros nid-de-poule dans la voie de droite, boulevard Charest.', createdAt: ago(72), status: 'planifie', author: 'Citoyen·ne', votes: 22 },
  { id: 'r5', category: 'passage', ll: uv(30, -6), description: 'Chantier TramCité : trottoir fermé, détour piéton mal indiqué.', createdAt: ago(30), status: 'en-analyse', author: 'Touriste', votes: 31 },
  { id: 'r6', category: 'mobilier', ll: uv(60, -90), description: 'Banc brisé dans le Jardin de Saint-Roch.', createdAt: ago(100), status: 'resolu', author: 'Citoyen·ne', votes: 4 },
  { id: 'r7', category: 'lampadaire', ll: uv(200, -195), description: 'Lampadaire qui clignote sous la falaise, Saint-Vallier Est.', createdAt: ago(9), status: 'nouveau', author: 'Citoyen·ne', votes: 9 },
  { id: 'r9', category: 'insecurite', ll: uv(-120, 200), description: 'Ruelle peu fréquentée le soir, on ne s’y sent pas à l’aise.', createdAt: ago(26), status: 'nouveau', author: 'Citoyen·ne', votes: 11 },
  { id: 'r10', category: 'passage', ll: uv(290, 140), description: 'Traverse sans feu piéton, voitures rapides.', createdAt: ago(50), status: 'en-analyse', author: 'Citoyen·ne', votes: 8 },
  { id: 'r11', category: 'mal-eclairee', ll: uv(200, 260), description: 'Passage très sombre entre la rue du Roi et la rue de la Reine.', createdAt: ago(7), status: 'nouveau', author: 'Citoyen·ne', votes: 5 },
  { id: 'r8', category: 'passage', ll: uv(-8, 250), description: 'Conteneur de chantier sur le trottoir, rue de la Couronne nord.', createdAt: ago(14), status: 'nouveau', author: 'Citoyen·ne', votes: 7 },
];

/* Chantiers permanents (TramCité, fictifs) — utilisés par l'algorithme d'itinéraires */
export const WORKSITES: { id: string; name: string; ll: LngLat; radius: number }[] = [
  { id: 'w1', name: 'Chantier TramCité — Charest / Couronne', ll: uv(40, 0), radius: 45 },
  { id: 'w2', name: 'Réfection d’aqueduc — rue de la Reine', ll: uv(150, 228), radius: 40 },
];
