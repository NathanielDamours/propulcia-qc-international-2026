import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Info, CloudRain, Globe, CalendarDays, Heart, MapPin, Map as MapIcon, Navigation, Plus, Search, SquareParking, ThumbsUp, Users, X, Ticket, Building2, Share2 } from 'lucide-react';
import { MY_COMPANY } from '../data/community';
import { EVENT_META, EventCategory, AppEvent } from '../data/events';
import { SITES } from '../lib/eventsParse';
import { usePlaces } from '../lib/selectors';
import { useApp, useUI } from '../lib/store';
import { useEvents, formatEventDate, formatEventWhen, eventTime, participantsLabel, dayParts } from '../lib/selectors';
import { Chip, Cover, Empty, Field, FullPage, Modal, Segmented } from '../components/ui';
import { goRoute, parkingNear, showOnMap } from '../lib/actions';
import { nearestParkings } from './Details';
import { AddToCalendar } from './AddToCalendar';
import { formatDist, uv } from '../lib/geo';
import { PARKING_COLOR } from '../data/parkings';

type When = 'tous' | 'aujourdhui' | 'semaine' | 'favoris' | 'reserves';

export function EventsPage() {
  const events = useEvents();
  const favs = useApp((s) => s.favorites);
  const going = useApp((s) => s.going);
  const profile = useApp((s) => s.profile);
  const push = useUI((s) => s.pushOverlay);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<EventCategory | null>(null);
  const [when, setWhen] = useState<When>('tous');

  const filtered = useMemo(() => {
    const n = q.toLowerCase();
    const now = new Date();
    const endToday = new Date(); endToday.setHours(23, 59, 59);
    const endWeek = new Date(); endWeek.setDate(endWeek.getDate() + 7);
    return events.filter((e) => {
      if (n && !(e.title + e.venue + e.description + e.organizer).toLowerCase().includes(n)) return false;
      if (cat && e.category !== cat) return false;
      const d = new Date(e.start);
      if (when === 'aujourdhui' && d > endToday) return false;
      if (when === 'semaine' && d > endWeek) return false;
      if (when === 'favoris' && !favs.includes(e.id)) return false;
      if (when === 'reserves' && !going.includes(e.id)) return false;
      return new Date(e.end) >= now || when === 'favoris';
    });
  }, [events, q, cat, when, favs, going]);

  // Seuls les événements encore à venir et toujours présents comptent (pas d'anciens identifiants restés en mémoire)
  const reservedCount = useMemo(() => events.filter((e) => going.includes(e.id) && new Date(e.end) >= new Date()).length, [events, going]);
  const featured = filtered.slice(0, 4);
  const canPublish = profile === 'entreprise' || profile === 'ville';

  return (
    <div className={`page ${canPublish ? 'with-fab' : ''}`}>
      <div className="page-header">
        <div>
          <small className="eyebrow">Saint-Roch vivant</small>
          <h1>Événements</h1>
        </div>
        {/* Entreprise et Ville publient des événements mais n'y participent pas : pas de billets */}
        {profile === 'citoyen' && (
          <button className={`going-count ${when === 'reserves' ? 'on' : ''}`} aria-label="Mes événements réservés" onClick={() => setWhen(when === 'reserves' ? 'tous' : 'reserves')}><Ticket size={15} /> {reservedCount}</button>
        )}
      </div>
      <div className="page-sticky">
        <div className="search-input soft">
          <Search size={17} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Concert, marché, atelier…" />
          {q && <button onClick={() => setQ('')}><X size={15} /></button>}
        </div>
        {when === 'reserves' && (
          <div className="reserved-banner">
            <Ticket size={16} /><span><b>Mes événements réservés</b><small>{reservedCount} événement{reservedCount > 1 ? 's' : ''} à venir avec « Je participe »</small></span>
            <button className="icon-btn ghost" aria-label="Fermer" onClick={() => setWhen('tous')}><X size={18} /></button>
          </div>
        )}
        {when !== 'reserves' && <Segmented value={when} onChange={setWhen} options={[{ value: 'tous', label: 'Tous' }, { value: 'aujourdhui', label: 'Aujourd’hui' }, { value: 'semaine', label: '7 jours' }, { value: 'favoris', label: 'Favoris', badge: favs.length || undefined }]}  />}
        <div className="chips-scroll">
          <Chip active={!cat} onClick={() => setCat(null)}>Toutes</Chip>
          {(Object.keys(EVENT_META) as EventCategory[]).map((c) => (
            <Chip key={c} active={cat === c} color={EVENT_META[c].color} onClick={() => setCat(cat === c ? null : c)}>{EVENT_META[c].label}</Chip>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Empty icon={<CalendarDays size={28} />} title={when === 'reserves' ? 'Aucune réservation' : 'Aucun événement'} text={when === 'reserves' ? 'Touchez « Je participe » sur un événement pour le retrouver ici.' : when === 'favoris' ? 'Ajoutez des événements à vos favoris avec le cœur.' : 'Essayez un autre filtre ou une autre recherche.'} />
      ) : (
        <>
          {!q && !cat && when === 'tous' && (
            <div className="carousel">
              {featured.map((e, i) => <FeaturedCard key={e.id} e={e} i={i} />)}
            </div>
          )}
          <div className="event-list">
            {filtered.map((e, i) => <EventRow key={e.id} e={e} i={i} />)}
          </div>
        </>
      )}
      {canPublish && (
        <div className="publish-fab-anchor">
          <motion.button className="btn btn-primary publish-fab" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} whileTap={{ scale: 0.94 }} onClick={() => push({ kind: 'publish-event' })}><Plus size={18} /> Publier</motion.button>
        </div>
      )}
    </div>
  );
}

