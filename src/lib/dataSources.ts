import { Cell, parseDelimited, parseLightingRows } from './lightingParse';
import { parseEventRows } from './eventsParse';
import { useLighting } from './lighting';
import { useEventData } from './eventsData';
import { parseBusinessRows } from './businessParse';
import { useBusinessData } from './businessData';
import { parseParkingGeoJSON } from './parkingParse';
import { parseInstallationRows } from './installationsParse';
import { useInstallations } from './installationsData';
import { parseStopsText } from './stopsParse';
import { useStops } from './stopsData';
import { useParkingData } from './parkingData';
import { parsePoliceGeoJSON } from './policeParse';
import { usePolice } from './policeData';

/**
 * Sources de données remplaçables
 * --------------------------------
 * Au démarrage, l'application lit les fichiers déposés dans public/donnees/ :
 *   - eclairage.xlsx (ou .csv)  → format « GI - LU quartier St-Roch » (éclairage public)
 *   - evenements.xlsx (ou .csv) → format « Événements à venir » de la Ville
 *   - commerces.xlsx (ou .csv)  → format « Registre des entreprises » (Type rue, Nom rue, Marque de Commerce)
 *   - stationnements.geojson    → format « Stationnements municipaux hors rue » (GeoJSON)
 *   - installations.xlsx (ou .csv) → format « Liste des installations » (équipements municipaux)
 *   - stops.txt                 → arrêts d'autobus, fichier stops.txt du GTFS du RTC (tel quel)
 *   - postes-police.geojson     → postes de police (NOM, ADRESSE, TELEPHONE, HORAIRE)
 * Pour passer aux vraies données, il suffit de remplacer ces fichiers (même nom, même format).
 * Un fichier importé depuis l'espace Ville a priorité et reste sur l'appareil.
 */

export async function readTable(data: ArrayBuffer | Blob, name: string): Promise<Cell[][]> {
  if (/\.xlsx$/i.test(name)) {
    const { readSheet } = await import('read-excel-file/universal');
    return (await readSheet(data)) as Cell[][];
  }
  const text = data instanceof Blob ? await data.text() : new TextDecoder('utf-8').decode(data);
  return parseDelimited(text);
}

async function fetchFirst(base: string): Promise<{ rows: Cell[][]; name: string } | null> {
  for (const ext of ['xlsx', 'csv']) {
    const name = `${base}.${ext}`;
    try {
      const res = await fetch(`donnees/${name}`, { cache: 'no-cache' });
      // le serveur de développement renvoie index.html pour un fichier absent
      if (!res.ok || (res.headers.get('content-type') ?? '').includes('text/html')) continue;
      return { rows: await readTable(await res.arrayBuffer(), name), name };
    } catch {
      /* fichier suivant */
    }
  }
  return null;
}

export async function loadDataFiles() {
  await Promise.all([loadBusinesses(), loadParkings(), loadInstallations(), loadStops(), loadPolice()]);
  if (useLighting.getState().source !== 'import') {
    const f = await fetchFirst('eclairage');
    if (f) {
      const res = parseLightingRows(f.rows);
      if (res.lamps.length) useLighting.getState().load(res.lamps, f.name, 'fichier');
      else console.warn(`[données] ${f.name} : aucun luminaire lu`, res.missing);
    }
  }
  if (useEventData.getState().source !== 'import') {
    const f = await fetchFirst('evenements');
    if (f) {
      const res = parseEventRows(f.rows);
      if (res.events.length || res.total) useEventData.getState().load(res.events, f.name, 'fichier', { total: res.total, outside: res.outside, skipped: res.skipped });
      else console.warn(`[données] ${f.name} : aucun événement lu`, res.missing);
    }
  }
}

async function loadPolice() {
  if (usePolice.getState().source === 'import') return;
  try {
    const res = await fetch('donnees/postes-police.geojson', { cache: 'no-cache' });
    if (!res.ok || (res.headers.get('content-type') ?? '').includes('text/html')) return;
    const out = parsePoliceGeoJSON(await res.json());
    if (out.stations.length) usePolice.getState().load(out.stations, 'postes-police.geojson', 'fichier');
    else console.warn('[données] postes-police.geojson : aucun poste lu', out.error);
  } catch {
    /* fichier absent : liste de secours */
  }
}

