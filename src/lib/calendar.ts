import type { AppEvent } from '../data/events';

/** Export d'un événement vers un calendrier : fichier .ics (iPhone, Android, Outlook…) ou lien Google Agenda. */

const pad = (n: number) => String(n).padStart(2, '0');
const utc = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
const day = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

/** Plage de dates au format calendrier (journée entière : date de fin exclusive, donc lendemain). */
function range(e: AppEvent): { start: string; end: string; allDay: boolean } {
  const s = new Date(e.start);
  const end = new Date(e.end);
  if (e.allDay) {
    const after = new Date(end);
    after.setHours(0, 0, 0, 0);
    after.setDate(after.getDate() + 1);
    return { start: day(s), end: day(after), allDay: true };
  }
  return { start: utc(s), end: utc(end), allDay: false };
}

function location(e: AppEvent) {
  return `${e.venue}, Saint-Roch, Québec`;
}

function description(e: AppEvent) {
  return [e.description, e.organizer && `Organisateur : ${e.organizer}`, e.price && `Coût : ${e.price}`, e.website && `Site : ${e.website}`].filter(Boolean).join('\n');
}

/** Pliage des lignes à 75 octets (RFC 5545) */
function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (new TextEncoder().encode(rest).length > 74) {
    let cut = 74;
    while (new TextEncoder().encode(rest.slice(0, cut)).length > 74) cut--;
    out.push(rest.slice(0, cut));
    rest = ' ' + rest.slice(cut);
  }
  out.push(rest);
  return out.join('\r\n');
}

export function toICS(e: AppEvent): string {
  const r = range(e);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mon Saint-Roch//Hackathon 2026//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${e.id}@mon-saint-roch`,
    `DTSTAMP:${utc(new Date())}`,
    r.allDay ? `DTSTART;VALUE=DATE:${r.start}` : `DTSTART:${r.start}`,
    r.allDay ? `DTEND;VALUE=DATE:${r.end}` : `DTEND:${r.end}`,
    `SUMMARY:${esc(e.title)}`,
    `LOCATION:${esc(location(e))}`,
    `DESCRIPTION:${esc(description(e))}`,
    `GEO:${e.ll[1].toFixed(6)};${e.ll[0].toFixed(6)}`,
    ...(e.website ? [`URL:${/^https?:/.test(e.website) ? e.website : `https://${e.website}`}`] : []),
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(e.title)}`,
    'TRIGGER:-PT1H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function downloadICS(e: AppEvent) {
  const blob = new Blob([toICS(e)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${e.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'evenement'}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function googleCalendarUrl(e: AppEvent): string {
  const r = range(e);
  const params = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates: `${r.start}/${r.end}`, details: description(e), location: location(e), ctz: 'America/Toronto' });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