function FeaturedCard({ e, i }: { e: AppEvent; i: number }) {
  const push = useUI((s) => s.pushOverlay);
  const favs = useApp((s) => s.favorites);
  const toggleFav = useApp((s) => s.toggleFavorite);
  const m = EVENT_META[e.category];
  return (
    <motion.div className="featured" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }} onClick={() => push({ kind: 'event', id: e.id })}>
      <Cover gradient={m.gradient} icon={m.icon} seed={e.cover} height={190} rounded={24}>
        <button className={`fav-btn ${favs.includes(e.id) ? 'on' : ''}`} onClick={(ev) => { ev.stopPropagation(); toggleFav(e.id); }}><Heart size={18} fill={favs.includes(e.id) ? 'currentColor' : 'none'} /></button>
        <div className="featured-info">
          <span className="cover-badge">{m.label}</span>
          <h3>{e.title}</h3>
          <small>{formatEventWhen(e)} · {e.venue}</small>
        </div>
      </Cover>
    </motion.div>
  );
}

function EventRow({ e, i }: { e: AppEvent; i: number }) {
  const push = useUI((s) => s.pushOverlay);
  const favs = useApp((s) => s.favorites);
  const going = useApp((s) => s.going);
  const toggleFav = useApp((s) => s.toggleFavorite);
  const m = EVENT_META[e.category];
  const { day, month } = dayParts(e.start);
  return (
    <motion.div className="event-row" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.04 }} onClick={() => push({ kind: 'event', id: e.id })}>
      <div className="er-thumb" style={{ background: `linear-gradient(135deg, ${m.gradient[0]}, ${m.gradient[1]})` }}>
        <b>{day}</b><span>{month}</span>
      </div>
      <div className="er-main">
        <small style={{ color: m.color }}>{m.label}{e.userCreated ? ' · Publié par vous' : ''}</small>
        <b>{e.title}</b>
        <span><MapPin size={12} /> {e.venue} · {eventTime(e)}</span>
        <span className="er-tags">
          <em>{e.price}</em>
          {going.includes(e.id) && <em className="going">J’y vais</em>}
        </span>
      </div>
      <button className={`fav-mini ${favs.includes(e.id) ? 'on' : ''}`} onClick={(ev) => { ev.stopPropagation(); toggleFav(e.id); }}>
        <Heart size={18} fill={favs.includes(e.id) ? 'currentColor' : 'none'} />
      </button>
    </motion.div>
  );
}

