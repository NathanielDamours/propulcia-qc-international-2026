import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUpDown, Car, ChevronLeft, CircleDot, Crosshair, Footprints, MapPin, Moon, Navigation, Phone, Search, Share2, ShieldAlert,
  ShieldCheck, Sun, TriangleAlert, ArrowUp, ArrowLeft, ArrowRight, ArrowUpLeft, ArrowUpRight, Flag, Undo2, X, LocateFixed, Sparkles,
} from 'lucide-react';
import { BottomSheet } from '../components/BottomSheet';
import { isNight, useApp, useUI, RoutePoint } from '../lib/store';
import { useRoutes } from '../lib/routeStore';
import { useLighting } from '../lib/lighting';
import { QuickReport } from './Reports';
import { planRoutes, ROUTE_META, RouteResult, scoreLabel, Step } from '../lib/routing';
import { usePlaces, useEvents, useReports, timeAgo, formatEventDate, formatEventWhen, eventTime, participantsLabel } from '../lib/selectors';
import { useParkings } from '../lib/parkingData';
import { formatDist, formatDuration, ME, pointAlong, lineLength } from '../lib/geo';
import { Icon } from '../components/Icon';
import { routeTime } from '../lib/sun';
import { CATEGORY_META } from '../data/places';
import { EmergencyDialer } from './EmergencyDialer';
import { REPORT_META } from '../data/community';

const STEP_ICON: Record<Step['icon'], JSX.Element> = {
  straight: <ArrowUp size={18} />, left: <ArrowLeft size={18} />, right: <ArrowRight size={18} />, 'slight-left': <ArrowUpLeft size={18} />,
  'slight-right': <ArrowUpRight size={18} />, uturn: <Undo2 size={18} />, start: <CircleDot size={18} />, arrive: <Flag size={18} />,
};

/* ---------- En-tête : départ / destination ---------- */
export function RouteHeader() {
  const from = useUI((s) => s.from);
  const to = useUI((s) => s.to);
  const setFrom = useUI((s) => s.setFrom);
  const setTo = useUI((s) => s.setTo);
  const mode = useUI((s) => s.travelMode);
  const setMode = useUI((s) => s.setTravelMode);
  const setTab = useUI((s) => s.setTab);
  const picking = useUI((s) => s.picking);
  const setPicking = useUI((s) => s.setPicking);
  const navActive = useUI((s) => s.navActive);
  const [editing, setEditing] = useState<'from' | 'to' | null>(null);

  useEffect(() => { if (!from) setFrom({ ll: ME, label: 'Ma position' }); }, []);

  if (navActive) return null;
  return (
    <>
      <motion.div className="route-header glass" initial={{ y: -80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -80, opacity: 0 }}>
        <div className="rh-row">
          <button className="icon-btn ghost" onClick={() => setTab('carte')} aria-label="Retour"><ChevronLeft size={22} /></button>
          <div className="rh-fields">
            <button className={`rh-field ${picking === 'from' ? 'picking' : ''}`} onClick={() => setEditing('from')}>
              <span className="rh-dot from" />
              <span className={from ? '' : 'ph'}>{from?.label ?? 'Point de départ'}</span>
            </button>
            <div className="rh-sep" />
            <button className={`rh-field ${picking === 'to' ? 'picking' : ''}`} onClick={() => setEditing('to')}>
              <span className="rh-dot to"><MapPin size={12} strokeWidth={3} /></span>
              <span className={to ? '' : 'ph'}>{to?.label ?? 'Où allez-vous ?'}</span>
            </button>
          </div>
          <button className="icon-btn ghost" aria-label="Inverser" onClick={() => { const f = from; setFrom(to); setTo(f); }}><ArrowUpDown size={19} /></button>
        </div>
        <div className="rh-modes">
          <button className={mode === 'foot' ? 'on' : ''} onClick={() => setMode('foot')}><Footprints size={16} /> À pied</button>
          <button className={mode === 'car' ? 'on' : ''} onClick={() => setMode('car')}><Car size={16} /> Voiture</button>
        </div>
      </motion.div>
      <AnimatePresence>
        {picking && (
          <motion.div className="pick-hint" initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}>
            <Crosshair size={16} /> Touchez la carte pour choisir {picking === 'from' ? 'le départ' : 'la destination'}
            <button onClick={() => setPicking(null)}><X size={14} /></button>
          </motion.div>
        )}
        {editing && <PlaceSearch field={editing} onClose={() => setEditing(null)} />}
      </AnimatePresence>
    </>
  );
}

