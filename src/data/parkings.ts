import { LngLat, uv } from '../lib/geo';

/**
 * Stationnements municipaux hors rue — même contenu que le jeu « StationnementsMunicipauxHorsRues » de la Ville :
 * nom, adresse à proximité, nombre de cases, intérieur / extérieur, quartier et arrondissement.
 * Aucune donnée de tarif ni de disponibilité n'est inventée.
 */
export interface Parking {
  id: string;
  name: string;
  ll: LngLat;
  address: string;
  indoor: boolean;
  /** Valeur brute de TYPE_INT_EXT (« Intérieur », « Extérieur »…) */
  typeLabel: string;
  capacity: number;
  quartier?: string;
  arrondissement?: string;
}

const P = (u: number, v: number) => uv(u, v);
const lot = (id: string, name: string, address: string, capacity: number, indoor: boolean, ll: LngLat): Parking => ({
  id, name, address, capacity, indoor, typeLabel: indoor ? 'Intérieur' : 'Extérieur', ll, quartier: 'Saint-Roch', arrondissement: 'La Cité-Limoilou',
});

/** Secours (identique au fichier fictif public/donnees/stationnements.geojson) si aucun fichier n'est chargé. */
export const PARKINGS: Parking[] = [
  lot('d-couronne', 'Stationnement de la Couronne', '400, rue de la Couronne', 420, true, P(30, 20)),
  lot('d-gabrielle-roy', 'Stationnement Gabrielle-Roy', '350, rue Saint-Joseph Est', 260, true, P(-60, 115)),
  lot('d-charest', 'Stationnement Charest-Est', '700, boulevard Charest Est', 180, false, P(200, -20)),
  lot('d-gare', 'Stationnement de la Gare', 'Rue de la Gare-du-Palais', 310, false, P(940, 120)),
  lot('d-langelier', 'Stationnement Langelier', 'Boulevard Langelier', 90, false, P(-560, 50)),
  lot('d-pont', 'Stationnement du Pont', '200, rue du Pont', 75, false, P(300, 300)),
  lot('d-dorchester', 'Stationnement Dorchester', '515, rue Dorchester', 140, true, P(-195, 250)),
  lot('d-jardin', 'Stationnement du Jardin', 'Rue Saint-Vallier Est', 60, false, P(-80, -110)),
];

export const PARKING_COLOR = '#2563EB';