export async function importPoliceFile(file: File) {
  const out = parsePoliceGeoJSON(JSON.parse(await file.text()));
  if (out.stations.length) usePolice.getState().load(out.stations, file.name, 'import');
  return out;
}

async function loadParkings() {
  if (useParkingData.getState().source === 'import') return;
  for (const name of ['stationnements.geojson', 'stationnements.json']) {
    try {
      const res = await fetch(`donnees/${name}`, { cache: 'no-cache' });
      if (!res.ok || (res.headers.get('content-type') ?? '').includes('text/html')) continue;
      const out = parseParkingGeoJSON(await res.json());
      if (out.parkings.length) useParkingData.getState().load(out.parkings, name, 'fichier', { total: out.total, skipped: out.skipped });
      else console.warn(`[données] ${name} : aucun stationnement lu`, out.error);
      return;
    } catch {
      /* fichier suivant */
    }
  }
}

export async function importParkingFile(file: File) {
  const out = parseParkingGeoJSON(JSON.parse(await file.text()));
  if (out.parkings.length) useParkingData.getState().load(out.parkings, file.name, 'import', { total: out.total, skipped: out.skipped });
  return out;
}

async function loadInstallations() {
  if (useInstallations.getState().source === 'import') return;
  const f = await fetchFirst('installations');
  if (!f) return;
  const res = parseInstallationRows(f.rows);
  if (!res.missing.length) useInstallations.getState().load(res.places, f.name, 'fichier', { total: res.total, outside: res.outside, located: res.located, byType: res.byType });
  else console.warn(`[données] ${f.name} : colonnes manquantes`, res.missing);
}

export async function importInstallationsFile(file: File) {
  const res = parseInstallationRows(await readTable(file, file.name));
  if (!res.missing.length) useInstallations.getState().load(res.places, file.name, 'import', { total: res.total, outside: res.outside, located: res.located, byType: res.byType });
  return res;
}

async function loadStops() {
  if (useStops.getState().source === 'import') return;
  try {
    const res = await fetch('donnees/stops.txt', { cache: 'no-cache' });
    if (!res.ok || (res.headers.get('content-type') ?? '').includes('text/html')) return;
    const out = parseStopsText(await res.text());
    if (!out.missing.length) useStops.getState().load(out.stops, 'stops.txt', 'fichier', { total: out.total, outside: out.outside });
    else console.warn('[données] stops.txt : colonnes manquantes', out.missing);
  } catch {
    /* pas de fichier d'arrêts */
  }
}

export async function importStopsFile(file: File) {
  const out = parseStopsText(await file.text());
  if (!out.missing.length) useStops.getState().load(out.stops, file.name, 'import', { total: out.total, outside: out.outside });
  return out;
}

async function loadBusinesses() {
  if (useBusinessData.getState().source === 'import') return;
  const f = await fetchFirst('commerces');
  if (!f) return;
  const res = parseBusinessRows(f.rows);
  if (res.places.length) useBusinessData.getState().load(res.places, f.name, 'fichier', { total: res.total, located: res.located, unknownStreets: res.unknownStreets });
  else console.warn(`[données] ${f.name} : aucun commerce lu`, res.missing);
}

export async function importBusinessFile(file: File) {
  const res = parseBusinessRows(await readTable(file, file.name));
  if (res.places.length) useBusinessData.getState().load(res.places, file.name, 'import', { total: res.total, located: res.located, unknownStreets: res.unknownStreets });
  return res;
}

export async function importLightingFile(file: File) {
  const res = parseLightingRows(await readTable(file, file.name));
  if (res.lamps.length) useLighting.getState().load(res.lamps, file.name, 'import');
  return res;
}

export async function importEventsFile(file: File) {
  const res = parseEventRows(await readTable(file, file.name));
  if (!res.missing.length) useEventData.getState().load(res.events, file.name, 'import', { total: res.total, outside: res.outside, skipped: res.skipped });
  return res;
}

/** Abandonne le fichier importé et recharge les fichiers de public/donnees/. */
export async function resetImports() {
  useLighting.getState().resetToDemo();
  useEventData.getState().resetToDemo();
  useBusinessData.getState().resetToDemo();
  useParkingData.getState().resetToDemo();
  useInstallations.getState().resetToDemo();
  useStops.getState().resetToDemo();
  usePolice.getState().resetToDemo();
  await loadDataFiles();
}
