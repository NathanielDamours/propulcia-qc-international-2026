import { useEffect, useMemo, useRef, useState } from 'react';
import { Bus, Flag, Navigation2 } from 'lucide-react';
import { useStops } from '../lib/stopsData';
import { MapMarker, lampsGeoJSON, litGeoJSON, useGeoJSON, useLayerVisibility, useMap } from './MapView';
import { useLighting } from '../lib/lighting';
import { CATEGORY_META } from '../data/places';
import { PARKING_COLOR } from '../data/parkings';
import { useParkings } from '../lib/parkingData';
import { EVENT_META } from '../data/events';
import { REPORT_META, isActiveReport } from '../data/community';
import { Icon } from '../components/Icon';
import { useUI } from '../lib/store';
import { useEvents, useReports, dayParts, usePlaces } from '../lib/selectors';
import { useBusinessData } from '../lib/businessData';
import { useRoutes } from '../lib/routeStore';
import maplibregl from 'maplibre-gl';
import { sliceLine, ME } from '../lib/geo';

export { ME };

export function MapLayers() {
  const tab = useUI((s) => s.tab);
  const layers = useUI((s) => s.layers);
  const selection = useUI((s) => s.selection);
  const select = useUI((s) => s.select);
  const flyTo = useUI((s) => s.flyTo);
  const from = useUI((s) => s.from);
  const to = useUI((s) => s.to);
  const navActive = useUI((s) => s.navActive);
  const events = useEvents();
  const reports = useReports();
  const parkings = useParkings();
  const { map } = useMap();
  const [zoom, setZoom] = useState(map?.getZoom() ?? 15);

  useEffect(() => {
    if (!map) return;
    const h = () => setZoom(map.getZoom());
    map.on('zoomend', h);
    return () => { map.off('zoomend', h); };
  }, [map]);

  const isMapTab = tab === 'carte' || tab === 'annuaire' || tab === 'evenements' || tab === 'groupes' || tab === 'collabs' || tab === 'admin';
  const show = {
    places: layers.places && (isMapTab || (tab === 'trajets' && !navActive && zoom > 15.8)),
    parkings: (isMapTab && layers.parkings) || tab === 'parking',
    events: isMapTab && layers.events,
    reports: ((isMapTab || tab === 'trajets') && layers.reports) || tab === 'signaler',
  };
  // Les couches désactivées par l'utilisateur restent masquées, y compris pendant un itinéraire.
  const lighting = layers.lighting;
  useLayerVisibility(['app-lamps-heat'], lighting);
  useLayerVisibility(['app-lit-lines'], layers.lighting && tab !== 'trajets');
  useLayerVisibility(['app-lamps-dots'], lighting);
  const lightingVersion = useLighting((s) => s.lamps);
  const lampData = useMemo(() => lampsGeoJSON(), [lightingVersion]);
  const litData = useMemo(() => litGeoJSON(), [lightingVersion]);
  useGeoJSON('app-lamps', lampData);
  useGeoJSON('app-lit', litData);

  // Registre des entreprises
  const allPlaces = usePlaces();
  const registry = useMemo(() => allPlaces.filter((p) => p.registry), [allPlaces]);
  const bizData = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: registry.filter((p) => p.located).map((p) => ({ type: 'Feature', properties: { id: p.id, color: CATEGORY_META[p.category].color }, geometry: { type: 'Point', coordinates: p.ll } })),
  }), [registry]);
  useGeoJSON('app-biz', bizData);
  const registryRef = useRef(registry);
  registryRef.current = registry;
  useLayerVisibility(['app-biz-dots'], show.places);
  useEffect(() => {
    if (!map) return;
    const onClick = (e: maplibregl.MapLayerMouseEvent) => {
      const id = e.features?.[0]?.properties?.id as string | undefined;
      const p = id && registryRef.current.find((x) => x.id === id);
      if (p) { select({ type: 'place', id: p.id }); flyTo(p.ll); }
    };
    const enter = () => { map.getCanvas().style.cursor = 'pointer'; };
    const leave = () => { map.getCanvas().style.cursor = ''; };
    map.on('click', 'app-biz-dots', onClick);
    map.on('mouseenter', 'app-biz-dots', enter);
    map.on('mouseleave', 'app-biz-dots', leave);
    return () => { map.off('click', 'app-biz-dots', onClick); map.off('mouseenter', 'app-biz-dots', enter); map.off('mouseleave', 'app-biz-dots', leave); };
  }, [map]);
  // Arrêts d'autobus
  const stops = useStops((st) => st.stops);
  const stopsData = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: stops.map((st) => ({ type: 'Feature', properties: { id: st.id }, geometry: { type: 'Point', coordinates: st.ll } })),
  }), [stops]);
  useGeoJSON('app-stops', stopsData);
  const showStops = layers.stops && (isMapTab || tab === 'trajets');
  useLayerVisibility(['app-stops-dot', 'app-stops-core'], showStops);
  useEffect(() => {
    if (!map) return;
    const onClick = (e: maplibregl.MapLayerMouseEvent) => {
      const id = e.features?.[0]?.properties?.id as string | undefined;
      const st = id && useStops.getState().stops.find((x) => x.id === id);
      if (!st) return;
      const ui = useUI.getState();
      if (ui.tab === 'trajets' && !ui.navActive) { ui.setTo({ ll: st.ll, label: `Arrêt ${st.name}` }); return; }
      select({ type: 'stop', id: st.id });
      flyTo(st.ll);
    };
    const enter = () => { map.getCanvas().style.cursor = 'pointer'; };
    const leave = () => { map.getCanvas().style.cursor = ''; };
    map.on('click', 'app-stops-dot', onClick);
    map.on('mouseenter', 'app-stops-dot', enter);
    map.on('mouseleave', 'app-stops-dot', leave);
    return () => { map.off('click', 'app-stops-dot', onClick); map.off('mouseenter', 'app-stops-dot', enter); map.off('mouseleave', 'app-stops-dot', leave); };
  }, [map]);
  const selectedStop = selection?.type === 'stop' ? stops.find((st) => st.id === selection.id) : undefined;

  const selectedRegistry = selection?.type === 'place' ? allPlaces.find((p) => p.id === selection.id && p.registry && p.located) : undefined;

  const isSel = (type: string, id: string) => selection?.type === type && selection.id === id;
  const compact = zoom < 15.9 && tab !== 'parking';

  return (
    <>
      <MapMarker ll={ME} anchor="center" z={2}>
        <div className="me-dot"><span /></div>
      </MapMarker>

      {selectedStop && (
        <MapMarker key={`stop-${selectedStop.id}`} ll={selectedStop.ll} z={56}>
          <div className="pin place sel" style={{ ['--c' as string]: '#1D4ED8' }}>
            <div className="pin-head"><Bus size={17} /></div>
            <div className="pin-label">{selectedStop.name}</div>
          </div>
        </MapMarker>
      )}

      {selectedRegistry && (
        <MapMarker key={selectedRegistry.id} ll={selectedRegistry.ll} z={55}>
          <div className="pin place sel" style={{ ['--c' as string]: CATEGORY_META[selectedRegistry.category].color }}>
            <div className="pin-head"><Icon name={CATEGORY_META[selectedRegistry.category].icon} size={18} /></div>
            <div className="pin-label">{selectedRegistry.name}</div>
          </div>
        </MapMarker>
      )}

      {parkings.filter((p) => show.parkings || isSel('parking', p.id)).map((p) => {
        const sel = isSel('parking', p.id);
        return (
          <MapMarker key={p.id} ll={p.ll} z={sel ? 60 : 5} onClick={() => { select({ type: 'parking', id: p.id }); flyTo(p.ll); }}>
            <div className={`pmk ${sel ? 'sel' : ''}`} style={{ ['--c' as string]: PARKING_COLOR }}>
              <div className="pmk-p">P</div>
              {!compact && (
                <div className="pmk-info">
                  <b>{p.capacity || '—'}</b>
                  <span>cases</span>
                </div>
              )}
            </div>
          </MapMarker>
        );
      })}

      {events.filter((e) => show.events || isSel('event', e.id)).map((e) => {
        const sel = isSel('event', e.id);
        const meta = EVENT_META[e.category];
        const { day, month } = dayParts(e.start);
        const today = new Date(e.start).toDateString() === new Date().toDateString();
        return (
          <MapMarker key={e.id} ll={e.ll} z={sel ? 70 : 6} onClick={() => { select({ type: 'event', id: e.id }); flyTo(e.ll); }}>
            <div className={`emk ${sel ? 'sel' : ''} ${today ? 'today' : ''} ${compact && !sel ? 'compact' : ''}`} style={{ ['--g1' as string]: meta.gradient[0], ['--g2' as string]: meta.gradient[1] }}>
              {today && <span className="emk-pulse" />}
              <div className="emk-body">
                <b>{day}</b>
                <span>{month}</span>
              </div>
              <div className="emk-tail" />
            </div>
          </MapMarker>
        );
      })}

      {reports.filter((r) => (show.reports && (r.status === 'resolu' || isActiveReport(r))) || isSel('report', r.id)).map((r) => {
        const m = REPORT_META[r.category];
        const sel = isSel('report', r.id);
        return (
          <MapMarker key={r.id} ll={r.ll} anchor="center" z={sel ? 80 : 4} onClick={() => { select({ type: 'report', id: r.id }); flyTo(r.ll); }}>
            <div className={`rmk ${sel ? 'sel' : ''} ${r.status === 'resolu' ? 'done' : ''}`} style={{ ['--c' as string]: m.color }}>
              <Icon name={m.icon} size={13} strokeWidth={2.4} />
            </div>
          </MapMarker>
        );
      })}

      {tab === 'trajets' && from && (
        <MapMarker ll={from.ll} anchor="center" z={90}>
          <div className="route-start" />
        </MapMarker>
      )}
      {tab === 'trajets' && to && (
        <MapMarker ll={to.ll} z={91}>
          <div className="route-end"><Flag size={16} strokeWidth={2.6} /></div>
        </MapMarker>
      )}
      {tab === 'trajets' && <RouteLines />}
      {tab === 'trajets' && navActive && <NavDot />}
    </>
  );
}

