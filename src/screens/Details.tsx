import { ReactNode } from 'react';
import { CalendarPlus, Bus, Accessibility, CalendarDays, Car, Clock, Heart, MapPin, Navigation, Phone, ShieldCheck, SquareParking, Star, ThumbsUp, Users, X, Zap, Ruler, Timer, CalendarCheck, Info, Footprints } from 'lucide-react';
import { CATEGORY_META } from '../data/places';
import { useBusinessData } from '../lib/businessData';
import { useInstallations } from '../lib/installationsData';
import { PARKING_COLOR } from '../data/parkings';
import { getParkings, useParkings } from '../lib/parkingData';
import { AddToCalendar } from './AddToCalendar';
import { useStops } from '../lib/stopsData';
import { EVENT_META } from '../data/events';
import { REPORT_META, STATUS_META } from '../data/community';
import { Icon } from '../components/Icon';
import { Cover, Stars } from '../components/ui';
import { useApp, useUI } from '../lib/store';
import { usePlace, useEvents, useReports, formatEventDate, formatEventWhen, eventTime, participantsLabel, timeAgo } from '../lib/selectors';
import { goRoute, parkingNear } from '../lib/actions';
import { dist, formatDist, LngLat, ME } from '../lib/geo';

export function DetailHeader({ title, subtitle, icon, color, onClose }: { title: string; subtitle?: ReactNode; icon: ReactNode; color: string; onClose: () => void }) {
  return (
    <div className="detail-head">
      <div className="detail-icon" style={{ background: color }}>{icon}</div>
      <div className="detail-titles">
        <h2>{title}</h2>
        {subtitle && <div className="detail-sub">{subtitle}</div>}
      </div>
      <button className="icon-btn ghost round" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
    </div>
  );
}

