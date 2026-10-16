import { useMemo } from 'react';
import type { AppEvent } from '../data/events';
import { useEventData } from './eventsData';
import { useBusinessData } from './businessData';
import { useInstallations } from './installationsData';
import type { Place } from '../data/places';
import { ANNONCES, GROUPS, PROPOSALS, REPORTS, REPORT_META, Report, Proposal, Annonce, Group } from '../data/community';
import { useApp } from './store';

export function useEvents(): AppEvent[] {
  const userEvents = useApp((s) => s.userEvents);
  const fileEvents = useEventData((s) => s.events);
  return useMemo(() => [...userEvents, ...fileEvents].sort((a, b) => a.start.localeCompare(b.start)), [userEvents, fileEvents]);
}

export function useReports(): Report[] {
  const userReports = useApp((s) => s.userReports);
  const status = useApp((s) => s.reportStatus);
  const votes = useApp((s) => s.reportVotes);
  return useMemo(
    () =>
      // Ignore les catégories retirées (ex. « obstacle ») encore présentes dans le stockage local
      [...userReports, ...REPORTS].filter((r) => r.category in REPORT_META).map((r) => ({
        ...r,
        status: status[r.id] ?? r.status,
        votes: r.votes + (votes.includes(r.id) ? 1 : 0),
      })),
    [userReports, status, votes],
  );
}

export function useAnnonces(): Annonce[] {
  const user = useApp((s) => s.userAnnonces);
  return useMemo(() => [...user, ...ANNONCES], [user]);
}

export function useProposals(): Proposal[] {
  const user = useApp((s) => s.userProposals);
  const extra = useApp((s) => s.extraChat);
  const status = useApp((s) => s.proposalStatus);
  return useMemo(
    () => [...user, ...PROPOSALS].map((p) => ({ ...p, status: status[p.id] ?? p.status, chat: [...p.chat, ...(extra[p.id] ?? [])] })),
    [user, extra, status],
  );
}

export function formatEventDate(iso: string, withTime = true): string {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - today.getTime()) / 86400000);
  const time = d.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' }).replace(':', ' h ').replace(' h 00', ' h');
  let label: string;
  if (diff === 0) label = 'Aujourd’hui';
  else if (diff === 1) label = 'Demain';
  else label = d.toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' });
  return withTime ? `${label} · ${time}` : label;
}

export function dayParts(iso: string) {
  const d = new Date(iso);
  return {
    day: d.getDate(),
    month: d.toLocaleDateString('fr-CA', { month: 'short' }).replace('.', ''),
  };
}

export function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'à l’instant';
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  return `il y a ${Math.round(s / 86400)} j`;
}

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const hm = (d: Date) => d.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' }).replace(':', ' h ').replace(' h 00', ' h');

/** Libellé de date tenant compte des événements sur plusieurs jours et des journées entières. */
export function formatEventWhen(e: AppEvent): string {
  const s = new Date(e.start);
  const end = new Date(e.end);
  const now = new Date();
  if (!sameDay(s, end)) {
    const d = (x: Date) => x.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' }).replace('.', '');
    const running = s <= now && end >= now;
    return running ? `En cours · jusqu’au ${d(end)}` : `${d(s)} → ${d(end)}`;
  }
  return e.allDay ? `${formatEventDate(e.start, false)} · toute la journée` : formatEventDate(e.start);
}

export function eventTime(e: AppEvent): string {
  const s = new Date(e.start);
  const end = new Date(e.end);
  if (!sameDay(s, end)) return formatEventWhen(e);
  return e.allDay ? 'toute la journée' : `${hm(s)} – ${hm(end)}`;
}

export function participantsLabel(e: AppEvent, going: boolean): string {
  const n = e.attendees + (going ? 1 : 0);
  if (n === 0) return 'Soyez le premier à participer';
  return `${n} participant${n > 1 ? 's' : ''}`;
}

const nameKey = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Lieux de démonstration (fiches détaillées) + installations municipales + entreprises du registre, sans doublons. */
/** Groupes de démonstration + groupes créés sur cet appareil */
export function useGroups(): Group[] {
  const userGroups = useApp((s) => s.userGroups);
  return useMemo(() => [...userGroups, ...GROUPS], [userGroups]);
}

export function usePlaces(): Place[] {
  const registry = useBusinessData((s) => s.places);
  const installations = useInstallations((s) => s.places);
  return useMemo(() => {
    const known = new Set<string>();
    const fresh = (list: Place[]) => list.filter((p) => { const k = nameKey(p.name); if (known.has(k)) return false; known.add(k); return true; });
    return [...fresh(installations), ...fresh(registry)];
  }, [registry, installations]);
}

export function usePlace(id: string | undefined): Place | undefined {
  const places = usePlaces();
  return useMemo(() => places.find((p) => p.id === id), [places, id]);
}