function RouteLines() {
  const routes = useRoutes((s) => s.routes);
  const selected = useRoutes((s) => s.selected);
  const setR = useRoutes((s) => s.set);
  const { map } = useMap();
  const [frac, setFrac] = useState(1);

  useEffect(() => {
    if (routes.length === 0) return;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const f = Math.min(1, (t - start) / 900);
      setFrac(1 - Math.pow(1 - f, 3));
      if (f < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [routes]);

  useEffect(() => {
    if (!map) return;
    const h = (e: maplibregl.MapLayerMouseEvent) => {
      const id = e.features?.[0]?.properties?.id;
      if (id) setR({ selected: id });
    };
    map.on('click', 'app-routes-line', h);
    return () => { map.off('click', 'app-routes-line', h); };
  }, [map]);

  const data = useMemo<GeoJSON.FeatureCollection>(() => {
    const sorted = [...routes].sort((a, b) => (a.id === selected ? 1 : 0) - (b.id === selected ? 1 : 0));
    return {
      type: 'FeatureCollection',
      features: sorted.map((r) => ({ type: 'Feature', properties: { id: r.id, color: r.color, selected: r.id === selected }, geometry: { type: 'LineString', coordinates: sliceLine(r.coords, frac) } })),
    };
  }, [routes, selected, frac]);
  useGeoJSON('app-routes', data);
  useEffect(() => () => {
    const src = map?.getSource('app-routes') as maplibregl.GeoJSONSource | undefined;
    src?.setData({ type: 'FeatureCollection', features: [] });
  }, [map]);
  return null;
}

function NavDot() {
  const pos = useRoutes((s) => s.navPos);
  const { map } = useMap();
  useEffect(() => {
    if (!map || !pos) return;
    map.easeTo({ center: pos, zoom: 16.9, pitch: 55, duration: 520, easing: (t) => t, offset: [0, 60] });
  }, [pos?.[0], pos?.[1]]);
  if (!pos) return null;
  return (
    <MapMarker ll={pos} anchor="center" z={100}>
      <div className="nav-dot"><Navigation2 size={16} fill="#fff" strokeWidth={0} /></div>
    </MapMarker>
  );
}
