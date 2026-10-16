/**
 * Position du soleil à Québec (formules simplifiées de l'almanach astronomique, précision ≈ 1-2 min).
 * Sert à savoir s'il fait jour, crépuscule ou nuit à une date donnée, en suivant les saisons.
 */

export const QUEBEC = { lat: 46.8139, lng: -71.2246 };
const RAD = Math.PI / 180;

/* ---------- Heure de Québec (indépendante du fuseau de l'appareil) ---------- */
const TZ = 'America/Toronto';
const FMT = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
function qcParts(d: Date) {
  const o: Record<string, number> = {};
  for (const p of FMT.formatToParts(d)) if (p.type !== 'literal') o[p.type] = Number(p.value);
  return { y: o.year, mo: o.month, d: o.day, h: o.hour % 24, mi: o.minute };
}
function tzOffsetMs(d: Date) {
  const p = qcParts(d);
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi) - Math.floor(d.getTime() / 60000) * 60000;
}
/** Heure décimale à Québec (ex. 22,5 pour 22 h 30). */
export function quebecHour(d: Date): number {
  const p = qcParts(d);
  return p.h + p.mi / 60;
}
/** Date à l'heure `h` (heure de Québec) du jour de `d`, décalé de `addDays` jours. */
export function atQuebecTime(d: Date, h: number, addDays = 0): Date {
  const p = qcParts(d);
  const guess = Date.UTC(p.y, p.mo - 1, p.d + addDays, h, 0);
  return new Date(guess - tzOffsetMs(new Date(guess)));
}
export function sameQuebecDay(a: Date, b: Date): boolean {
  const x = qcParts(a);
  const y = qcParts(b);
  return x.y === y.y && x.mo === y.mo && x.d === y.d;
}

/** Hauteur du soleil au-dessus de l'horizon, en degrés. */
export function solarElevation(date: Date, lat = QUEBEC.lat, lng = QUEBEC.lng): number {
  const n = date.getTime() / 86400000 + 2440587.5 - 2451545.0; // jours depuis J2000
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * RAD;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const eps = (23.439 - 0.0000004 * n) * RAD;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const gmst = ((18.697374558 + 24.06570982441908 * n) % 24) * 15; // degrés
  const ha = (gmst + lng) * RAD - ra;
  const el = Math.asin(Math.sin(lat * RAD) * Math.sin(dec) + Math.cos(lat * RAD) * Math.cos(dec) * Math.cos(ha));
  return el / RAD;
}

/**
 * Lumière du jour J (0..1) : 1 quand le soleil est à plus de 6° au-dessus de l'horizon,
 * 0 quand il est à plus de 6° sous l'horizon (fin du crépuscule civil), transition linéaire entre les deux.
 */
export function daylight(date: Date): number {
  const e = solarElevation(date);
  return Math.max(0, Math.min(1, (e + 6) / 12));
}

export type LightPhase = 'jour' | 'crépuscule' | 'nuit';
export function phaseAt(date: Date): LightPhase {
  const j = daylight(date);
  return j >= 1 ? 'jour' : j <= 0 ? 'nuit' : 'crépuscule';
}

/** Lever et coucher du soleil (hauteur −0,833°) le jour local de `date`. */
export function sunTimes(date: Date): { sunrise: Date | null; sunset: Date | null } {
  const start = atQuebecTime(date, 0);
  const H = -0.833;
  let sunrise: Date | null = null;
  let sunset: Date | null = null;
  let prev = solarElevation(start) - H;
  for (let m = 5; m <= 24 * 60; m += 5) {
    const t = new Date(start.getTime() + m * 60000);
    const cur = solarElevation(t) - H;
    if (prev < 0 && cur >= 0 && !sunrise) sunrise = new Date(t.getTime() - (cur / (cur - prev)) * 5 * 60000);
    if (prev >= 0 && cur < 0 && !sunset) sunset = new Date(t.getTime() - (cur / (cur - prev)) * 5 * 60000);
    prev = cur;
  }
  return { sunrise, sunset };
}

/**
 * Heure utilisée pour évaluer un trajet selon le réglage Jour / Nuit / Auto :
 * Auto = maintenant ; Nuit = maintenant s'il fait nuit, sinon ce soir 22 h (simulation) ;
 * Jour = maintenant s'il fait jour, sinon le prochain 13 h (simulation).
 */
export function routeTime(pref: 'auto' | 'jour' | 'nuit', now = new Date()): { when: Date; simulated: boolean } {
  if (pref === 'nuit' && daylight(now) > 0) return { when: atQuebecTime(now, 22), simulated: true };
  if (pref === 'jour' && daylight(now) < 1) return { when: atQuebecTime(now, 13, quebecHour(now) >= 13 ? 1 : 0), simulated: true };
  return { when: now, simulated: false };
}

export const formatHour = (d: Date) => d.toLocaleTimeString('fr-CA', { hour: 'numeric', minute: '2-digit', timeZone: TZ }).replace(':', ' h ').replace(/ h 00$/, ' h');
