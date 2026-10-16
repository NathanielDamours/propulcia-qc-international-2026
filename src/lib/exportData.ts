import type { Report } from '../data/community';
import { REPORT_META, STATUS_META, isActiveReport } from '../data/community';
import type { AppEvent } from '../data/events';
import { EVENT_META } from '../data/events';
import type { Place } from '../data/places';
import { CATEGORY_META } from '../data/places';
import type { Parking } from '../data/parkings';
import type { Lamp } from '../data/streets';
import type { BusStop } from './stopsParse';

/**
 * Export des données actuelles de l'application (espace Ville).
 * CSV : séparateur « ; » et encodage UTF-8 avec BOM, pour une ouverture directe dans Excel (Québec / France).
 * GeoJSON : coordonnées WGS84 (longitude, latitude).
 */

type Cell = string | number | boolean | null | undefined;

function csvCell(v: Cell): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(header: string[], rows: Cell[][]): string {
  return '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n') + '\r\n';
}

export function download(content: string, fileName: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const today = () => new Date().toISOString().slice(0, 10);
const coord = (n: number) => Math.round(n * 1e6) / 1e6;
const fmtDate = (iso: string) => new Date(iso).toLocaleString('fr-CA', { dateStyle: 'short', timeStyle: 'short' });

export function fileName(base: string, ext: string) {
  return `saint-roch_${base}_${today()}.${ext}`;
}

/* ---------- Signalements ---------- */
export function reportsCSV(reports: Report[]) {
  return toCSV(
    ['id', 'groupe', 'categorie', 'statut', 'actif', 'date', 'latitude', 'longitude', 'description', 'appuis', 'auteur', 'photo', 'source'],
    reports.map((r) => [
      r.id, REPORT_META[r.category].group === 'securite' ? 'Sécurité' : 'Infrastructure', REPORT_META[r.category].label, STATUS_META[r.status].label,
      isActiveReport(r) ? 'oui' : 'non', fmtDate(r.createdAt), coord(r.ll[1]), coord(r.ll[0]), r.description, r.votes, r.author,
      r.photo ? 'oui' : 'non', r.mine ? 'Application (cet appareil)' : 'Démonstration',
    ]),
  );
}

export function reportsGeoJSON(reports: Report[]) {
  return JSON.stringify({
    type: 'FeatureCollection',
    name: 'SignalementsSaintRoch',
    features: reports.map((r) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [coord(r.ll[0]), coord(r.ll[1])] },
      properties: {
        ID: r.id, GROUPE: REPORT_META[r.category].group, CATEGORIE: REPORT_META[r.category].label, STATUT: STATUS_META[r.status].label,
        ACTIF: isActiveReport(r), DATE: r.createdAt, DESCRIPTION: r.description, APPUIS: r.votes, AUTEUR: r.author, PHOTO: !!r.photo,
      },
    })),
  }, null, 2);
}

/* ---------- Événements ---------- */
export function eventsCSV(events: AppEvent[], going: string[], favorites: string[]) {
  return toCSV(
    ['id', 'titre', 'categorie', 'debut', 'fin', 'journee_entiere', 'lieu', 'latitude', 'longitude', 'lieu_approximatif', 'organisateur', 'cout', 'participants', 'je_participe', 'favori', 'publie_dans_app', 'site_web'],
    events.map((e) => [
      e.id, e.title, EVENT_META[e.category].label, fmtDate(e.start), fmtDate(e.end), e.allDay ? 'oui' : 'non', e.venue, coord(e.ll[1]), coord(e.ll[0]),
      e.approximate ? 'oui' : 'non', e.organizer, e.price, e.attendees + (going.includes(e.id) ? 1 : 0), going.includes(e.id) ? 'oui' : 'non',
      favorites.includes(e.id) ? 'oui' : 'non', e.userCreated ? 'oui' : 'non', e.website ?? '',
    ]),
  );
}

/* ---------- Stationnements (même format que le jeu de la Ville) ---------- */
export function parkingsGeoJSON(parkings: Parking[]) {
  return JSON.stringify({
    type: 'FeatureCollection',
    name: 'StationnementsMunicipauxHorsRues',
    features: parkings.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [coord(p.ll[0]), coord(p.ll[1])] },
      properties: { ARRONDISSEMENT: p.arrondissement ?? '', QUARTIER: p.quartier ?? '', NOM: p.name, ADRESSE_À_PROXIMITÉ: p.address, NOMBRE_DE_CASES: p.capacity, TYPE_INT_EXT: p.typeLabel },
    })),
  }, null, '\t');
}

/* ---------- Lieux : entreprises, installations, lieux de démonstration ---------- */
export function placesCSV(places: Place[]) {
  return toCSV(
    ['id', 'nom', 'categorie', 'adresse', 'latitude', 'longitude', 'source', 'position', 'code_installation'],
    places.map((p) => [
      p.id, p.name, CATEGORY_META[p.category].label, p.address,
      p.registry && !p.located ? '' : coord(p.ll[1]), p.registry && !p.located ? '' : coord(p.ll[0]),
      p.installation ? 'Installations municipales' : p.registry ? 'Registre des entreprises' : 'Lieu de démonstration',
      p.registry ? (p.located ? (p.approxPosition === false ? 'exacte' : 'estimée') : 'inconnue') : 'démonstration',
      p.code ?? '',
    ]),
  );
}

/* ---------- Arrêts d'autobus ---------- */
export function stopsCSV(stops: BusStop[]) {
  return toCSV(
    ['stop_id', 'stop_code', 'nom', 'latitude', 'longitude', 'accessible_fauteuil'],
    stops.map((s) => [s.id, s.code ?? '', s.name, coord(s.ll[1]), coord(s.ll[0]), s.wheelchair === undefined ? '' : s.wheelchair ? 'oui' : 'non']),
  );
}

/* ---------- Éclairage ---------- */
export function lampsCSV(lamps: Lamp[]) {
  return toCSV(
    ['id', 'latitude', 'longitude', 'actif', 'puissance_w', 'source', 'annee_installation', 'rue', 'modele', 'intensite_relative'],
    lamps.map((l) => [l.id, coord(l.ll[1]), coord(l.ll[0]), l.ok ? 'oui' : 'non', l.watts ?? '', l.source ?? '', l.year ?? '', l.street ?? '', l.model ?? '', Math.round(l.power * 1000) / 1000]),
  );
}

/* ---------- Groupes ---------- */
export function groupsCSV(groups: { id: string; name: string; category: string; members: number; activities: unknown[]; messages: unknown[] }[], joined: string[], extraMessages: Record<string, unknown[]>) {
  return toCSV(
    ['id', 'nom', 'categorie', 'membres', 'activites', 'messages', 'membre_sur_cet_appareil'],
    groups.map((g) => [g.id, g.name, g.category, g.members + (joined.includes(g.id) ? 1 : 0), g.activities.length, g.messages.length + (extraMessages[g.id]?.length ?? 0), joined.includes(g.id) ? 'oui' : 'non']),
  );
}
