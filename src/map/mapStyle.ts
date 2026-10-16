import type { StyleSpecification, LayerSpecification } from 'maplibre-gl';
import { baseGeometry } from '../data/streets';

export interface Palette {
  land: string; landuse: string; water: string; waterLine: string; park: string; building: string; building3d: string;
  road: string; roadMajor: string; highway: string; casing: string; label: string; halo: string; cliff: string;
}

export const DAY: Palette = {
  land: '#F4F2EE', landuse: '#EFEDE8', water: '#A9D4F5', waterLine: '#8FC4EE', park: '#CFEBC8', building: '#E6E3DE', building3d: '#ECEAE6',
  road: '#FFFFFF', roadMajor: '#FFFFFF', highway: '#FFE3A3', casing: '#DCD8D1', label: '#5B6475', halo: '#FFFFFF', cliff: '#E2E9D8',
};
export const NIGHT: Palette = {
  land: '#121826', landuse: '#151C2B', water: '#0C2742', waterLine: '#123554', park: '#12302A', building: '#1C2435', building3d: '#232D42',
  road: '#2B3549', roadMajor: '#37435C', highway: '#4B4A3A', casing: '#0E131E', label: '#9AA7BD', halo: '#0F1420', cliff: '#151F22',
};

const ONLINE_STYLE = 'https://tiles.openfreemap.org/styles/positron';
let cachedOnline: StyleSpecification | null | undefined;

async function fetchOnline(): Promise<StyleSpecification | null> {
  if (cachedOnline !== undefined) return cachedOnline ? structuredClone(cachedOnline) : null;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 3500);
  try {
    const res = await fetch(ONLINE_STYLE, { signal: ctl.signal });
    if (!res.ok) throw new Error('style');
    cachedOnline = (await res.json()) as StyleSpecification;
    return structuredClone(cachedOnline);
  } catch {
    cachedOnline = null;
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function patchOnline(style: StyleSpecification, pal: Palette): StyleSpecification {
  const layers: LayerSpecification[] = [];
  for (const l of style.layers) {
    const id = l.id.toLowerCase();
    const sl = ('source-layer' in l ? (l['source-layer'] as string) : '') || '';
    const paint: Record<string, unknown> = { ...(l as { paint?: Record<string, unknown> }).paint };
    if (l.type === 'background') paint['background-color'] = pal.land;
    else if (l.type === 'fill') {
      if (sl === 'water' || id.includes('water')) paint['fill-color'] = pal.water;
      else if (sl === 'park' || id.includes('park') || id.includes('wood') || id.includes('grass') || sl === 'landcover') paint['fill-color'] = pal.park;
      else if (sl === 'building' || id.includes('building')) { paint['fill-color'] = pal.building; paint['fill-outline-color'] = pal.casing; }
      else paint['fill-color'] = pal.landuse;
    } else if (l.type === 'line') {
      if (sl === 'water' || sl === 'waterway' || id.includes('water')) paint['line-color'] = pal.waterLine;
      else if (sl === 'transportation' || id.includes('road') || id.includes('highway') || id.includes('tunnel') || id.includes('bridge')) {
        if (id.includes('casing')) paint['line-color'] = pal.casing;
        else if (id.includes('motorway') || id.includes('trunk')) paint['line-color'] = pal.highway;
        else if (id.includes('major') || id.includes('primary') || id.includes('secondary')) paint['line-color'] = pal.roadMajor;
        else if (id.includes('rail')) paint['line-color'] = pal.casing;
        else paint['line-color'] = pal.road;
      } else if (sl === 'boundary') paint['line-opacity'] = 0.3;
    } else if (l.type === 'symbol') {
      if ('text-color' in paint || true) {
        paint['text-color'] = id.includes('water') ? pal.waterLine : pal.label;
        paint['text-halo-color'] = pal.halo;
        paint['text-halo-width'] = 1.4;
      }
    }
    layers.push({ ...l, paint } as LayerSpecification);
  }
  // Bâtiments 3D
  const firstSymbol = layers.findIndex((l) => l.type === 'symbol');
  const srcName = Object.keys(style.sources).find((k) => (style.sources[k] as { type: string }).type === 'vector') ?? 'openmaptiles';
  const extrude: LayerSpecification = {
    id: 'app-3d-buildings',
    type: 'fill-extrusion',
    source: srcName,
    'source-layer': 'building',
    minzoom: 14.5,
    paint: {
      'fill-extrusion-color': pal.building3d,
      'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14.5, 0, 15.5, ['coalesce', ['get', 'render_height'], 8]],
      'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
      'fill-extrusion-opacity': 0.88,
    },
  } as LayerSpecification;
  layers.splice(firstSymbol < 0 ? layers.length : firstSymbol, 0, extrude);
  return { ...style, layers };
}

function offlineStyle(pal: Palette): StyleSpecification {
  const g = baseGeometry();
  const fc = (features: unknown[]) => ({ type: 'geojson' as const, data: { type: 'FeatureCollection', features } as GeoJSON.FeatureCollection });
  return {
    version: 8,
    name: 'Saint-Roch hors-ligne',
    sources: {
      land: fc([g.land]),
      cliff: fc([g.cliff]),
      river: fc([g.river]),
      parks: fc(g.parks),
      streets: fc(g.streets),
      buildings: fc(g.buildings),
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': pal.land } },
      { id: 'cliff', type: 'fill', source: 'cliff', paint: { 'fill-color': pal.cliff } },
      { id: 'river', type: 'fill', source: 'river', paint: { 'fill-color': pal.water } },
      { id: 'river-edge', type: 'line', source: 'river', paint: { 'line-color': pal.waterLine, 'line-width': 2 } },
      { id: 'parks', type: 'fill', source: 'parks', paint: { 'fill-color': pal.park } },
      { id: 'streets-casing', type: 'line', source: 'streets', filter: ['!=', ['get', 'kind'], 'ruelle'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': pal.casing, 'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 13, ['match', ['get', 'kind'], 'boulevard', 4, 'commerciale', 3.5, 2.2], 18, ['match', ['get', 'kind'], 'boulevard', 34, 'commerciale', 28, 18]] } },
      { id: 'streets', type: 'line', source: 'streets', filter: ['!=', ['get', 'kind'], 'ruelle'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['match', ['get', 'kind'], 'boulevard', pal.roadMajor, pal.road], 'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 13, ['match', ['get', 'kind'], 'boulevard', 3, 'commerciale', 2.6, 1.4], 18, ['match', ['get', 'kind'], 'boulevard', 30, 'commerciale', 24, 15]] } },
      { id: 'alleys', type: 'line', source: 'streets', filter: ['==', ['get', 'kind'], 'ruelle'], layout: { 'line-cap': 'round' }, paint: { 'line-color': pal.road, 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 1, 18, 6], 'line-dasharray': [2, 1.5], 'line-opacity': 0.9 } },
      { id: 'buildings-flat', type: 'fill', source: 'buildings', paint: { 'fill-color': pal.building } },
      {
        id: 'app-3d-buildings', type: 'fill-extrusion', source: 'buildings', minzoom: 14,
        paint: {
          'fill-extrusion-color': ['interpolate', ['linear'], ['get', 'tone'], 0, pal.building3d, 1, pal.building],
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 15.2, ['get', 'h']],
          'fill-extrusion-opacity': 0.9,
        },
      },
    ],
  } as StyleSpecification;
}

