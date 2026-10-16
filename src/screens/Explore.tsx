import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bus, CalendarDays, ChevronLeft, Lightbulb, MapPin, Moon, Search, X, Sun } from 'lucide-react';
import { BottomSheet } from '../components/BottomSheet';
import { isNight, Profile, useApp, useUI } from '../lib/store';
import { usePlaces, useEvents, formatEventDate, formatEventWhen, eventTime, participantsLabel } from '../lib/selectors';
import { MY_COMPANY } from '../data/community';
import { EVENT_META } from '../data/events';
import { CATEGORY_META } from '../data/places';
import { useParkings } from '../lib/parkingData';
import { useStops } from '../lib/stopsData';
import { STREETS } from '../data/streets';
import { SelectionDetail } from './Details';
import { Cover } from '../components/ui';
import { Icon } from '../components/Icon';
import { uv } from '../lib/geo';

const hello = () => (new Date().getHours() >= 17 || new Date().getHours() < 5 ? 'Bonsoir' : 'Bonjour');
const GREETING: Record<Profile, { title: string; text: string }> = {
  citoyen: { title: `${hello()}, toi 👋`, text: 'Votre quartier en un coup d’œil' },
  entreprise: { title: `${hello()}, Studio Lumen 💼`, text: 'Les occasions d’affaires du quartier' },
  ville: { title: 'Tableau de quartier 🏛️', text: 'État du milieu en temps réel' },
};


