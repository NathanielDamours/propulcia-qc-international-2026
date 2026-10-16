import { useUI } from './store';
import { LngLat } from './geo';
import { ME } from './geo';
import { useRoutes } from './routeStore';

/** Actions transversales qui relient les fonctionnalités entre elles. */
export function goRoute(ll: LngLat, label: string, mode: 'foot' | 'car' = 'foot') {
  const ui = useUI.getState();
  useRoutes.getState().set({ routes: [], selected: null });
  ui.clearOverlays();
  ui.setTab('trajets');
  ui.setNav(false);
  ui.setTravelMode(mode);
  ui.setFrom({ ll: ME, label: 'Ma position' });
  ui.setTo({ ll, label });
}

export function showOnMap(type: 'place' | 'parking' | 'event' | 'report' | 'stop', id: string, ll: LngLat) {
  const ui = useUI.getState();
  ui.clearOverlays();
  ui.setTab(type === 'report' && ui.tab === 'signaler' ? 'signaler' : 'carte');
  setTimeout(() => {
    ui.select({ type, id });
    ui.flyTo(ll, 16.8);
  }, 60);
}

export function parkingNear(ll: LngLat) {
  const ui = useUI.getState();
  ui.clearOverlays();
  ui.setTab('parking');
  ui.setParkingFocus(ll);
  ui.flyTo(ll, 16);
}
