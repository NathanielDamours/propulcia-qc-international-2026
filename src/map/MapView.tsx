import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import maplibregl, { Map as MLMap, GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { buildStyle } from './mapStyle';
import { CENTER, GRID_ANGLE, LngLat, bounds, dist } from '../lib/geo';
import { GRAPH, streetLabelPoints } from '../data/streets';
import { useLighting } from '../lib/lighting';
import { isNight, useApp, useUI } from '../lib/store';

interface MapCtxValue { map: MLMap | null; ready: boolean; online: boolean; styleVersion: number }
const MapCtx = createContext<MapCtxValue>({ map: null, ready: false, online: false, styleVersion: 0 });
export const useMap = () => useContext(MapCtx);

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

export function lampsGeoJSON(): GeoJSON.FeatureCollection {
  const { lamps } = useLighting.getState();
  return {
    type: 'FeatureCollection',
    features: lamps.map((l) => ({ type: 'Feature', properties: { p: l.ok ? l.power : 0, ok: l.ok, src: l.source ?? 'Fictif' }, geometry: { type: 'Point', coordinates: l.ll } })),
  };
}
export function litGeoJSON(): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: GRAPH.edges.map((e) => ({ type: 'Feature', properties: { light: e.light }, geometry: { type: 'LineString', coordinates: e.coords } })) };
}