function ActionRow({ children }: { children: ReactNode }) {
  return <div className="action-row">{children}</div>;
}
export function ActionBtn({ icon, label, onClick, primary, active }: { icon: ReactNode; label: string; onClick: () => void; primary?: boolean; active?: boolean }) {
  return (
    <button className={`action-btn ${primary ? 'primary' : ''} ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="ab-icon">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

/* ---------------- Lieu / entreprise ---------------- */
export function PlaceDetail({ id }: { id: string }) {
  const p = usePlace(id);
  const select = useUI((s) => s.select);
  const favs = useApp((s) => s.favoritePlaces);
  const toggleFav = useApp((s) => s.toggleFavoritePlace);
  const myRating = useApp((s) => s.placeRatings[id]);
  const rate = useApp((s) => s.ratePlace);
  const toast = useUI((s) => s.showToast);
  if (!p) return null;
  const m = CATEGORY_META[p.category];
  const d = dist(ME, p.ll);
  return (
    <div className="detail">
      <DetailHeader title={p.name} subtitle={<><span style={{ color: m.color, fontWeight: 600 }}>{m.label}</span> · {p.registry && !p.located ? 'rue non localisée' : formatDist(d)}{p.reviews > 0 && <> · <Stars value={p.rating} size={12} /> <small>{p.rating.toFixed(1)}</small></>}</>} icon={<Icon name={m.icon} size={22} />} color={m.color} onClose={() => select(null)} />
      <ActionRow>
        <ActionBtn primary icon={<Navigation size={18} />} label="Itinéraire" onClick={() => goRoute(p.ll, p.name)} />
        <ActionBtn icon={<SquareParking size={18} />} label="Stationner" onClick={() => parkingNear(p.ll)} />
        {p.phone && <ActionBtn icon={<Phone size={18} />} label="Appeler" onClick={() => { window.location.href = `tel:${p.phone}`; }} />}
        <ActionBtn active={favs.includes(id)} icon={<Heart size={18} fill={favs.includes(id) ? 'currentColor' : 'none'} />} label="Favori" onClick={() => toggleFav(id)} />
      </ActionRow>
      <p className="detail-text">{p.description}</p>
      <div className="info-list">
        <div className="info-item"><MapPin size={16} /><span>{p.address}</span></div>
        {p.hours && <div className="info-item"><Clock size={16} /><span>{p.hours}</span>{p.openLate && <em className="tag tag-good">Ouvert tard</em>}</div>}
      </div>
      {p.tags.length > 0 && <div className="tags">{p.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div>}
      {p.registry && (
        <div className="local-notice"><Info size={16} /><span>{p.installation ? <>Source : liste des installations municipales{p.code ? ` (n° ${p.code})` : ''}. {p.located ? (p.approxPosition ? 'Position estimée à partir de l’adresse.' : '') : 'Adresse non reconnue : position inconnue.'}</> : <>Source : registre des entreprises de Saint-Roch. {p.located ? 'Le registre ne donne pas de numéro civique : la position sur la rue est approximative.' : 'Cette rue n’est pas encore reconnue par l’application : position inconnue.'}</>}</span></div>
      )}
      {!p.registry && <div className="safety-card">
        <div className="safety-top">
          <ShieldCheck size={18} />
          <div>
            <b>Sentiment de sécurité perçu</b>
            <small>{p.reviews} évaluations communautaires</small>
          </div>
          <span className="safety-score">{p.safety.toFixed(1)}</span>
        </div>
        <div className="safety-rate">
          <span>Votre évaluation</span>
          <Stars value={myRating ?? 0} size={22} onChange={(v) => { rate(id, v); toast('Merci ! Votre évaluation améliore les itinéraires.', '⭐'); }} />
        </div>
      </div>}
    </div>
  );
}

/* ---------------- Stationnement municipal ---------------- */
export function ParkingDetail({ id }: { id: string }) {
  const p = useParkings().find((x) => x.id === id);
  const select = useUI((s) => s.select);
  if (!p) return null;
  return (
    <div className="detail">
      <DetailHeader title={p.name} subtitle={<><span className="type-pill" style={{ background: PARKING_COLOR }}>Municipal</span> {p.typeLabel} · {formatDist(dist(ME, p.ll))}</>} icon={<b className="p-letter">P</b>} color={PARKING_COLOR} onClose={() => select(null)} />
      <div className="parking-facts">
        <div><b>{p.capacity || '—'}</b><small>cases</small></div>
        <div><b>{p.typeLabel}</b><small>type</small></div>
      </div>
      <ActionRow>
        <ActionBtn primary icon={<Car size={18} />} label="Y aller" onClick={() => goRoute(p.ll, p.name, 'car')} />
        <ActionBtn icon={<Footprints size={18} />} label="À pied" onClick={() => goRoute(p.ll, p.name, 'foot')} />
      </ActionRow>
      <div className="info-list">
        <div className="info-item"><MapPin size={16} /><span>{p.address}</span></div>
        {(p.quartier || p.arrondissement) && <div className="info-item"><Info size={16} /><span>{[p.quartier, p.arrondissement].filter(Boolean).join(' · ')}</span></div>}
      </div>
      <p className="disclaimer">Source : stationnements municipaux hors rue (Ville de Québec).</p>
    </div>
  );
}

/* ---------------- Événement (aperçu sur la carte) ---------------- */
export function EventPreview({ id }: { id: string }) {
  const events = useEvents();
  const e = events.find((x) => x.id === id);
  const select = useUI((s) => s.select);
  const push = useUI((s) => s.pushOverlay);
  const favs = useApp((s) => s.favorites);
  const toggleFav = useApp((s) => s.toggleFavorite);
  const going = useApp((s) => s.going);
  const toggleGoing = useApp((s) => s.toggleGoing);
  if (!e) return null;
  const m = EVENT_META[e.category];
  const isGoing = going.includes(e.id);
  return (
    <div className="detail">
      <Cover gradient={m.gradient} icon={m.icon} seed={e.cover} height={130}>
        <button className="cover-close" onClick={() => select(null)}><X size={18} /></button>
        <span className="cover-badge">{m.label}</span>
      </Cover>
      <h2 className="ev-title">{e.title}</h2>
      <div className="ev-meta">
        <span><CalendarDays size={15} /> {formatEventWhen(e)}</span>
        <span><MapPin size={15} /> {e.venue}</span>
        <span><Users size={15} /> {participantsLabel(e, isGoing)}</span>
      </div>
      <ActionRow>
        <ActionBtn primary active={isGoing} icon={<ThumbsUp size={18} />} label={isGoing ? 'J’y vais !' : 'Je participe'} onClick={() => toggleGoing(e.id)} />
        <ActionBtn active={favs.includes(e.id)} icon={<Heart size={18} fill={favs.includes(e.id) ? 'currentColor' : 'none'} />} label="Favori" onClick={() => toggleFav(e.id)} />
        <ActionBtn icon={<Navigation size={18} />} label="Itinéraire" onClick={() => goRoute(e.ll, e.venue)} />
        <AddToCalendar event={e} render={(open) => <ActionBtn icon={<CalendarPlus size={18} />} label="Calendrier" onClick={open} />} />
        <ActionBtn icon={<SquareParking size={18} />} label="Parking" onClick={() => parkingNear(e.ll)} />
      </ActionRow>
      <p className="detail-text clamp">{e.description}</p>
      <button className="btn btn-soft full" onClick={() => push({ kind: 'event', id: e.id })}>Voir la fiche complète</button>
    </div>
  );
}

/* ---------------- Signalement ---------------- */
export function ReportDetail({ id }: { id: string }) {
  const reports = useReports();
  const r = reports.find((x) => x.id === id);
  const select = useUI((s) => s.select);
  const voted = useApp((s) => s.reportVotes.includes(id));
  const vote = useApp((s) => s.voteReport);
  const profile = useApp((s) => s.profile);
  const setStatus = useApp((s) => s.setReportStatus);
  if (!r) return null;
  const m = REPORT_META[r.category];
  const st = STATUS_META[r.status];
  return (
    <div className="detail">
      <DetailHeader title={m.label} subtitle={<><span className="status-pill" style={{ ['--c' as string]: st.color }}>{st.label}</span> · {timeAgo(r.createdAt)} · {r.author}</>} icon={<Icon name={m.icon} size={22} />} color={m.color} onClose={() => select(null)} />
      {r.photo && <img className="report-photo" src={r.photo} alt="Photo du signalement" />}
      <p className="detail-text">{r.description}</p>
      <div className="local-notice"><Info size={16} /><span>Signalement enregistré dans l’application seulement — <b>il n’a pas été transmis officiellement à la Ville</b>. Pour une demande officielle, composez le 311.</span></div>
      <ActionRow>
        <ActionBtn active={voted} icon={<ThumbsUp size={18} />} label={`Moi aussi (${r.votes})`} onClick={() => vote(id)} />
        <ActionBtn icon={<Navigation size={18} />} label="Y aller" onClick={() => goRoute(r.ll, m.label)} />
      </ActionRow>
      {profile === 'ville' && (
        <div className="admin-status">
          <h4 className="mini-title">Statut (espace administration)</h4>
          <div className="status-choices">
            {(Object.keys(STATUS_META) as (keyof typeof STATUS_META)[]).map((s) => (
              <button key={s} className={`status-choice ${r.status === s ? 'on' : ''}`} style={{ ['--c' as string]: STATUS_META[s].color }} onClick={() => setStatus(id, s)}>{STATUS_META[s].label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* Stationnements les plus proches d'un point */
export function nearestParkings(ll: LngLat, n = 3) {
  return getParkings().map((p) => ({ p, d: dist(ll, p.ll) })).sort((a, b) => a.d - b.d).slice(0, n);
}

export function nearbyPlaces(ll: LngLat, n = 4) {
  const real = [...useInstallations.getState().places, ...useBusinessData.getState().places].filter((p) => p.located);
  return real.map((p) => ({ p, d: dist(ll, p.ll) })).sort((a, b) => a.d - b.d).slice(0, n);
}

/* ---------------- Arrêt d'autobus ---------------- */
export function StopDetail({ id }: { id: string }) {
  const st = useStops((x) => x.stops.find((s) => s.id === id));
  const source = useStops((x) => x.source);
  const select = useUI((s) => s.select);
  if (!st) return null;
  const nearby = nearbyPlaces(st.ll, 3);
  return (
    <div className="detail">
      <DetailHeader title={st.name} subtitle={<><span style={{ color: '#1D4ED8', fontWeight: 600 }}>Arrêt d’autobus RTC</span>{st.code ? ` · n° ${st.code}` : ''} · {formatDist(dist(ME, st.ll))}</>} icon={<Bus size={22} />} color="#1D4ED8" onClose={() => select(null)} />
      <ActionRow>
        <ActionBtn primary icon={<Navigation size={18} />} label="Y aller à pied" onClick={() => goRoute(st.ll, `Arrêt ${st.name}`)} />
        <ActionBtn icon={<Clock size={18} />} label="Horaires" onClick={() => window.open(st.url || 'https://www.rtcquebec.ca', '_blank', 'noopener')} />
      </ActionRow>
      <div className="info-list">
        {st.code && <div className="info-item"><Info size={16} /><span>Numéro d’arrêt <b>{st.code}</b> (à utiliser pour les horaires en temps réel du RTC)</span></div>}
        {st.wheelchair !== undefined && <div className="info-item"><Accessibility size={16} /><span>{st.wheelchair ? 'Embarquement accessible en fauteuil roulant' : 'Embarquement non accessible en fauteuil roulant'}</span></div>}
        {st.desc && <div className="info-item"><MapPin size={16} /><span>{st.desc}</span></div>}
      </div>
      {nearby.length > 0 && <h4 className="mini-title">À proximité</h4>}
      {nearby.map(({ p, d }) => (
        <button key={p.id} className="sr-item" onClick={() => { select({ type: 'place', id: p.id }); useUI.getState().flyTo(p.ll, 17); }}>
          <span className="sr-icon" style={{ background: CATEGORY_META[p.category].color }}><Icon name={CATEGORY_META[p.category].icon} size={16} /></span>
          <span className="sr-text"><b>{p.name}</b><small>{formatDist(d)} à pied</small></span>
        </button>
      ))}
      <p className="disclaimer">{source === 'demo' ? 'Aucun fichier d’arrêts.' : source === 'fichier' ? 'Source : fichier stops.txt (GTFS du RTC) du projet.' : 'Source : fichier importé.'} Horaires et passages en temps réel : site ou application du RTC.</p>
    </div>
  );
}

export function SelectionDetail() {
  const sel = useUI((s) => s.selection);
  if (!sel) return null;
  if (sel.type === 'stop') return <StopDetail id={sel.id} />;
  if (sel.type === 'place') return <PlaceDetail id={sel.id} />;
  if (sel.type === 'parking') return <ParkingDetail id={sel.id} />;
  if (sel.type === 'event') return <EventPreview id={sel.id} />;
  if (sel.type === 'report') return <ReportDetail id={sel.id} />;
  return null;
}

export { Star };
