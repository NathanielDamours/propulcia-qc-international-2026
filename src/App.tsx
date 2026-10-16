import { ReactNode, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Map as MapIcon, Route, SquareParking, CalendarDays, Users, Store, Handshake, TriangleAlert, LayoutDashboard, Layers, LocateFixed, Compass, Box,
  Bus, Moon, Sun, SunMoon, RefreshCw, LogOut, Info, X, Lightbulb, MapPin,
} from 'lucide-react';
import { MapView, useMap } from './map/MapView';
import { MapLayers } from './map/MapLayers';
import { Profile, Tab, isNight, useApp, useUI } from './lib/store';
import { ProfilePicker, PROFILES } from './screens/ProfilePicker';
import { ExploreSheet, SearchBar } from './screens/Explore';
import { RouteHeader, RouteSheet } from './screens/RoutePlanner';
import { ParkingSheet } from './screens/ParkingSheet';
import { EventDetailPage, EventsPage, PublishEventModal } from './screens/Events';
import { GroupDetailPage, GroupsPage } from './screens/Groups';
import { AnnoncePage, ChatPage, CollabsPage, DirectoryPage, NewAnnonceModal, PlacePage, ProposeModal } from './screens/Business';
import { AdminPage, ReportSheet } from './screens/Reports';
import { Toast } from './components/ui';
import { ME, GRID_ANGLE } from './lib/geo';

const TAB_META: Record<Tab, { label: string; icon: ReactNode }> = {
  carte: { label: 'Carte', icon: <MapIcon size={22} /> },
  trajets: { label: 'Trajets', icon: <Route size={22} /> },
  parking: { label: 'Parking', icon: <SquareParking size={22} /> },
  evenements: { label: 'Événements', icon: <CalendarDays size={22} /> },
  groupes: { label: 'Groupes', icon: <Users size={22} /> },
  annuaire: { label: 'Annuaire', icon: <Store size={22} /> },
  collabs: { label: 'Collabs', icon: <Handshake size={22} /> },
  signaler: { label: 'Signaler', icon: <TriangleAlert size={22} /> },
  admin: { label: 'Gestion', icon: <LayoutDashboard size={22} /> },
};

export const TABS: Record<Profile, Tab[]> = {
  citoyen: ['carte', 'evenements', 'groupes', 'signaler'],
  entreprise: ['carte', 'annuaire', 'collabs', 'evenements', 'signaler'],
  ville: ['carte', 'admin', 'signaler', 'evenements'],
};

const MAP_TABS: Tab[] = ['carte', 'trajets', 'parking', 'signaler'];