function addAppLayers(map: MLMap, night: boolean, online: boolean) {
  if (!map.getSource('app-lamps')) {
    map.addSource('app-lamps', {
      type: 'geojson',
      data: lampsGeoJSON(),
    });
  }
  if (!map.getSource('app-lit')) {
    map.addSource('app-lit', {
      type: 'geojson',
      data: litGeoJSON(),
    });
  }
  if (!map.getSource('app-biz')) map.addSource('app-biz', { type: 'geojson', data: EMPTY });
  if (!map.getSource('app-stops')) map.addSource('app-stops', { type: 'geojson', data: EMPTY });
  if (!map.getSource('app-routes')) map.addSource('app-routes', { type: 'geojson', data: EMPTY });
  if (!map.getSource('app-route-ends')) map.addSource('app-route-ends', { type: 'geojson', data: EMPTY });

  const before = map.getLayer('app-3d-buildings') ? 'app-3d-buildings' : undefined;
  map.addLayer({
    id: 'app-lamps-heat', type: 'heatmap', source: 'app-lamps', maxzoom: 19,
    layout: { visibility: 'none' },
    paint: {
      'heatmap-weight': ['get', 'p'],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 13, 0.6, 17, 1.4],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 13, 8, 16, 26, 18, 60],
      'heatmap-opacity': night ? 0.75 : 0.55,
      'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(255,200,60,0)', 0.25, 'rgba(255,196,64,0.25)', 0.5, 'rgba(255,183,0,0.55)', 0.8, 'rgba(255,214,102,0.8)', 1, 'rgba(255,244,200,0.95)'],
    },
  }, before);
  map.addLayer({
    id: 'app-lit-lines', type: 'line', source: 'app-lit',
    layout: { visibility: 'none', 'line-cap': 'round' },
    paint: {
      'line-color': ['interpolate', ['linear'], ['get', 'light'], 0.2, '#EF4444', 0.45, '#F59E0B', 0.7, '#FACC15', 0.9, '#FDE68A'],
      'line-width': ['interpolate', ['linear'], ['zoom'], 14, 2, 17, 6],
      'line-opacity': online ? 0.55 : 0.85,
      'line-blur': 1,
    },
  }, before);
  // Luminaires individuels (zoom rapproché) : LED en blanc froid, sodium en ambre, inactifs en gris
  map.addLayer({
    id: 'app-lamps-dots', type: 'circle', source: 'app-lamps', minzoom: 15.5,
    layout: { visibility: 'none' },
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 15.5, 1.8, 18, 4.5],
      'circle-color': ['case', ['!', ['get', 'ok']], '#94A3B8', ['in', ['get', 'src'], ['literal', ['LED', 'DEL']]], '#E0F2FE', '#FBBF24'],
      'circle-stroke-width': 1,
      'circle-stroke-color': night ? '#0B1020' : '#FFFFFF',
      'circle-opacity': 0.95,
    },
  });
  // Entreprises du registre (centaines de points : couche native plutôt que marqueurs HTML)
  map.addLayer({
    id: 'app-biz-dots', type: 'circle', source: 'app-biz', minzoom: 15.2,
    layout: { visibility: 'none' },
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 15.2, 3, 17, 6.5, 19, 9],
      'circle-color': ['get', 'color'],
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 15.2, 1, 17, 2],
      'circle-stroke-color': night ? '#0B1020' : '#FFFFFF',
      'circle-opacity': ['interpolate', ['linear'], ['zoom'], 15.2, 0, 15.6, 0.95],
      'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 15.2, 0, 15.6, 1],
    },
  });
  // Arrêts d'autobus (GTFS du RTC)
  map.addLayer({
    id: 'app-stops-dot', type: 'circle', source: 'app-stops', minzoom: 14.6,
    layout: { visibility: 'none' },
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 14.6, 3, 16, 6, 18, 9],
      'circle-color': '#1D4ED8',
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 14.6, 1, 16, 2.5],
      'circle-stroke-color': '#FFFFFF',
      'circle-opacity': ['interpolate', ['linear'], ['zoom'], 14.6, 0, 15, 1],
      'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 14.6, 0, 15, 1],
    },
  });
  map.addLayer({
    id: 'app-stops-core', type: 'circle', source: 'app-stops', minzoom: 16,
    layout: { visibility: 'none' },
    paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 16, 1.8, 18, 3], 'circle-color': '#FFFFFF' },
  });
  // Itinéraires : halo, contour, tracé
  map.addLayer({ id: 'app-routes-glow', type: 'line', source: 'app-routes', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': ['case', ['get', 'selected'], 18, 0], 'line-opacity': 0.18, 'line-blur': 6 } });
  map.addLayer({ id: 'app-routes-casing', type: 'line', source: 'app-routes', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['case', ['get', 'selected'], '#FFFFFF', night ? '#1E2638' : '#FFFFFF'], 'line-width': ['case', ['get', 'selected'], 11, 8], 'line-opacity': ['case', ['get', 'selected'], 1, 0.9] } });
  map.addLayer({ id: 'app-routes-line', type: 'line', source: 'app-routes', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': ['case', ['get', 'selected'], 7, 5], 'line-opacity': ['case', ['get', 'selected'], 1, 0.5] } });
  map.addLayer({ id: 'app-routes-dots', type: 'line', source: 'app-routes', filter: ['==', ['get', 'selected'], true], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': 'rgba(255,255,255,0.85)', 'line-width': 2, 'line-dasharray': [0.1, 3] } });
}

export function MapView({ children }: { children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(false);
  const [styleVersion, setStyleVersion] = useState(0);
  const themePref = useApp((s) => s.theme);
  const night = isNight(themePref);
  const nightRef = useRef(night);
  nightRef.current = night;
  const onlineRef = useRef(false);

  useEffect(() => {
    let disposed = false;
    let m: MLMap | null = null;
    buildStyle(nightRef.current).then(({ style, online }) => {
      if (disposed || !ref.current) return;
      onlineRef.current = online;
      setOnline(online);
      m = new maplibregl.Map({
        container: ref.current,
        style,
        center: CENTER,
        zoom: 15.35,
        pitch: 50,
        bearing: -GRID_ANGLE,
        maxPitch: 70,
        attributionControl: false,
        fadeDuration: 200,
        dragRotate: true,
      });
      m.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: online ? '' : 'Carte hors-ligne' }), 'top-left');
      m.setPadding({ top: 120, bottom: 230, left: 0, right: 0 });
      m.once('idle', () => m!.getContainer().querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'));
      m.on('style.load', () => {
        addAppLayers(m!, nightRef.current, onlineRef.current);
        setStyleVersion((v) => v + 1);
      });
      m.on('load', () => {
        const c = m!.getCenter();
        useUI.getState().setMapCenter([c.lng, c.lat]);
        setReady(true);
      });
      m.on('moveend', () => {
        const c = m!.getCenter();
        useUI.getState().setMapCenter([c.lng, c.lat]);
      });
      m.on('click', (e) => {
        const ui = useUI.getState();
        if ((e.originalEvent.target as HTMLElement).closest('.mk')) return;
        const ll: LngLat = [e.lngLat.lng, e.lngLat.lat];
        if (ui.picking) {
          const label = nearestStreetLabel(ll);
          (ui.picking === 'from' ? ui.setFrom : ui.setTo)({ ll, label });
          ui.setPicking(ui.picking === 'from' && !ui.to ? 'to' : null);
          return;
        }
        if (ui.tab === 'trajets' && !ui.navActive) {
          if (!ui.to) { ui.setTo({ ll, label: nearestStreetLabel(ll) }); return; }
        }
        const clickable = ['app-biz-dots', 'app-stops-dot'].filter((l) => m!.getLayer(l) && m!.getLayoutProperty(l, 'visibility') !== 'none');
        if (clickable.length && m!.queryRenderedFeatures(e.point, { layers: clickable }).length) return;
        if (ui.selection) ui.select(null);
      });
      (window as unknown as { __map: MLMap }).__map = m;
      setMap(m);
    });
    return () => { disposed = true; m?.remove(); };
  }, []);

  // Changement de thème jour / nuit
  const first = useRef(true);
  useEffect(() => {
    if (!map) return;
    if (first.current) { first.current = false; return; }
    buildStyle(night).then(({ style }) => map.setStyle(style, { diff: false }));
  }, [night, map]);

  // Animation de caméra demandée par l'interface
  const fly = useUI((s) => s.fly);
  const fit = useUI((s) => s.fit);
  useEffect(() => {
    if (!map || !fly) return;
    map.flyTo({ center: fly.ll, zoom: fly.zoom ?? Math.max(map.getZoom(), 16.2), duration: 1400, essential: true, curve: 1.3 });
  }, [fly, map]);
  useEffect(() => {
    if (!map || !fit || fit.coords.length === 0) return;
    const b = bounds(fit.coords);
    // Les marges s'ajoutent à celles de la carte (en-tête et panneau) : on ne passe que le complément.
    const base = map.getPadding();
    const h = map.getContainer().clientHeight;
    const want = { top: 175, bottom: Math.round(h * 0.5), left: 44, right: 56 };
    const padding = {
      top: Math.max(10, want.top - base.top),
      bottom: Math.max(10, want.bottom - base.bottom),
      left: Math.max(10, want.left - base.left),
      right: Math.max(10, want.right - base.right),
    };
    const cam = map.cameraForBounds(b, { padding, bearing: map.getBearing(), maxZoom: 17.2 });
    if (cam) map.easeTo({ ...cam, pitch: 40, duration: 1200 });
  }, [fit, map]);

  return (
    <MapCtx.Provider value={{ map, ready, online, styleVersion }}>
      <div ref={ref} className="map-root" />
      {map && ready && children}
      {map && ready && !online && <StreetLabels />}
    </MapCtx.Provider>
  );
}

function nearestStreetLabel(ll: LngLat): string {
  let best = '';
  let bd = Infinity;
  for (const e of GRAPH.edges) {
    const mid: LngLat = [(e.coords[0][0] + e.coords[1][0]) / 2, (e.coords[0][1] + e.coords[1][1]) / 2];
    const d = Math.min(dist(ll, e.coords[0]), dist(ll, e.coords[1]), dist(ll, mid));
    if (d < bd) { bd = d; best = e.street; }
  }
  return bd < 120 ? `Près de ${best.replace(/^(Rue|Boulevard) /, (m) => m.toLowerCase())}` : 'Point sur la carte';
}

/* ---------- Marqueur HTML (React portal) ---------- */
export function MapMarker({ ll, children, onClick, z = 1, anchor = 'bottom', className = '' }: { ll: LngLat; children: ReactNode; onClick?: () => void; z?: number; anchor?: maplibregl.PositionAnchor; className?: string }) {
  const { map } = useMap();
  const [el] = useState(() => {
    const d = document.createElement('div');
    d.className = `mk ${className}`.trim();
    return d;
  });
  const prevClass = useRef(className);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const clickRef = useRef(onClick);
  clickRef.current = onClick;
  useEffect(() => {
    if (!map) return;
    const handler = (e: MouseEvent) => { e.stopPropagation(); clickRef.current?.(); };
    el.addEventListener('click', handler);
    const mk = new maplibregl.Marker({ element: el, anchor, subpixelPositioning: true }).setLngLat(ll).addTo(map);
    markerRef.current = mk;
    return () => { el.removeEventListener('click', handler); mk.remove(); };
  }, [map]);
  useEffect(() => { markerRef.current?.setLngLat(ll); }, [ll[0], ll[1]]);
  useEffect(() => { el.style.zIndex = String(z); }, [z]);
  useEffect(() => {
    prevClass.current.split(' ').filter(Boolean).forEach((c) => el.classList.remove(c));
    className.split(' ').filter(Boolean).forEach((c) => el.classList.add(c));
    prevClass.current = className;
  }, [className]);
  return createPortal(children, el);
}

function StreetLabels() {
  const { map } = useMap();
  const [zoom, setZoom] = useState(map?.getZoom() ?? 15);
  const [bearingDeg, setBearing] = useState(map?.getBearing() ?? 0);
  useEffect(() => {
    if (!map) return;
    const h = () => { setZoom(map.getZoom()); setBearing(map.getBearing()); };
    map.on('move', h);
    return () => { map.off('move', h); };
  }, [map]);
  if (zoom < 15) return null;
  return (
    <>
      {streetLabelPoints().map((s) => {
        const rot = (s.axis === 'ew' ? -GRID_ANGLE - s.angle : 90 - GRID_ANGLE - s.angle) - bearingDeg;
        let r = ((rot % 360) + 360) % 360;
        if (r > 90 && r < 270) r -= 180;
        return (
          <MapMarker key={s.id} ll={s.ll} anchor="center" z={0} className="street-label-wrap">
            <div className={`street-label ${s.kind}`} style={{ transform: `rotate(${-r}deg)` }}>{s.name}</div>
          </MapMarker>
        );
      })}
    </>
  );
}

/* ---------- Mise à jour d'une source GeoJSON ---------- */
export function useGeoJSON(sourceId: string, data: GeoJSON.FeatureCollection) {
  const { map, styleVersion } = useMap();
  useEffect(() => {
    if (!map) return;
    const src = map.getSource(sourceId) as GeoJSONSource | undefined;
    src?.setData(data);
  }, [map, data, styleVersion, sourceId]);
}

export function useLayerVisibility(layerIds: string[], visible: boolean) {
  const { map, styleVersion } = useMap();
  useEffect(() => {
    if (!map) return;
    for (const id of layerIds) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
  }, [map, visible, styleVersion, layerIds.join()]);
}
