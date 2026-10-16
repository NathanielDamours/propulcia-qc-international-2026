import { LngLat, uv } from '../lib/geo';

export type EventCategory = 'musique' | 'art' | 'famille' | 'sport' | 'gastronomie' | 'communaute' | 'savoir';

export interface AppEvent {
  id: string;
  title: string;
  category: EventCategory;
  venue: string;
  ll: LngLat;
  start: string; // ISO
  end: string;
  description: string;
  organizer: string;
  price: string;
  attendees: number;
  tags: string[];
  cover: number; // index de visuel
  userCreated?: boolean;
  /** Champs issus du fichier de la Ville */
  allDay?: boolean;
  approximate?: boolean;
  website?: string;
  weather?: string;
  details?: string;
  sites?: string;
}

export const EVENT_META: Record<EventCategory, { label: string; color: string; gradient: [string, string]; icon: string }> = {
  musique: { label: 'Musique', color: '#E11D48', gradient: ['#FF5F6D', '#6A3093'], icon: 'music' },
  art: { label: 'Art & culture', color: '#8B5CF6', gradient: ['#7F7FD5', '#E96443'], icon: 'palette' },
  famille: { label: 'Famille', color: '#F59E0B', gradient: ['#F7971E', '#FFD200'], icon: 'baby' },
  sport: { label: 'Sport', color: '#10B981', gradient: ['#11998E', '#38EF7D'], icon: 'bike' },
  gastronomie: { label: 'Gastronomie', color: '#F97316', gradient: ['#F12711', '#F5AF19'], icon: 'chef-hat' },
  communaute: { label: 'Communauté', color: '#14B8A6', gradient: ['#0F9B8E', '#4E65FF'], icon: 'users' },
  savoir: { label: 'Savoir & université', color: '#3B82F6', gradient: ['#2B5876', '#4E4376'], icon: 'graduation-cap' },
};

function at(dayOffset: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute);
  return d.toISOString();
}

const P = (u: number, v: number) => uv(u, v);