export default function App() {
  const profile = useApp((s) => s.profile);
  const theme = useApp((s) => s.theme);
  const night = isNight(theme);
  // Dernier profil choisi : sert de fond pendant l'écran de choix (la carte se prépare derrière)
  const [lastProfile, setLastProfile] = useState<Profile>(profile ?? 'citoyen');
  useEffect(() => { if (profile) setLastProfile(profile); }, [profile]);

  useEffect(() => {
    document.documentElement.dataset.theme = night ? 'dark' : 'light';
  }, [night]);

  return (
    <div className="stage">
      <aside className="stage-side">
        <div className="brand-logo"><MapPin size={22} strokeWidth={2.4} /></div>
        <h1>Notre Saint-Roch</h1>
        <p>Application mobile pour la revitalisation du quartier Saint-Roch, Québec.</p>
        <ul>
          <li><b>1.</b> Déplacements sécuritaires</li>
          <li><b>2.</b> Stationnement</li>
          <li><b>3.</b> Événements</li>
          <li><b>4.</b> Groupes</li>
          <li><b>5.</b> Entreprises & collaborations</li>
          <li><b>6.</b> Signalements</li>
        </ul>
      </aside>
      <div className="device">
        <div className="device-screen">
          {/* La carte reste montée en permanence : changer de profil ne la recharge pas (style, tuiles, lieux) */}
          <Shell profile={profile ?? lastProfile} />
          <AnimatePresence>{!profile && <ProfilePicker key="picker" />}</AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function Shell({ profile }: { profile: Profile }) {
  const tab = useUI((s) => s.tab);
  const setTab = useUI((s) => s.setTab);
  const overlays = useUI((s) => s.overlays);
  const navActive = useUI((s) => s.navActive);
  const reportPick = useUI((s) => s.reportPick);
  const pushOverlay = useUI((s) => s.pushOverlay);
  const tabs = TABS[profile];
  const isMapTab = MAP_TABS.includes(tab);
  const me = PROFILES.find((p) => p.id === profile)!;

  // Si l'onglet courant n'est pas dans la barre du profil, il reste accessible via le menu.
  return (
    <motion.div className={`shell ${navActive ? 'nav-mode' : ''}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <MapView>
        <MapLayers />
        <CameraTools />
      </MapView>

      {isMapTab && tab !== 'trajets' && !navActive && (
        <div className="top-ui">
          <SearchBar onAvatar={() => pushOverlay({ kind: 'menu' })} avatar={<span className="sb-av" style={{ background: `linear-gradient(135deg, ${me.g[0]}, ${me.g[1]})` }}>{me.icon}</span>} />
          {tab === 'carte' && <LayerChips />}
        </div>
      )}
      <AnimatePresence>{tab === 'trajets' && <RouteHeader key="rh" />}</AnimatePresence>

      {reportPick && (
        <div className="crosshair">
          <motion.div className="crosshair-pin" initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
            <MapPin size={40} strokeWidth={2.2} fill="#EF4444" color="#fff" />
          </motion.div>
          <span className="crosshair-shadow" />
        </div>
      )}

      <div className="sheets">
        <AnimatePresence mode="popLayout">
          {tab === 'carte' && <ExploreSheet key="explore" />}
          {tab === 'trajets' && <RouteSheet key="route" />}
          {tab === 'parking' && <ParkingSheet key="parking" />}
          {tab === 'signaler' && <ReportSheet key="report" />}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {!isMapTab && (
          <motion.div key={tab} className="page-layer" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }} transition={{ type: 'spring', stiffness: 380, damping: 36 }}>
            {tab === 'evenements' && <EventsPage />}
            {tab === 'groupes' && <GroupsPage />}
            {tab === 'annuaire' && <DirectoryPage />}
            {tab === 'collabs' && <CollabsPage />}
            {tab === 'admin' && <AdminPage />}
          </motion.div>
        )}
      </AnimatePresence>

      {!navActive && (
        <nav className="tabbar">
          {tabs.map((t) => (
            <button key={t} className={`tab ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>
              {tab === t && <motion.span layoutId="tab-pill" className="tab-pill" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
              <span className="tab-icon">{TAB_META[t].icon}</span>
              <span className="tab-label">{TAB_META[t].label}</span>
            </button>
          ))}
        </nav>
      )}

      <AnimatePresence>
        {overlays.map((o, i) => {
          const key = `${o.kind}-${i}`;
          switch (o.kind) {
            case 'event': return <EventDetailPage key={key} id={o.id} />;
            case 'group': return <GroupDetailPage key={key} id={o.id} />;
            case 'annonce': return <AnnoncePage key={key} id={o.id} />;
            case 'chat': return <ChatPage key={key} proposalId={o.proposalId} />;
            case 'place': return <PlacePage key={key} id={o.id} />;
            case 'publish-event': return <PublishEventModal key={key} />;
            case 'new-annonce': return <NewAnnonceModal key={key} />;
            case 'propose': return <ProposeModal key={key} annonceId={o.annonceId} />;
            case 'menu': return <Menu key={key} profile={profile} />;
            default: return null;
          }
        })}
      </AnimatePresence>
      <Toast />
    </motion.div>
  );
}

function LayerChips() {
  const layers = useUI((s) => s.layers);
  const toggle = useUI((s) => s.toggleLayer);
  const items: { k: keyof typeof layers; label: string; icon: ReactNode; color: string }[] = [
    { k: 'parkings', label: 'Stationnements', icon: <b className="chip-p">P</b>, color: '#2563EB' },
    { k: 'events', label: 'Événements', icon: <CalendarDays size={14} />, color: '#E11D48' },
    { k: 'places', label: 'Lieux', icon: <Store size={14} />, color: '#F97316' },
    { k: 'stops', label: 'Bus', icon: <Bus size={14} />, color: '#1D4ED8' },
    { k: 'reports', label: 'Signalements', icon: <TriangleAlert size={14} />, color: '#EF4444' },
    { k: 'lighting', label: 'Éclairage', icon: <Lightbulb size={14} />, color: '#EAB308' },
  ];
  return (
    <motion.div className="layer-chips" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
      {items.map((it) => (
        <button key={it.k} className={`map-chip ${layers[it.k] ? 'on' : ''}`} style={{ ['--c' as string]: it.color }} onClick={() => toggle(it.k)}>
          {it.icon}{it.label}
        </button>
      ))}
    </motion.div>
  );
}

