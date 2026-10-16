import { LngLat } from '../lib/geo';

export type PlaceCategory =
  | 'restaurant'
  | 'cafe'
  | 'commerce'
  | 'culture'
  | 'organisme'
  | 'institution'
  | 'transport'
  | 'parc'
  | 'hotel'
  | 'techno'
  | 'services'
  | 'loisirs';

export interface Place {
  id: string;
  name: string;
  category: PlaceCategory;
  ll: LngLat;
  address: string;
  description: string;
  /** Sentiment de sécurité perçu (évaluations communautaires fictives, 1..5) */
  safety: number;
  reviews: number;
  rating: number;
  hours: string;
  openLate?: boolean;
  phone?: string;
  website?: string;
  tags: string[];
  isOrganization?: boolean;
  /** Issu du registre des entreprises (fichier de la Ville) */
  registry?: boolean;
  /** Rue reconnue : position approximative le long de la rue */
  located?: boolean;
  /** Issu de la liste des installations municipales */
  installation?: boolean;
  approxPosition?: boolean;
  code?: string;
  arrondissement?: string;
}

export const CATEGORY_META: Record<PlaceCategory, { label: string; color: string; icon: string }> = {
  restaurant: { label: 'Restaurant', color: '#F97316', icon: 'utensils' },
  cafe: { label: 'Café', color: '#B45309', icon: 'coffee' },
  commerce: { label: 'Commerce', color: '#EC4899', icon: 'shopping-bag' },
  culture: { label: 'Culture', color: '#8B5CF6', icon: 'theater' },
  organisme: { label: 'Organisme', color: '#14B8A6', icon: 'heart-handshake' },
  institution: { label: 'Institution', color: '#3B82F6', icon: 'landmark' },
  transport: { label: 'Transport', color: '#0EA5E9', icon: 'train' },
  parc: { label: 'Parc', color: '#22C55E', icon: 'trees' },
  hotel: { label: 'Hébergement', color: '#6366F1', icon: 'bed' },
  techno: { label: 'Techno & bureaux', color: '#06B6D4', icon: 'cpu' },
  services: { label: 'Services pros', color: '#64748B', icon: 'briefcase' },
  loisirs: { label: 'Sports & loisirs', color: '#0891B2', icon: 'dumbbell' },
};