/* ---------- Deuxième source réelle : tuiles matricielles CARTO (OpenStreetMap) ---------- */
let rasterOk: boolean | undefined;
async function probeRaster(): Promise<boolean> {
  if (rasterOk !== undefined) return rasterOk;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 3500);
  try {
    // Tuile de Saint-Roch (z15)
    const res = await fetch('https://a.basemaps.cartocdn.com/rastertiles/voyager/15/9901/11547.png', { signal: ctl.signal, mode: 'cors' });
    rasterOk = res.ok;
  } catch {
    rasterOk = false;
  } finally {
    clearTimeout(timer);
  }
  return rasterOk;
}

function rasterStyle(night: boolean, pal: Palette): StyleSpecification {
  const flavor = night ? 'dark_all' : 'rastertiles/voyager';
  return {
    version: 8,
    name: 'Saint-Roch (CARTO / OpenStreetMap)',
    sources: {
      carto: {
        type: 'raster',
        tiles: ['a', 'b', 'c', 'd'].map((sub) => `https://${sub}.basemaps.cartocdn.com/${flavor}/{z}/{x}/{y}@2x.png`),
        tileSize: 256,
        maxzoom: 20,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>',
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': pal.land } },
      { id: 'carto', type: 'raster', source: 'carto', paint: { 'raster-fade-duration': 200 } },
    ],
  } as StyleSpecification;
}

export type MapSource = 'vector' | 'raster' | 'offline';

/** Vraie carte vectorielle (OpenFreeMap) → vraie carte matricielle (CARTO) → carte stylisée hors-ligne. */
export async function buildStyle(night: boolean): Promise<{ style: StyleSpecification; online: boolean; source: MapSource }> {
  const pal = night ? NIGHT : DAY;
  const online = await fetchOnline();
  if (online) return { style: patchOnline(online, pal), online: true, source: 'vector' };
  if (await probeRaster()) return { style: rasterStyle(night, pal), online: true, source: 'raster' };
  return { style: offlineStyle(pal), online: false, source: 'offline' };
}