function CameraTools() {
  const { map } = useMap();
  const tab = useUI((s) => s.tab);
  const navActive = useUI((s) => s.navActive);
  const theme = useApp((s) => s.theme);
  const setTheme = useApp((s) => s.setTheme);
  const [bearingDeg, setBearing] = useState(map?.getBearing() ?? 0);
  const [pitch, setPitch] = useState(map?.getPitch() ?? 0);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!map) return;
    const h = () => { setBearing(map.getBearing()); setPitch(map.getPitch()); };
    map.on('rotate', h);
    map.on('pitch', h);
    return () => { map.off('rotate', h); map.off('pitch', h); };
  }, [map]);
  if (!map || !MAP_TABS.includes(tab) || navActive) return null;
  const top = tab === 'trajets' ? 152 : tab === 'carte' ? 128 : 84;
  return (
    <div className="fab-col" style={{ top }}>
      <button className="fab" onClick={() => setOpen(!open)} aria-label="Style de carte"><Layers size={19} /></button>
      <AnimatePresence>
        {open && (
          <motion.div className="fab-pop" initial={{ opacity: 0, scale: 0.9, x: 10 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9 }}>
            {([['auto', <SunMoon size={16} key="a" />, 'Auto'], ['jour', <Sun size={16} key="j" />, 'Jour'], ['nuit', <Moon size={16} key="n" />, 'Nuit']] as const).map(([v, ic, l]) => (
              <button key={v} className={theme === v ? 'on' : ''} onClick={() => { setTheme(v); setOpen(false); }}>{ic}{l}</button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <button className={`fab ${pitch > 10 ? 'on' : ''}`} onClick={() => map.easeTo({ pitch: pitch > 10 ? 0 : 55, duration: 800 })} aria-label="3D"><Box size={19} /></button>
      <button className="fab" onClick={() => map.easeTo({ bearing: Math.abs(bearingDeg) < 1 ? -GRID_ANGLE : 0, duration: 700 })} aria-label="Boussole">
        <Compass size={19} style={{ transform: `rotate(${-bearingDeg - 45}deg)`, transition: 'transform .2s' }} />
      </button>
      <button className="fab primary" onClick={() => map.flyTo({ center: ME, zoom: 16.6, duration: 1200, offset: [0, -100] })} aria-label="Ma position"><LocateFixed size={19} /></button>
    </div>
  );
}

function Menu({ profile }: { profile: Profile }) {
  const pop = useUI((s) => s.popOverlay);
  const setProfile = useApp((s) => s.setProfile);
  const theme = useApp((s) => s.theme);
  const setTheme = useApp((s) => s.setTheme);
  const reset = useApp((s) => s.resetAll);
  const me = PROFILES.find((p) => p.id === profile)!;
  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={pop}>
      <motion.div className="menu" initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', stiffness: 380, damping: 40 }} onClick={(e) => e.stopPropagation()}>
        <div className="menu-head" style={{ background: `linear-gradient(135deg, ${me.g[0]}, ${me.g[1]})` }}>
          <button className="icon-btn glass-btn menu-close" onClick={pop}><X size={18} /></button>
          <span className="menu-avatar">{me.icon}</span>
          <b>Profil {me.title}</b>
          <small>{me.text}</small>
        </div>
        <div className="menu-body">
          <h4 className="mini-title">Apparence de la carte</h4>
          <div className="theme-row">
            {([['auto', 'Auto'], ['jour', 'Jour'], ['nuit', 'Nuit']] as const).map(([v, l]) => <button key={v} className={theme === v ? 'on' : ''} onClick={() => setTheme(v)}>{l}</button>)}
          </div>
          <h4 className="mini-title">Compte</h4>
          <button className="menu-item" onClick={() => { pop(); setProfile(null); }}><span className="mi-icon"><LogOut size={20} /></span><span>Changer de profil</span></button>
          <button className="menu-item" onClick={() => { if (confirm('Effacer toutes les données locales (favoris, signalements, messages) ?')) { reset(); pop(); } }}><span className="mi-icon"><RefreshCw size={20} /></span><span>Réinitialiser la démo</span></button>
        </div>
      </motion.div>
    </motion.div>
  );
}