export function ExploreSheet() {
  const selection = useUI((s) => s.selection);
  const profile = useApp((s) => s.profile) ?? 'citoyen';
  const setTab = useUI((s) => s.setTab);
  const push = useUI((s) => s.pushOverlay);
  const toggleLayer = useUI((s) => s.toggleLayer);
  const lighting = useUI((s) => s.layers.lighting);
  const theme = useApp((s) => s.theme);
  const night = isNight(theme);
  const events = useEvents();
  const upcoming = events.filter((e) => new Date(e.end) > new Date()).slice(0, 6);
  const g = GREETING[profile];

  if (selection) {
    return (
      <BottomSheet sheetKey={`sel-${selection.type}-${selection.id}`} snap="half" half={0.5}>
        <div className="pad"><SelectionDetail /></div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet sheetKey="explore" snap="peek" peek={208} half={0.55}>
      <div className="pad">
        <div className="greet">
          <div>
            <h2>{g.title}</h2>
            <p>{g.text}</p>
          </div>
          <span className={`live-badge ${night ? 'night' : ''}`}>{night ? <Moon size={13} /> : <Sun size={13} />}{night ? 'Soir' : 'Jour'}</span>
        </div>

        <button className={`lighting-card ${lighting ? 'on' : ''}`} onClick={() => toggleLayer('lighting')}>
          <span className="lc-icon"><Lightbulb size={20} /></span>
          <span><b>Carte de l’éclairage</b><small>{lighting ? 'Affichée — touchez pour masquer' : 'Voir les rues les mieux éclairées'}</small></span>
          <span className={`switch ${lighting ? 'on' : ''}`}><span /></span>
        </button>

        <div className="section-title"><h3>À venir à Saint-Roch</h3><button className="link" onClick={() => setTab('evenements')}>Tout voir</button></div>
        <div className="h-scroll">
          {upcoming.map((e) => {
            const m = EVENT_META[e.category];
            return (
              <button key={e.id} className="mini-event" onClick={() => push({ kind: 'event', id: e.id })}>
                <Cover gradient={m.gradient} icon={m.icon} seed={e.cover} height={92} rounded={16} />
                <b>{e.title}</b>
                <small>{formatEventWhen(e)}</small>
              </button>
            );
          })}
        </div>

      </div>
    </BottomSheet>
  );
}

/* ---------- Barre de recherche principale ---------- */
export function SearchBar({ onAvatar, avatar }: { onAvatar: () => void; avatar: JSX.Element }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const events = useEvents();
  const places = usePlaces();
  const parkings = useParkings();
  const stops = useStops((s) => s.stops);
  const select = useUI((s) => s.select);
  const flyTo = useUI((s) => s.flyTo);
  const setTab = useUI((s) => s.setTab);
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const results = useMemo(() => {
    const n = norm(q);
    if (!n) return [];
    const r: { key: string; title: string; sub: string; color: string; icon: JSX.Element; go: () => void }[] = [];
    for (const p of places) if ((!p.registry || p.located) && norm(p.name + p.address + p.tags.join()).includes(n)) r.push({ key: p.id, title: p.name, sub: `${CATEGORY_META[p.category].label} · ${p.address}`, color: CATEGORY_META[p.category].color, icon: <Icon name={CATEGORY_META[p.category].icon} size={16} />, go: () => { setTab('carte'); select({ type: 'place', id: p.id }); flyTo(p.ll, 17); } });
    for (const p of parkings) if (norm(p.name + p.address).includes(n) || 'stationnement parking'.includes(n)) r.push({ key: p.id, title: p.name, sub: `Stationnement municipal · ${p.capacity} cases`, color: '#2563EB', icon: <b>P</b>, go: () => { setTab('parking'); setTimeout(() => { select({ type: 'parking', id: p.id }); flyTo(p.ll, 17); }, 30); } });
    for (const e of events) if (norm(e.title + e.venue).includes(n)) r.push({ key: e.id, title: e.title, sub: `${formatEventWhen(e)} · ${e.venue}`, color: EVENT_META[e.category].color, icon: <CalendarDays size={16} />, go: () => { setTab('carte'); select({ type: 'event', id: e.id }); flyTo(e.ll, 17); } });
    for (const st of stops) if (norm(`${st.name} ${st.code ?? ''} arret bus autobus`).includes(n)) r.push({ key: `stop-${st.id}`, title: st.name, sub: `Arrêt d’autobus${st.code ? ` · n° ${st.code}` : ''}`, color: '#1D4ED8', icon: <Bus size={16} />, go: () => { setTab('carte'); setTimeout(() => { select({ type: 'stop', id: st.id }); flyTo(st.ll, 17); }, 30); } });
    for (const s of STREETS) if (norm(s.name).includes(n)) r.push({ key: s.id, title: s.name, sub: 'Rue', color: '#64748B', icon: <MapPin size={16} />, go: () => { setTab('carte'); flyTo(s.axis === 'ew' ? uv((s.from + s.to) / 2, s.at) : uv(s.at, (s.from + s.to) / 2), 16.5); } });
    const rank = (t: string) => (norm(t).startsWith(n) ? 0 : norm(t).includes(n) ? 1 : 2);
    return r.map((x, i) => ({ x, i })).sort((a, b) => rank(a.x.title) - rank(b.x.title) || a.i - b.i).map((y) => y.x).slice(0, 12);
  }, [q, events, places, parkings, stops]);

  return (
    <>
      <motion.div className="searchbar glass" initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
        <Search size={19} className="sb-icon" />
        <button className="sb-input" onClick={() => setOpen(true)}>Rechercher dans Saint-Roch</button>
        <button className="sb-avatar" onClick={onAvatar} aria-label="Menu et profil">{avatar}</button>
      </motion.div>
      {createPortal(<AnimatePresence>
        {open && (
          <motion.div className="search-screen" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}>
            <div className="search-top">
              <button className="icon-btn ghost" onClick={() => { setOpen(false); setQ(''); }}><ChevronLeft size={22} /></button>
              <div className="search-input">
                <Search size={18} />
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Lieu, stationnement, événement, rue…" />
                {q && <button onClick={() => setQ('')}><X size={16} /></button>}
              </div>
            </div>
            <div className="search-results">
              {!q && (
                <>
                  <h4 className="mini-title">Recherches rapides</h4>
                  <div className="chips-wrap">
                    {['Café', 'Stationnement', 'Bibliothèque', 'Jazz', 'Parc', 'Gare'].map((t) => <button key={t} className="chip" onClick={() => setQ(t)}>{t}</button>)}
                  </div>
                  <h4 className="mini-title">Raccourcis</h4>
                  <button className="sr-item" onClick={() => { setOpen(false); setTab('parking'); }}><span className="sr-icon" style={{ background: '#2563EB' }}><b>P</b></span><span className="sr-text"><b>Trouver un stationnement</b><small>Stationnements municipaux hors rue</small></span></button>
                </>
              )}
              {results.map((r) => (
                <button key={r.key} className="sr-item" onClick={() => { r.go(); setOpen(false); setQ(''); }}>
                  <span className="sr-icon" style={{ background: r.color }}>{r.icon}</span>
                  <span className="sr-text"><b>{r.title}</b><small>{r.sub}</small></span>
                </button>
              ))}
              {q && results.length === 0 && <p className="disclaimer">Aucun résultat pour « {q} ».</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>, document.querySelector('.shell') ?? document.body)}
    </>
  );
}