function PlaceSearch({ field, onClose }: { field: 'from' | 'to'; onClose: () => void }) {
  const [q, setQ] = useState('');
  const setFrom = useUI((s) => s.setFrom);
  const setTo = useUI((s) => s.setTo);
  const setPicking = useUI((s) => s.setPicking);
  const events = useEvents();
  const places = usePlaces();
  const parkings = useParkings();
  const choose = (p: RoutePoint) => { (field === 'from' ? setFrom : setTo)(p); onClose(); };
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const results = useMemo(() => {
    const n = norm(q);
    const items = [
      ...places.filter((p) => !p.registry || p.located).map((p) => ({ id: p.id, title: p.name, sub: p.address, icon: CATEGORY_META[p.category].icon, color: CATEGORY_META[p.category].color, point: { ll: p.ll, label: p.name } })),
      ...events.map((e) => ({ id: e.id, title: e.title, sub: `${formatEventWhen(e)} · ${e.venue}`, icon: 'music', color: '#E11D48', point: { ll: e.ll, label: e.venue } })),
      ...parkings.map((p) => ({ id: p.id, title: p.name, sub: p.address, icon: 'parking', color: '#2563EB', point: { ll: p.ll, label: p.name } })),
    ];
    return n ? items.filter((i) => norm(i.title + ' ' + i.sub).includes(n)).slice(0, 12) : items.slice(0, 8);
  }, [q, events, places, parkings]);
  return (
    <motion.div className="search-screen" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
      <div className="search-top">
        <button className="icon-btn ghost" onClick={onClose}><ChevronLeft size={22} /></button>
        <div className="search-input">
          <Search size={18} />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={field === 'from' ? 'Point de départ' : 'Rechercher une destination'} />
          {q && <button onClick={() => setQ('')}><X size={16} /></button>}
        </div>
      </div>
      <div className="search-results">
        <button className="sr-item" onClick={() => choose({ ll: ME, label: 'Ma position' })}>
          <span className="sr-icon" style={{ background: '#3B82F6' }}><LocateFixed size={16} /></span>
          <span className="sr-text"><b>Ma position</b><small>Position actuelle</small></span>
        </button>
        <button className="sr-item" onClick={() => { setPicking(field); onClose(); }}>
          <span className="sr-icon" style={{ background: '#64748B' }}><Crosshair size={16} /></span>
          <span className="sr-text"><b>Choisir sur la carte</b><small>Touchez un point de la carte</small></span>
        </button>
        {results.map((r) => (
          <button key={r.id} className="sr-item" onClick={() => choose(r.point)}>
            <span className="sr-icon" style={{ background: r.color }}>{r.icon === 'parking' ? <b>P</b> : <Icon name={r.icon} size={16} />}</span>
            <span className="sr-text"><b>{r.title}</b><small>{r.sub}</small></span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

/* ---------- Panneau des itinéraires ---------- */
export function RouteSheet() {
  const from = useUI((s) => s.from);
  const to = useUI((s) => s.to);
  const mode = useUI((s) => s.travelMode);
  const setTo = useUI((s) => s.setTo);
  const fitTo = useUI((s) => s.fitTo);
  const navActive = useUI((s) => s.navActive);
  const setNav = useUI((s) => s.setNav);
  const themePref = useApp((s) => s.theme);
  const setTheme = useApp((s) => s.setTheme);
  const night = isNight(themePref);
  const reports = useReports();
  const places = usePlaces();
  const { routes, selected, loading, set } = useRoutes();
  const events = useEvents();
  const [stepsOpen, setStepsOpen] = useState(false);
  const reqId = useRef(0);

  const lightingKey = useLighting((s) => s.version);
  const reportsKey = reports.map((r) => r.id + r.status).join() + ':' + lightingKey;
  useEffect(() => {
    // Pas de recalcul pendant la navigation : un signalement fait en route relancerait le guidage.
    if (navActive) return;
    if (!from || !to) { set({ routes: [], selected: null }); return; }
    const id = ++reqId.current;
    set({ loading: true });
    // Heure d'évaluation : maintenant (Auto) ou simulation de jour / de nuit selon le réglage
    const t = routeTime(themePref);
    planRoutes({ from: from.ll, to: to.ll, toLabel: to.label, mode, when: t.when, reports, places, events }).then((res) => {
      if (id !== reqId.current) return;
      // Le trajet le plus sûr est classé en premier et sélectionné par défaut, de jour comme de nuit
      const pref = res[0];
      set({ routes: res, selected: pref?.id ?? null, loading: false });
      fitTo(res.flatMap((r) => r.coords));
    });
  }, [from?.ll[0], from?.ll[1], to?.ll[0], to?.ll[1], mode, themePref, reportsKey, places.length, navActive]);

  const sel = routes.find((r) => r.id === selected) ?? null;

  if (navActive && sel) return <NavigationPanel route={sel} onStop={() => setNav(false)} />;

  const header = (
    <div className="sheet-header">
      <div>
        <h3>{to ? (loading ? 'Calcul des trajets…' : `${routes.length} itinéraire${routes.length > 1 ? 's' : ''}`) : 'Déplacements sécuritaires'}</h3>
        <small>{to ? `Vers ${to.label}` : 'Choisissez une destination'}</small>
      </div>
      <button className={`night-toggle ${night ? 'on' : ''}`} onClick={() => setTheme(night ? 'jour' : 'nuit')} title="Basculer jour / nuit">
        {night ? <Moon size={16} /> : <Sun size={16} />}
        {night ? 'Nuit' : 'Jour'}
      </button>
    </div>
  );

  return (
    <BottomSheet header={header} snap={to ? 'half' : 'half'} sheetKey={to ? 'r' : 'n'} half={0.5}>
      {!to && (
        <div className="pad">
          <div className="hero-tip">
            <div className="hero-tip-icon"><Sparkles size={20} /></div>
            <div>
              <b>Le plus rapide et le plus sûr</b>
              <p>Notre score de sécurité tient compte de la lumière (soleil selon la saison et lampadaires), de l’animation de la rue à cette heure, de l’aide la plus proche (police, lieux ouverts), du type de voie, des arrêts d’autobus et des alertes de sécurité signalées.</p>
            </div>
          </div>
          <h4 className="mini-title">Événements à venir</h4>
          <div className="suggest-list">
            {events.filter((e) => new Date(e.end) > new Date()).slice(0, 4).map((e) => (
              <button key={e.id} className="sr-item" onClick={() => setTo({ ll: e.ll, label: e.venue })}>
                <span className="sr-icon" style={{ background: '#E11D48' }}><Icon name="music" size={16} /></span>
                <span className="sr-text"><b>{e.title}</b><small>{formatEventWhen(e)} · {e.venue}</small></span>
              </button>
            ))}
          </div>
          <p className="disclaimer">Astuce : touchez directement la carte pour choisir une destination.</p>
        </div>
      )}

      {to && loading && routes.length === 0 && (
        <div className="pad">{[0, 1, 2].map((i) => <div key={i} className="skeleton route-skel" />)}</div>
      )}

      {to && routes.length > 0 && (
        <div className="pad">
          <div className="route-cards">
            {routes.map((r, i) => <RouteCard key={r.id} r={r} index={i} selected={r.id === selected} onClick={() => set({ selected: r.id })} fastest={routes.reduce((a, b) => (b.duration < a.duration ? b : a))} recommended={i === 0 && routes.length > 1} />)}
          </div>
          {sel && (
            <motion.div key={sel.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <button className="btn btn-primary full big" style={{ background: sel.color }} onClick={() => setNav(true)}>
                <Navigation size={18} /> Démarrer
              </button>
              {mode === 'foot' ? <RouteMetricsView r={sel} /> : null}
              <button className="steps-toggle" onClick={() => setStepsOpen(!stepsOpen)}>
                {stepsOpen ? 'Masquer' : 'Voir'} les {sel.steps.length} étapes
              </button>
              {stepsOpen && (
                <div className="steps">
                  {sel.steps.map((s, i) => (
                    <div key={i} className="step">
                      <span className="step-icon">{STEP_ICON[s.icon]}</span>
                      <span className="step-text">{s.text}</span>
                      {s.distance > 0 && <span className="step-dist">{formatDist(s.distance)}</span>}
                    </div>
                  ))}
                </div>
              )}
              {mode === 'foot' && <SafetyTools />}
            </motion.div>
          )}
        </div>
      )}
    </BottomSheet>
  );
}

function RouteCard({ r, selected, onClick, fastest, index, recommended }: { r: RouteResult; selected: boolean; onClick: () => void; fastest: RouteResult; index: number; recommended?: boolean }) {
  const s = scoreLabel(r.metrics.score);
  const extra = Math.round((r.duration - fastest.duration) / 60);
  const labels = [r.id, ...(r.merged ?? [])].map((k) => ROUTE_META[k].short);
  const foot = useUI.getState().travelMode === 'foot';
  return (
    <motion.button className={`route-card ${selected ? 'sel' : ''}`} onClick={onClick} style={{ ['--c' as string]: r.color }} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.07 }}>
      {recommended && <span className="rc-reco"><ShieldCheck size={11} /> Recommandé</span>}
      <div className="rc-top">
        <span className="rc-dot" />
        <span className="rc-label">{r.merged?.length ? labels.join(' · ') : r.label}</span>
      </div>
      {foot && (
        <div className={`rc-safety ${s.tone}`}>
          <ShieldCheck size={16} />
          <b>{r.metrics.score} %</b>
          <small>sécurité</small>
        </div>
      )}
      <div className="rc-time">{formatDuration(r.duration)}</div>
      <div className="rc-sub">{formatDist(r.distance)}{r !== fastest && extra > 0 ? ` · +${extra} min` : ''}</div>
    </motion.button>
  );
}

function SafetyProfile({ values }: { values: number[] }) {
  return (
    <div className="light-profile">
      {values.map((v, i) => (
        <span key={i} style={{ background: v > 0.75 ? '#10B981' : v > 0.6 ? '#FACC15' : v > 0.45 ? '#F97316' : '#EF4444', opacity: 0.5 + v * 0.5 }} />
      ))}
    </div>
  );
}

function RouteMetricsView({ r }: { r: RouteResult }) {
  const s = scoreLabel(r.metrics.score);
  const alerts = r.metrics.alerts;
  return (
    <div className="metrics">
      <div className="metrics-head">
        <div className={`score-ring ${s.tone}`} style={{ ['--p' as string]: r.metrics.score }}>
          <span>{r.metrics.score}</span>
        </div>
        <div>
          <b>Score de sécurité</b>
          <small className={`tone-${s.tone}`}>{s.text}</small>
        </div>
      </div>
      {alerts.length > 0 ? (
        <div className="path-alerts warn">
          <TriangleAlert size={18} />
          <div>
            <b>{alerts.length > 1 ? `${alerts.length} alertes sur votre chemin` : 'Alerte sur votre chemin'}</b>
            <ul>
              {alerts.map((a) => (
                <li key={a.id}>
                  <b><Icon name={REPORT_META[a.category].icon} size={13} /> {a.label}</b>
                  <small>Signalé {timeAgo(a.createdAt)}{a.votes > 0 ? ` · ${a.votes} appui${a.votes > 1 ? 's' : ''}` : ''}{a.description ? ` · ${a.description}` : ''}</small>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="path-alerts ok"><ShieldCheck size={18} /> Aucune alerte signalée sur votre chemin</div>
      )}
      <div className="lp-wrap">
        <div className="lp-labels"><span>Départ</span><span>Sécurité le long du trajet</span><span>Arrivée</span></div>
        <SafetyProfile values={r.profile} />
      </div>
    </div>
  );
}

function SafetyTools() {
  const toast = useUI((s) => s.showToast);
  const to = useUI((s) => s.to);
  const [sos, setSos] = useState(false);
  return (
    <div className="safety-tools">
      <button onClick={() => {
        const text = `Je me rends à ${to?.label ?? 'destination'} via Notre Saint-Roch.`;
        if (navigator.share) navigator.share({ title: 'Mon trajet', text }).catch(() => {});
        else { navigator.clipboard?.writeText(text).catch(() => {}); toast('Trajet copié pour le partager à un proche', '📋'); }
      }}><Share2 size={18} /><span>Partager mon trajet</span></button>
      <button onClick={() => toast('Un proche sera averti à votre arrivée', '👥')}><Phone size={18} /><span>Suivi par un proche</span></button>
      <button className="sos" onClick={() => setSos(true)}><ShieldAlert size={18} /><span>Urgence 911</span></button>
      <AnimatePresence>{sos && <EmergencyDialer onClose={() => setSos(false)} />}</AnimatePresence>
    </div>
  );
}

/* ---------- Navigation simulée ---------- */
function NavigationPanel({ route, onStop }: { route: RouteResult; onStop: () => void }) {
  const set = useRoutes((s) => s.set);
  const progress = useRoutes((s) => s.navProgress);
  const toast = useUI((s) => s.showToast);
  const total = useMemo(() => lineLength(route.coords), [route]);
  const navPos = useRoutes((s) => s.navPos);
  const [reporting, setReporting] = useState(false);
  const [sos, setSos] = useState(false);
  const paused = useRef(false);
  paused.current = reporting || sos;

  useEffect(() => {
    let p = 0;
    set({ navProgress: 0, navPos: route.coords[0] });
    const speed = 14; // accéléré pour la démo
    const tick = setInterval(() => {
      if (paused.current) return; // guidage en pause pendant un signalement
      p = Math.min(1, p + (1.3 * speed * 0.5) / total);
      set({ navProgress: p, navPos: pointAlong(route.coords, p) });
      if (p >= 1) { clearInterval(tick); toast('Vous êtes arrivé·e à destination 🎉', '🏁'); }
    }, 500);
    return () => { clearInterval(tick); set({ navPos: null, navProgress: 0 }); };
  }, [route]);

  // Étape courante
  let acc = 0;
  let step = route.steps[route.steps.length - 1];
  for (const s of route.steps) {
    acc += s.distance;
    if (acc >= progress * total) { step = s; break; }
  }
  const remaining = route.distance * (1 - progress);
  return (
    <>
      <motion.div className="nav-banner" style={{ background: route.color }} initial={{ y: -100 }} animate={{ y: 0 }}>
        <span className="nav-icon">{STEP_ICON[step.icon]}</span>
        <div>
          <b>{step.text}</b>
          <small>{formatDist(Math.max(0, acc - progress * total))}</small>
        </div>
      </motion.div>
      <motion.button className="nav-sos" onClick={() => setSos(true)} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2 }} aria-label="Appeler le 911">
        <Phone size={20} fill="currentColor" /> SOS
      </motion.button>
      <AnimatePresence>{sos && <EmergencyDialer onClose={() => setSos(false)} />}</AnimatePresence>
      <motion.button className="nav-report" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3 }} whileTap={{ scale: 0.92 }} onClick={() => setReporting(true)}>
        <TriangleAlert size={20} /> Signaler
      </motion.button>
      <AnimatePresence>
        {reporting && navPos && <QuickReport ll={navPos} onClose={() => setReporting(false)} />}
      </AnimatePresence>
      <motion.div className="nav-panel" initial={{ y: 200 }} animate={{ y: 0 }}>
        <div className="nav-progress"><span style={{ width: `${progress * 100}%`, background: route.color }} /></div>
        <div className="nav-row">
          <div>
            <b className="nav-eta">{formatDuration(route.duration * (1 - progress))}</b>
            <small>{formatDist(remaining)} · {route.label}</small>
          </div>
          <button className="icon-btn soft" onClick={() => toast('Position partagée avec votre proche', '📍')}><Share2 size={18} /></button>
          <button className="btn btn-danger" onClick={onStop}>Terminer</button>
        </div>
      </motion.div>
    </>
  );
}