export function EventDetailPage({ id }: { id: string }) {
  const events = useEvents();
  const e = events.find((x) => x.id === id);
  const pop = useUI((s) => s.popOverlay);
  const favs = useApp((s) => s.favorites);
  const toggleFav = useApp((s) => s.toggleFavorite);
  const going = useApp((s) => s.going);
  const toggleGoing = useApp((s) => s.toggleGoing);
  const toast = useUI((s) => s.showToast);
  if (!e) return null;
  const m = EVENT_META[e.category];
  const isGoing = going.includes(e.id);
  const isFav = favs.includes(e.id);
  const parks = nearestParkings(e.ll, 3);
  return (
    <FullPage onBack={pop} transparentHeader className="event-detail" right={<button className="icon-btn glass-btn" onClick={() => { navigator.clipboard?.writeText(`${e.title} — ${formatEventWhen(e)} — ${e.venue}`).catch(() => {}); toast('Lien de l’événement copié', '🔗'); }}><Share2 size={18} /></button>}>
      <Cover gradient={m.gradient} icon={m.icon} seed={e.cover} height={280} rounded={0}>
        <div className="ed-cover-info">
          <span className="cover-badge">{m.label}</span>
          <h1>{e.title}</h1>
        </div>
      </Cover>
      <div className="ed-body">
        <div className="ed-cards">
          <div className="ed-card"><CalendarDays size={18} /><div><b>{new Date(e.start).toDateString() === new Date(e.end).toDateString() ? formatEventDate(e.start, false) : formatEventWhen(e)}</b><small>{eventTime(e) === formatEventWhen(e) ? 'Plusieurs jours' : eventTime(e)}</small></div></div>
          <div className="ed-card"><MapPin size={18} /><div><b>{e.venue}</b><small>{e.approximate ? 'Lieu approximatif' : 'Saint-Roch, Québec'}</small></div></div>
          <div className="ed-card"><Users size={18} /><div><b>{participantsLabel(e, isGoing)}</b><small>{e.price}</small></div></div>
          <div className="ed-card"><Building2 size={18} /><div><b>{e.organizer}</b><small>Organisateur</small></div></div>
        </div>
        <div className="ed-actions">
          <motion.button whileTap={{ scale: 0.96 }} className={`btn big ${isGoing ? 'btn-success' : 'btn-primary'}`} onClick={() => { toggleGoing(e.id); if (!isGoing) toast('Super ! Vous participez à cet événement', '🎉'); }}>
            <ThumbsUp size={18} /> {isGoing ? 'Je participe ✓' : 'Je participe'}
          </motion.button>
          <motion.button whileTap={{ scale: 0.9 }} className={`icon-btn big ${isFav ? 'fav-on' : 'soft'}`} onClick={() => toggleFav(e.id)}><Heart size={20} fill={isFav ? 'currentColor' : 'none'} /></motion.button>
        </div>
        <AddToCalendar event={e} />
        <h4 className="mini-title">À propos</h4>
        <p className="detail-text">{e.description}</p>
        <div className="tags">{e.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div>
        {(e.details || e.weather || e.website || (e.sites && e.sites !== e.venue)) && (
          <div className="info-list">
            {e.sites && e.sites.replace(/\s*\/\s*$/, '').trim() !== e.venue && <div className="info-item"><MapPin size={16} /><span>{e.sites.replace(/\s*\/\s*$/, '').trim()}</span></div>}
            {e.details && <div className="info-item"><Info size={16} /><span>{e.details}</span></div>}
            {e.weather && <div className="info-item"><CloudRain size={16} /><span>En cas d’intempéries : {e.weather}</span></div>}
            {e.website && <div className="info-item"><Globe size={16} /><a href={/^https?:/.test(e.website) ? e.website : `https://${e.website}`} target="_blank" rel="noreferrer">Site du promoteur</a></div>}
          </div>
        )}

        <h4 className="mini-title">Se rendre sur place</h4>
        <div className="go-grid">
          <button onClick={() => showOnMap('event', e.id, e.ll)}><MapIcon size={20} /><span>Voir sur la carte</span></button>
          <button onClick={() => goRoute(e.ll, e.venue)}><Navigation size={20} /><span>Itinéraire sécuritaire</span></button>
          <button onClick={() => parkingNear(e.ll)}><SquareParking size={20} /><span>Stationner</span></button>
        </div>
        <h4 className="mini-title">Stationnements à proximité</h4>
        <div className="mini-parkings">
          {parks.map(({ p, d }) => (
            <button key={p.id} className="mini-parking" onClick={() => { const ui = useUI.getState(); ui.clearOverlays(); ui.setTab('parking'); setTimeout(() => { ui.select({ type: 'parking', id: p.id }); ui.flyTo(p.ll, 16.8); }, 50); }}>
              <span className="pi-badge" style={{ background: PARKING_COLOR }}>P</span>
              <span className="pi-main"><b>{p.name}</b><small>{formatDist(d)} à pied · {p.typeLabel}</small></span>
              <span className="pi-right"><b>{p.capacity || '—'}</b><small>cases</small></span>
            </button>
          ))}
        </div>
      </div>
    </FullPage>
  );
}

export function PublishEventModal() {
  const pop = useUI((s) => s.popOverlay);
  const add = useApp((s) => s.addEvent);
  const profile = useApp((s) => s.profile);
  const toast = useUI((s) => s.showToast);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<EventCategory>('communaute');
  const realPlaces = usePlaces();
  // Lieux proposés : sites d'événements connus + entreprises et installations réelles localisées
  const venues = useMemo(() => [
    ...SITES.map((st, i) => ({ id: `site-${i}`, name: st.name, ll: st.ll })),
    ...realPlaces.filter((p) => p.located).map((p) => ({ id: p.id, name: p.name, ll: p.ll })).sort((a, b) => a.name.localeCompare(b.name, 'fr')),
  ], [realPlaces]);
  const [placeId, setPlaceId] = useState('site-0');
  const [date, setDate] = useState(() => new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10));
  const [time, setTime] = useState('18:00');
  const [price, setPrice] = useState('Gratuit');
  const [desc, setDesc] = useState('');
  const valid = title.trim().length > 3 && desc.trim().length > 5;
  const submit = () => {
    const place = venues.find((p) => p.id === placeId) ?? venues[0];
    const start = new Date(`${date}T${time}`);
    const ev: AppEvent = {
      id: `ue-${Date.now()}`, title: title.trim(), category, venue: place.name, ll: place.ll ?? uv(0, 0),
      start: start.toISOString(), end: new Date(start.getTime() + 3 * 3600e3).toISOString(), description: desc.trim(),
      organizer: profile === 'ville' ? 'Ville de Québec' : MY_COMPANY, price, attendees: 0, tags: ['Nouveau'], cover: Math.floor(Math.random() * 12), userCreated: true,
    };
    add(ev);
    pop();
    toast('Événement publié sur la carte et dans l’agenda', '📣');
  };
  return (
    <Modal title="Publier un événement" onClose={pop} footer={<button className="btn btn-primary full big" disabled={!valid} onClick={submit}>Publier l’événement</button>}>
      <Field label="Titre"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. : Vente trottoir d’automne" /></Field>
      <Field label="Catégorie">
        <div className="chips-wrap">
          {(Object.keys(EVENT_META) as EventCategory[]).map((c) => <Chip key={c} active={category === c} color={EVENT_META[c].color} onClick={() => setCategory(c)}>{EVENT_META[c].label}</Chip>)}
        </div>
      </Field>
      <Field label="Lieu"><select value={placeId} onChange={(e) => setPlaceId(e.target.value)}>{venues.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
      <div className="field-row">
        <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Heure"><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
      </div>
      <Field label="Prix"><input value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
      <Field label="Description"><textarea rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Décrivez votre événement…" /></Field>
    </Modal>
  );
}