/** Événements de secours (si aucun fichier n'est trouvé dans public/donnees/). */
export const EVENTS: AppEvent[] = [
  { id: 'e-nuit-st-joseph', title: 'Nuit lumineuse sur Saint-Joseph', category: 'art', venue: 'Rue Saint-Joseph Est', ll: P(40, 78), start: at(0, 19), end: at(0, 23), description: 'Projections monumentales, installations lumineuses et DJ sur la rue piétonne. Une soirée pour redécouvrir le quartier autrement.', organizer: 'SDC Centre-Ville', price: 'Gratuit', attendees: 1240, tags: ['Gratuit', 'Extérieur', 'Soirée'], cover: 0 },
  { id: 'e-jazz-cercle', title: 'Jazz au Cercle — Trio Basse-Ville', category: 'musique', venue: 'Le Cercle', ll: P(-200, 92), start: at(0, 21), end: at(0, 23, 30), description: 'Soirée jazz intime avec un trio local et invités surprises. Formule souper-spectacle disponible.', organizer: 'Le Cercle', price: '25 $', attendees: 186, tags: ['Spectacle', 'Bar'], cover: 1 },
  { id: 'e-marche-jardin', title: 'Marché d’automne du Jardin', category: 'gastronomie', venue: 'Jardin de Saint-Roch', ll: P(60, -90), start: at(1, 10), end: at(1, 17), description: 'Producteurs de la région, courges, cidres et pâtisseries. Animation musicale et dégustations.', organizer: 'Marché public', price: 'Gratuit', attendees: 530, tags: ['Gratuit', 'Famille', 'Local'], cover: 2 },
  { id: 'e-conference-uq', title: 'Conférence : la ville apprenante', category: 'savoir', venue: 'Université du Québec — Pôle Saint-Roch', ll: P(90, -30), start: at(2, 18, 30), end: at(2, 20), description: 'Comment un quartier universitaire peut-il revitaliser un centre-ville ? Table ronde avec chercheurs et organismes du milieu.', organizer: 'Université du Québec', price: 'Gratuit, inscription', attendees: 142, tags: ['Étudiants', 'Conférence'], cover: 3 },
  { id: 'e-course', title: 'Course nocturne 5 km du Pont', category: 'sport', venue: 'Départ rue du Pont', ll: P(280, 40), start: at(3, 19, 30), end: at(3, 21), description: 'Parcours éclairé de 5 km à travers Saint-Roch et le long de la rivière Saint-Charles. Lampes frontales fournies.', organizer: 'Club Les Coureurs du Roch', price: '15 $', attendees: 310, tags: ['Sport', 'Soirée'], cover: 4 },
  { id: 'e-atelier-bib', title: 'Atelier BD jeunesse', category: 'famille', venue: 'Bibliothèque Gabrielle-Roy', ll: P(-40, 98), start: at(4, 13, 30), end: at(4, 15, 30), description: 'Initiation à la bande dessinée pour les 8-12 ans avec une illustratrice québécoise.', organizer: 'Bibliothèque de Québec', price: 'Gratuit', attendees: 34, tags: ['Enfants', 'Gratuit', 'Intérieur'], cover: 5 },
  { id: 'e-vernissage', title: 'Vernissage — Murs de Saint-Roch', category: 'art', venue: 'Galerie Rouge Brique', ll: P(-14, 120), start: at(5, 17), end: at(5, 20), description: 'Exposition photo des murales et œuvres d’art public du quartier. Rencontre avec les artistes.', organizer: 'Galerie Rouge Brique', price: 'Gratuit', attendees: 88, tags: ['Art public', 'Gratuit'], cover: 6 },
  { id: 'e-corvee', title: 'Grande corvée de propreté', category: 'communaute', venue: 'Parc des Pékans', ll: P(-250, 182), start: at(6, 9, 30), end: at(6, 12), description: 'Nettoyons ensemble les parcs et ruelles. Gants, sacs et café fournis. Bienvenue à toutes et à tous !', organizer: 'Centre communautaire L’Ancrage', price: 'Gratuit', attendees: 64, tags: ['Bénévolat', 'Gratuit'], cover: 7 },
  { id: 'e-concert-eglise', title: 'Concert d’orgue à l’Église Saint-Roch', category: 'musique', venue: 'Église Saint-Roch', ll: P(110, 100), start: at(8, 19, 30), end: at(8, 21), description: 'Récital d’orgue et chœur dans l’acoustique exceptionnelle de la plus grande église de Québec.', organizer: 'Fabrique Saint-Roch', price: '20 $', attendees: 410, tags: ['Classique', 'Patrimoine'], cover: 8 },
  { id: 'e-food-trucks', title: 'Rallye des camions de rue', category: 'gastronomie', venue: 'Place de l’Université-du-Québec', ll: P(90, -30), start: at(10, 11), end: at(10, 20), description: 'Une douzaine de camions de cuisine de rue, musique et tables à pique-nique.', organizer: 'Collectif Bouffe de rue', price: 'Entrée libre', attendees: 760, tags: ['Famille', 'Extérieur'], cover: 9 },
  { id: 'e-hackathon', title: 'Hackathon Saint-Roch 2026 — Finale', category: 'savoir', venue: 'Quartier Techno Hub', ll: P(330, -14), start: at(12, 9), end: at(12, 17), description: 'Présentation des projets citoyens et technologiques pour la revitalisation du quartier.', organizer: 'Quartier Techno Hub', price: 'Gratuit', attendees: 220, tags: ['Techno', 'Innovation'], cover: 10 },
  { id: 'e-danse', title: 'Bal de rue latino', category: 'musique', venue: 'Rue de la Couronne', ll: P(-5, 160), start: at(14, 19), end: at(14, 23), description: 'Initiation à la salsa et à la bachata, puis bal ouvert à tous sous les guirlandes.', organizer: 'Studio Danse Couronne', price: 'Gratuit', attendees: 290, tags: ['Danse', 'Gratuit', 'Soirée'], cover: 11 },
];
