import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Bus, Building2, SquareParking as ParkingIcon, Store, Upload, RotateCcw, Database, Camera, Check, ChevronRight, Crosshair, ImagePlus, Info, Lightbulb, MapPin, Download, FileDown, Trash2, X, BarChart3, ListChecks, Map as MapIcon, CalendarDays, SquareParking, Users, Lamp, Shield } from 'lucide-react';
import { BottomSheet } from '../components/BottomSheet';
import { REPORT_META, ReportCategory, STATUS_META, ReportStatus, Report, SAFETY_CATS, INFRA_CATS, isActiveReport } from '../data/community';
import { useApp, useUI } from '../lib/store';
import { useEvents, useReports, timeAgo } from '../lib/selectors';
import { Icon } from '../components/Icon';
import { Chip, Field, Modal, Segmented } from '../components/ui';
import { ReportDetail } from './Details';
import { GRAPH } from '../data/streets';
import { DataOrigin, useLighting } from '../lib/lighting';
import { useEventData } from '../lib/eventsData';
import { importBusinessFile, importEventsFile, importInstallationsFile, importLightingFile, importParkingFile, resetImports } from '../lib/dataSources';
import { useInstallations } from '../lib/installationsData';
import { useStops } from '../lib/stopsData';
import { importStopsFile, importPoliceFile } from '../lib/dataSources';
import { usePolice } from '../lib/policeData';
import { useParkingData } from '../lib/parkingData';
import { useBusinessData } from '../lib/businessData';
import { CATEGORY_META } from '../data/places';
import { lightingStats } from '../lib/lightingParse';
import { useParkings } from '../lib/parkingData';
import { dist, LngLat, ME } from '../lib/geo';
import { showOnMap } from '../lib/actions';
import { download, eventsCSV, fileName as exportName, groupsCSV, lampsCSV, parkingsGeoJSON, placesCSV, reportsCSV, reportsGeoJSON, stopsCSV } from '../lib/exportData';
import { useGroups, usePlaces } from '../lib/selectors';

const CATS = Object.keys(REPORT_META) as ReportCategory[];

function compress(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 720;
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.68));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function ReportSheet() {
  const selection = useUI((s) => s.selection);
  const reportPick = useUI((s) => s.reportPick);
  const setReportPick = useUI((s) => s.setReportPick);
  const center = useUI((s) => s.mapCenter);
  const reports = useReports();
  const [step, setStep] = useState<'list' | 'form'>('list');
  const [cat, setCat] = useState<ReportCategory | null>(null);
  const [point, setPoint] = useState<LngLat | null>(null);
  const mine = reports.filter((r) => r.mine);

  if (selection?.type === 'report' && !reportPick && step === 'list') {
    return <BottomSheet sheetKey={`rep-${selection.id}`} snap="half" half={0.5}><div className="pad"><ReportDetail id={selection.id} /></div></BottomSheet>;
  }

  if (reportPick) {
    return (
      <BottomSheet sheetKey="pick" snap="peek" peek={176}>
        <div className="pad">
          <div className="pick-card">
            <span className="pick-cat" style={{ background: cat ? REPORT_META[cat].color : '#64748B' }}>{cat && <Icon name={REPORT_META[cat].icon} size={18} />}</span>
            <div>
              <b>Placez le repère</b>
              <small>Déplacez la carte pour viser l’emplacement exact</small>
            </div>
          </div>
          <div className="row-btns">
            <button className="btn btn-soft" onClick={() => setReportPick(false)}>Annuler</button>
            <button className="btn btn-primary grow" onClick={() => { setPoint(center ?? ME); setReportPick(false); setStep('form'); }}><Check size={17} /> Confirmer l’emplacement</button>
          </div>
        </div>
      </BottomSheet>
    );
  }

  if (step === 'form' && cat && point) {
    return <ReportForm cat={cat} point={point} onCancel={() => setStep('list')} onDone={() => { setStep('list'); setCat(null); }} onRepick={() => setReportPick(true)} onCat={setCat} />;
  }

  const header = (
    <div className="sheet-header">
      <div>
        <h3>Signaler un problème</h3>
        <small>Aidez à améliorer la qualité du milieu</small>
      </div>
    </div>
  );
  return (
    <BottomSheet header={header} sheetKey="rep-list" snap="half" half={0.55}>
      <div className="pad">
        <h4 className="mini-title first">Sécurité</h4>
        <SafetyGrid onPick={(c) => { setCat(c); setReportPick(true); }} />
        <h4 className="mini-title">Infrastructure</h4>
        <div className="report-grid">
          {INFRA_CATS.map((c, i) => {
            const m = REPORT_META[c];
            return (
              <motion.button key={c} className="report-cat" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }} onClick={() => { setCat(c); setReportPick(true); }}>
                <span style={{ background: `${m.color}1F`, color: m.color }}><Icon name={m.icon} size={22} /></span>
                <b>{m.label}</b>
              </motion.button>
            );
          })}
        </div>
        <p className="disclaimer">En cas de danger immédiat, composez le <b>911</b>.</p>
        <div className="local-notice"><Info size={16} /><span>Les signalements sont conservés <b>localement dans l’application</b> et visibles sur la carte et dans l’espace administration. Ils ne sont <b>pas transmis officiellement</b> à la Ville de Québec (service 311).</span></div>
        <h4 className="mini-title">Mes signalements ({mine.length})</h4>
        {mine.length === 0 && <p className="disclaimer">Vous n’avez encore rien signalé.</p>}
        {mine.map((r) => <ReportRow key={r.id} r={r} />)}
        <h4 className="mini-title">Récents dans le quartier</h4>
        {reports.filter((r) => !r.mine).slice(0, 5).map((r) => <ReportRow key={r.id} r={r} />)}
      </div>
    </BottomSheet>
  );
}

export function ReportRow({ r, admin }: { r: Report; admin?: boolean }) {
  const m = REPORT_META[r.category];
  const st = STATUS_META[r.status];
  const del = useApp((s) => s.deleteReport);
  return (
    <div className="report-row" onClick={() => admin ? showOnMap('report', r.id, r.ll) : (useUI.getState().select({ type: 'report', id: r.id }), useUI.getState().flyTo(r.ll, 17))}>
      {r.photo ? <img src={r.photo} alt="" className="rr-photo" /> : <span className="rr-icon" style={{ background: m.color }}><Icon name={m.icon} size={17} /></span>}
      <span className="rr-main">
        <b>{m.label}</b>
        <small className="ellipsis">{r.description}</small>
        <small className="muted">{timeAgo(r.createdAt)} · {r.votes} appui{r.votes > 1 ? 's' : ''}</small>
      </span>
      <span className="status-pill" style={{ ['--c' as string]: st.color }}>{st.label}</span>
      {r.mine && !admin && <button className="icon-btn ghost small" onClick={(e) => { e.stopPropagation(); del(r.id); }} aria-label="Supprimer"><Trash2 size={15} /></button>}
    </div>
  );
}

function ReportForm({ cat, point, onCancel, onDone, onRepick, onCat }: { cat: ReportCategory; point: LngLat; onCancel: () => void; onDone: () => void; onRepick: () => void; onCat: (c: ReportCategory) => void }) {
  const add = useApp((s) => s.addReport);
  const profile = useApp((s) => s.profile);
  const toast = useUI((s) => s.showToast);
  const [desc, setDesc] = useState('');
  const [photo, setPhoto] = useState<string | undefined>();
  const fileRef = useRef<HTMLInputElement>(null);
  const near = useMemo(() => {
    let best = '';
    let bd = Infinity;
    for (const e of GRAPH.edges) {
      const d = Math.min(dist(point, e.coords[0]), dist(point, e.coords[1]));
      if (d < bd) { bd = d; best = e.street; }
    }
    return best;
  }, [point]);
  const submit = () => {
    const r: Report = {
      id: `ur-${Date.now()}`, category: cat, ll: point, description: desc.trim() || REPORT_META[cat].label, photo,
      createdAt: new Date().toISOString(), status: 'nouveau', author: profile === 'entreprise' ? 'Commerçant·e' : 'Moi', mine: true, votes: 0,
    };
    try {
      add(r);
      toast('Signalement enregistré localement', '📍');
    } catch {
      toast('Mémoire locale pleine : photo non enregistrée', '⚠️');
    }
    onDone();
  };
  return (
    <BottomSheet sheetKey="rep-form" snap="full">
      <div className="pad">
        <div className="sheet-header compact">
          <div><h3>Nouveau signalement</h3><small>Étape finale</small></div>
          <button className="icon-btn ghost round" onClick={onCancel}><X size={18} /></button>
        </div>
        <Field label="Catégorie">
          <div className="chips-wrap">{CATS.map((c) => <Chip key={c} active={cat === c} color={REPORT_META[c].color} icon={<Icon name={REPORT_META[c].icon} size={14} />} onClick={() => onCat(c)}>{REPORT_META[c].label}</Chip>)}</div>
        </Field>
        <Field label="Emplacement">
          <button className="location-box" onClick={onRepick}>
            <MapPin size={18} />
            <span><b>Près de {near}</b><small>{point[1].toFixed(5)}, {point[0].toFixed(5)}</small></span>
            <span className="link">Modifier</span>
          </button>
        </Field>
        {(cat === 'agressif' || cat === 'comportement') && <PeopleNotice />}
        <Field label="Description"><textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Décrivez le problème (ex. : lampadaire éteint devant le n° 412)" /></Field>
        <Field label="Photo (facultatif)">
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setPhoto(await compress(f)); }} />
          {photo ? (
            <div className="photo-preview"><img src={photo} alt="" /><button onClick={() => setPhoto(undefined)}><X size={16} /></button></div>
          ) : (
            <button className="photo-drop" onClick={() => fileRef.current?.click()}><ImagePlus size={22} /><span>Ajouter une photo</span><small><Camera size={12} /> Appareil photo ou galerie</small></button>
          )}
        </Field>
        <div className="local-notice"><Info size={16} /><span>Ce signalement restera <b>local à l’application</b>. Il n’est pas transmis à la Ville. Pour une demande officielle : <b>311</b>.</span></div>
        <button className="btn btn-primary full big" onClick={submit}>Enregistrer le signalement</button>
      </div>
    </BottomSheet>
  );
}

/* ===================== ESPACE ADMINISTRATION (Ville) ===================== */
export function AdminPage() {
  const reports = useReports();
  const events = useEvents();
  const going = useApp((s) => s.going);
  const joined = useApp((s) => s.joined);
  const groups = useGroups();
  const [view, setView] = useState<'tableau' | 'signalements'>('tableau');
  const [statusF, setStatusF] = useState<ReportStatus | null>(null);
  const [catF, setCatF] = useState<ReportCategory | null>(null);

  const open = reports.filter((r) => r.status !== 'resolu');
  const byCat = CATS.map((c) => ({ c, n: reports.filter((r) => r.category === c).length })).sort((a, b) => b.n - a.n);
  const maxCat = Math.max(1, ...byCat.map((x) => x.n));
  const parkings = useParkings();
  const cases = parkings.reduce((a, p) => a + p.capacity, 0);
  const lamps = useLighting((st) => st.lamps);
  const brokenLamps = lamps.filter((l) => !l.ok).length + reports.filter((r) => r.category === 'lampadaire' && r.status !== 'resolu').length;
  const list = reports.filter((r) => (!statusF || r.status === statusF) && (!catF || r.category === catF)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const upcoming = events.filter((e) => new Date(e.end) > new Date());

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <small className="eyebrow">Ville / Administration</small>
          <h1>Gestion du quartier</h1>
        </div>
      </div>
      <div className="page-sticky">
        <Segmented value={view} onChange={setView} options={[{ value: 'tableau', label: 'Tableau de bord' }, { value: 'signalements', label: 'Signalements', badge: open.length }]} />
      </div>
      {view === 'tableau' ? (
        <div className="pad-x">
          <div className="kpis">
            <Kpi icon={<ListChecks size={18} />} color="#EF4444" value={open.length} label="Signalements ouverts" />
            <Kpi icon={<Lamp size={18} />} color="#F59E0B" value={brokenLamps} label="Lampadaires à vérifier" />
            <Kpi icon={<SquareParking size={18} />} color="#2563EB" value={cases} label="Cases de stationnement municipales" />
            <Kpi icon={<CalendarDays size={18} />} color="#E11D48" value={upcoming.length} label="Événements à venir" />
            <Kpi icon={<Users size={18} />} color="#8B5CF6" value={groups.reduce((a, g) => a + g.members, 0) + joined.length} label="Membres des groupes" exportKey="groupes" />
            <Kpi icon={<Lightbulb size={18} />} color="#10B981" value={lamps.length} label="Lampadaires recensés" />
          </div>
          <LightingCard />
          <EventsDataCard />
          <BusinessDataCard />
          <ParkingDataCard />
          <InstallationsCard />
          <StopsCard />
          <PoliceCard />
          <div className="card">
            <h4 className="card-title"><BarChart3 size={16} /> Signalements par catégorie<ExportArrow k="signalements" /></h4>
            {byCat.map(({ c, n }) => (
              <div key={c} className="bar-row">
                <span className="bar-label"><Icon name={REPORT_META[c].icon} size={14} /> {REPORT_META[c].label}</span>
                <span className="bar-track"><motion.span initial={{ width: 0 }} animate={{ width: `${(n / maxCat) * 100}%` }} transition={{ duration: 0.8 }} style={{ background: REPORT_META[c].color }} /></span>
                <b>{n}</b>
              </div>
            ))}
          </div>
          <div className="card">
            <h4 className="card-title"><CalendarDays size={16} /> Participation aux événements</h4>
            {upcoming.slice(0, 5).map((e) => (
              <div key={e.id} className="dark-row">
                <span className="ellipsis">{e.title}</span>
                <b>{e.attendees + (going.includes(e.id) ? 1 : 0)}</b>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="pad-x">
          <div className="chips-scroll">
            <Chip active={!statusF} onClick={() => setStatusF(null)}>Tous statuts</Chip>
            {(Object.keys(STATUS_META) as ReportStatus[]).map((s) => <Chip key={s} active={statusF === s} color={STATUS_META[s].color} onClick={() => setStatusF(statusF === s ? null : s)}>{STATUS_META[s].label}</Chip>)}
          </div>
          <div className="chips-scroll">
            <Chip active={!catF} onClick={() => setCatF(null)}>Toutes catégories</Chip>
            {CATS.map((c) => <Chip key={c} active={catF === c} color={REPORT_META[c].color} onClick={() => setCatF(catF === c ? null : c)}>{REPORT_META[c].label}</Chip>)}
          </div>
          <div className="local-notice"><Info size={16} /><span>Les signalements proviennent de l’application et ne constituent pas des requêtes officielles 311.</span></div>
          {list.map((r) => <AdminReport key={r.id} r={r} />)}
        </div>
      )}
    </div>
  );
}

const ORIGIN_LABEL: Record<DataOrigin, string> = { demo: 'Données de secours', fichier: 'Fichier du projet', import: 'Fichier importé' };

function OriginBadge({ source, fileName, importedAt }: { source: DataOrigin; fileName?: string; importedAt?: number }) {
  return (
    <div className="data-source">
      <span className={`src-badge ${source}`}>{ORIGIN_LABEL[source]}</span>
      <small>{fileName ? (source === 'fichier' ? `donnees/${fileName}` : fileName) : 'Aucun fichier trouvé dans public/donnees/'}{importedAt ? ` · importé ${timeAgo(new Date(importedAt).toISOString())}` : ''}</small>
    </div>
  );
}

function ImportButton({ label, onFile, accept = '.xlsx,.csv,.tsv,.txt' }: { label: string; onFile: (f: File) => Promise<void>; accept?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <input ref={ref} type="file" hidden accept={accept} onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; setBusy(true); try { await onFile(f); } finally { setBusy(false); } }} />
      <button className="btn btn-primary grow" disabled={busy} onClick={() => ref.current?.click()}><Upload size={16} /> {busy ? 'Lecture…' : label}</button>
    </>
  );
}

function LightingCard() {
  const { lamps, source, fileName, importedAt } = useLighting();
  const toast = useUI((s) => s.showToast);
  const st = useMemo(() => lightingStats(lamps), [lamps]);
  const maxSrc = Math.max(1, ...st.bySource.map((b) => b.count));
  const real = source !== 'demo';
  return (
    <div className="card">
      <h4 className="card-title"><Database size={16} /> Éclairage public<ExportArrow k="eclairage" /></h4>
      <OriginBadge source={source} fileName={fileName} importedAt={importedAt} />
      <div className="light-kpis">
        <div><b>{st.total}</b><small>luminaires</small></div>
        <div><b>{st.inactive}</b><small>inactifs</small></div>
        <div><b>{real ? `${Math.round(st.ledShare * 100)}%` : '—'}</b><small>DEL</small></div>
        <div><b>{st.avgYear ?? '—'}</b><small>année moy.</small></div>
      </div>
      {real && (
        <>
          {st.bySource.slice(0, 5).map((b) => (
            <div key={b.source} className="bar-row">
              <span className="bar-label">{b.source}</span>
              <span className="bar-track"><motion.span initial={{ width: 0 }} animate={{ width: `${(b.count / maxSrc) * 100}%` }} style={{ background: ['LED', 'DEL'].includes(b.source) ? '#38BDF8' : '#F59E0B' }} /></span>
              <b>{b.count}</b>
            </div>
          ))}
          {st.topStreets.length > 0 && <h4 className="mini-title">Rues les plus équipées</h4>}
          {st.topStreets.map((t) => <div key={t.street} className="dark-row"><span className="ellipsis">{t.street}</span><b>{t.count}</b></div>)}
          {(st.avgWatts || st.oldestYear) && <p className="disclaimer">{st.avgWatts ? `Puissance moyenne : ${st.avgWatts} W. ` : ''}{st.oldestYear ? `Plus ancien luminaire : ${st.oldestYear}.` : ''}</p>}
        </>
      )}
      <div className="row-btns">
        <ImportButton label="Importer un fichier" onFile={async (f) => {
          try {
            const res = await importLightingFile(f);
            if (res.missing.length) toast(`Colonnes manquantes : ${res.missing.join(', ')}`, '⚠️');
            else if (!res.lamps.length) toast('Aucun luminaire valide dans ce fichier', '⚠️');
            else toast(`${res.lamps.length} luminaires importés${res.skipped ? ` (${res.skipped} ignorés)` : ''}`, '💡');
          } catch { toast('Fichier illisible (formats : .xlsx, .csv, .tsv)', '⚠️'); }
        }} />
        {source === 'import' && <button className="btn btn-soft" title="Revenir aux fichiers du projet" onClick={async () => { await resetImports(); toast('Retour aux fichiers du projet', '↩️'); }}><RotateCcw size={16} /></button>}
      </div>
      <p className="disclaimer">Format « GI - LU quartier St-Roch » (COORDONNEE_X / COORDONNEE_Y en MTM zone 7). Fichier du projet : <b>public/donnees/eclairage.xlsx</b>. Un fichier importé ici est lu sur l’appareil et n’est envoyé nulle part.</p>
    </div>
  );
}

function EventsDataCard() {
  const { events, source, fileName, importedAt, info } = useEventData();
  const toast = useUI((s) => s.showToast);
  const approx = events.filter((e) => e.approximate).length;
  const upcoming = events.filter((e) => new Date(e.end) > new Date()).length;
  return (
    <div className="card">
      <h4 className="card-title"><CalendarDays size={16} /> Programmation des événements<ExportArrow k="evenements" /></h4>
      <OriginBadge source={source} fileName={fileName} importedAt={importedAt} />
      <div className="light-kpis">
        <div><b>{info?.total ?? events.length}</b><small>lignes</small></div>
        <div><b>{events.length}</b><small>à Saint-Roch</small></div>
        <div><b>{upcoming}</b><small>à venir</small></div>
        <div><b>{approx}</b><small>lieu approx.</small></div>
      </div>
      {info && (info.outside > 0 || info.skipped > 0) && (
        <p className="disclaimer">{info.outside > 0 ? `${info.outside} événement(s) hors Saint-Roch ignoré(s). ` : ''}{info.skipped > 0 ? `${info.skipped} ligne(s) non diffusée(s) ou sans date.` : ''}</p>
      )}
      <div className="row-btns">
        <ImportButton label="Importer un fichier" onFile={async (f) => {
          try {
            const res = await importEventsFile(f);
            if (res.missing.length) toast(`Colonnes manquantes : ${res.missing.join(', ')}`, '⚠️');
            else toast(`${res.events.length} événements à Saint-Roch (sur ${res.total})`, '📅');
          } catch { toast('Fichier illisible (formats : .xlsx, .csv, .tsv)', '⚠️'); }
        }} />
        {source === 'import' && <button className="btn btn-soft" title="Revenir aux fichiers du projet" onClick={async () => { await resetImports(); toast('Retour aux fichiers du projet', '↩️'); }}><RotateCcw size={16} /></button>}
      </div>
      <p className="disclaimer">Format « Événements à venir » de la Ville (Titre PROJET, Site(s) de l’activité, Date et heure de début…). Les sites sont géolocalisés à partir de leur nom ; un événement dont le site n’est pas reconnu est placé au centre du quartier. Fichier du projet : <b>public/donnees/evenements.xlsx</b>.</p>
    </div>
  );
}

function BusinessDataCard() {
  const { places, source, fileName, importedAt, info } = useBusinessData();
  const toast = useUI((s) => s.showToast);
  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of places) m.set(p.category, (m.get(p.category) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [places]);
  const max = Math.max(1, ...byCat.map(([, n]) => n));
  return (
    <div className="card">
      <h4 className="card-title"><Store size={16} /> Registre des entreprises<ExportArrow k="entreprises" /></h4>
      <OriginBadge source={source} fileName={fileName} importedAt={importedAt} />
      <div className="light-kpis">
        <div><b>{info?.total ?? 0}</b><small>lignes</small></div>
        <div><b>{places.length}</b><small>entreprises</small></div>
        <div><b>{info?.located ?? 0}</b><small>sur la carte</small></div>
        <div><b>{info?.unknownStreets.length ?? 0}</b><small>rues inconnues</small></div>
      </div>
      {byCat.slice(0, 6).map(([c, n]) => {
        const meta = CATEGORY_META[c as keyof typeof CATEGORY_META];
        return (
          <div key={c} className="bar-row">
            <span className="bar-label"><Icon name={meta.icon} size={14} /> {meta.label}</span>
            <span className="bar-track"><motion.span initial={{ width: 0 }} animate={{ width: `${(n / max) * 100}%` }} style={{ background: meta.color }} /></span>
            <b>{n}</b>
          </div>
        );
      })}
      {info && info.unknownStreets.length > 0 && (
        <p className="disclaimer">Rues non reconnues (entreprises visibles dans l’annuaire mais pas sur la carte) : {info.unknownStreets.slice(0, 8).map((u) => `${u.street} (${u.count})`).join(', ')}{info.unknownStreets.length > 8 ? '…' : ''}</p>
      )}
      <div className="row-btns">
        <ImportButton label="Importer un fichier" onFile={async (f) => {
          try {
            const res = await importBusinessFile(f);
            if (res.missing.length) toast(`Colonnes manquantes : ${res.missing.join(', ')}`, '⚠️');
            else toast(`${res.places.length} entreprises importées (${res.located} sur la carte)`, '🏪');
          } catch { toast('Fichier illisible (formats : .xlsx, .csv, .tsv)', '⚠️'); }
        }} />
        {source === 'import' && <button className="btn btn-soft" title="Revenir aux fichiers du projet" onClick={async () => { await resetImports(); toast('Retour aux fichiers du projet', '↩️'); }}><RotateCcw size={16} /></button>}
      </div>
      <p className="disclaimer">Format « Registre des entreprises » (Type rue, Nom rue, Marque de Commerce). Sans numéro civique, chaque entreprise est placée à une position approximative mais stable sur sa rue ; la catégorie est déduite du nom. Fichier du projet : <b>public/donnees/commerces.xlsx</b>.</p>
    </div>
  );
}

function ParkingDataCard() {
  const { municipal, source, fileName, importedAt, info } = useParkingData();
  const toast = useUI((s) => s.showToast);
  const cases = municipal.reduce((a, p) => a + p.capacity, 0);
  const indoor = municipal.filter((p) => p.indoor).length;
  return (
    <div className="card">
      <h4 className="card-title"><ParkingIcon size={16} /> Stationnements municipaux hors rue<ExportArrow k="stationnements" /></h4>
      <OriginBadge source={source} fileName={fileName} importedAt={importedAt} />
      <div className="light-kpis">
        <div><b>{municipal.length}</b><small>stationnements</small></div>
        <div><b>{cases}</b><small>cases</small></div>
        <div><b>{indoor}</b><small>intérieurs</small></div>
        <div><b>{municipal.length - indoor}</b><small>extérieurs</small></div>
      </div>
      {municipal.map((p) => <div key={p.id} className="dark-row"><span className="ellipsis">{p.name}</span><b>{p.capacity}</b></div>)}
      {info && info.skipped > 0 && <p className="disclaimer">{info.skipped} entité(s) sans nom ou sans coordonnées ignorée(s).</p>}
      <div className="row-btns">
        <ImportButton label="Importer un GeoJSON" accept=".geojson,.json" onFile={async (f) => {
          try {
            const res = await importParkingFile(f);
            if (res.error) toast(res.error, '⚠️');
            else toast(`${res.parkings.length} stationnements importés`, '🅿️');
          } catch { toast('Fichier GeoJSON illisible', '⚠️'); }
        }} />
        {source === 'import' && <button className="btn btn-soft" title="Revenir aux fichiers du projet" onClick={async () => { await resetImports(); toast('Retour aux fichiers du projet', '↩️'); }}><RotateCcw size={16} /></button>}
      </div>
      <p className="disclaimer">Format « StationnementsMunicipauxHorsRues » (GeoJSON : NOM, ADRESSE_À_PROXIMITÉ, NOMBRE_DE_CASES, TYPE_INT_EXT…). Fichier du projet : <b>public/donnees/stationnements.geojson</b>. Seuls les champs du jeu sont affichés (aucun tarif ni disponibilité).</p>
    </div>
  );
}

function InstallationsCard() {
  const { places, source, fileName, importedAt, info } = useInstallations();
  const toast = useUI((s) => s.showToast);
  const max = Math.max(1, ...(info?.byType ?? []).map((t) => t.count));
  return (
    <div className="card">
      <h4 className="card-title"><Building2 size={16} /> Installations municipales<ExportArrow k="installations" /></h4>
      <OriginBadge source={source} fileName={fileName} importedAt={importedAt} />
      <div className="light-kpis">
        <div><b>{info?.total ?? 0}</b><small>lignes</small></div>
        <div><b>{places.length}</b><small>à Saint-Roch</small></div>
        <div><b>{info?.located ?? 0}</b><small>sur la carte</small></div>
        <div><b>{info?.outside ?? 0}</b><small>hors quartier</small></div>
      </div>
      {(info?.byType ?? []).slice(0, 6).map((t) => (
        <div key={t.type} className="bar-row">
          <span className="bar-label">{t.type}</span>
          <span className="bar-track"><motion.span initial={{ width: 0 }} animate={{ width: `${(t.count / max) * 100}%` }} style={{ background: '#2563EB' }} /></span>
          <b>{t.count}</b>
        </div>
      ))}
      <div className="row-btns">
        <ImportButton label="Importer un fichier" onFile={async (f) => {
          try {
            const res = await importInstallationsFile(f);
            if (res.missing.length) toast(`Colonnes manquantes : ${res.missing.join(', ')}`, '⚠️');
            else toast(`${res.places.length} installations à Saint-Roch (sur ${res.total})`, '🏛️');
          } catch { toast('Fichier illisible (formats : .xlsx, .csv, .tsv)', '⚠️'); }
        }} />
        {source === 'import' && <button className="btn btn-soft" title="Revenir aux fichiers du projet" onClick={async () => { await resetImports(); toast('Retour aux fichiers du projet', '↩️'); }}><RotateCcw size={16} /></button>}
      </div>
      <p className="disclaimer">Format « Liste des installations » (Arrondissement_0, Nom_Type_No_Installation_calculé, Adresse, Type d’équipement texte). Seules les installations de Saint-Roch (code postal G1K ou rue du quartier) sont conservées. Fichier du projet : <b>public/donnees/installations.xlsx</b>.</p>
    </div>
  );
}

function StopsCard() {
  const { stops, source, fileName, importedAt, info } = useStops();
  const toast = useUI((s) => s.showToast);
  const accessible = stops.filter((s) => s.wheelchair).length;
  return (
    <div className="card">
      <h4 className="card-title"><Bus size={16} /> Arrêts d’autobus (RTC)<ExportArrow k="arrets" /></h4>
      <OriginBadge source={source} fileName={fileName} importedAt={importedAt} />
      <div className="light-kpis">
        <div><b>{info?.total ?? 0}</b><small>arrêts lus</small></div>
        <div><b>{stops.length}</b><small>à Saint-Roch</small></div>
        <div><b>{accessible}</b><small>accessibles</small></div>
        <div><b>{info?.outside ?? 0}</b><small>hors zone</small></div>
      </div>
      <div className="row-btns">
        <ImportButton label="Importer stops.txt" accept=".txt,.csv" onFile={async (f) => {
          try {
            const res = await importStopsFile(f);
            if (res.missing.length) toast(`Colonnes manquantes : ${res.missing.join(', ')}`, '⚠️');
            else toast(`${res.stops.length} arrêts à Saint-Roch (sur ${res.total})`, '🚌');
          } catch { toast('Fichier illisible', '⚠️'); }
        }} />
        {source === 'import' && <button className="btn btn-soft" title="Revenir aux fichiers du projet" onClick={async () => { await resetImports(); toast('Retour aux fichiers du projet', '↩️'); }}><RotateCcw size={16} /></button>}
      </div>
      <p className="disclaimer">Format GTFS : fichier <b>stops.txt</b> des données ouvertes du RTC (stop_id, stop_name, stop_lat, stop_lon…), copié tel quel dans <b>public/donnees/stops.txt</b>. Seuls les arrêts de Saint-Roch et des abords sont affichés.</p>
    </div>
  );
}

const CSV = 'text/csv;charset=utf-8';
const GEOJSON = 'application/geo+json';

type ExportKey = 'signalements' | 'evenements' | 'stationnements' | 'entreprises' | 'installations' | 'arrets' | 'eclairage' | 'groupes';

/** Petite flèche de téléchargement en haut à droite d'une carte : exporte le jeu de données correspondant. */
function ExportArrow({ k }: { k: ExportKey }) {
  const reports = useReports();
  const events = useEvents();
  const { going, favorites, joined, groupMessages } = useApp();
  const parkings = useParkings();
  const places = usePlaces();
  const stops = useStops((s) => s.stops);
  const lamps = useLighting((s) => s.lamps);
  const groups = useGroups();
  const toast = useUI((s) => s.showToast);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  const save = (content: string, base: string, ext: 'csv' | 'geojson', n: number) => {
    download(content, exportName(base, ext), ext === 'csv' ? CSV : GEOJSON);
    toast(`${n} élément${n > 1 ? 's' : ''} exporté${n > 1 ? 's' : ''} (${ext.toUpperCase()})`, '📥');
    setOpen(false);
  };
  const registry = places.filter((p) => p.registry);
  const installations = places.filter((p) => p.installation);
  const def: Record<ExportKey, { label: string; n: number; csv?: () => void; geo?: () => void }> = {
    signalements: { label: 'les signalements', n: reports.length, csv: () => save(reportsCSV(reports), 'signalements', 'csv', reports.length), geo: () => save(reportsGeoJSON(reports), 'signalements', 'geojson', reports.length) },
    evenements: { label: 'les événements', n: events.length, csv: () => save(eventsCSV(events, going, favorites), 'evenements', 'csv', events.length) },
    stationnements: { label: 'les stationnements', n: parkings.length, geo: () => save(parkingsGeoJSON(parkings), 'stationnements', 'geojson', parkings.length) },
    entreprises: { label: 'le registre des entreprises', n: registry.length, csv: () => save(placesCSV(registry), 'entreprises', 'csv', registry.length) },
    installations: { label: 'les installations', n: installations.length, csv: () => save(placesCSV(installations), 'installations', 'csv', installations.length) },
    arrets: { label: 'les arrêts d’autobus', n: stops.length, csv: () => save(stopsCSV(stops), 'arrets', 'csv', stops.length) },
    eclairage: { label: 'l’éclairage', n: lamps.length, csv: () => save(lampsCSV(lamps), 'eclairage', 'csv', lamps.length) },
    groupes: { label: 'les groupes', n: groups.length, csv: () => save(groupsCSV(groups, joined, groupMessages), 'groupes', 'csv', groups.length) },
  };
  const d = def[k];
  const both = !!(d.csv && d.geo);
  return (
    <span className="export-arrow-wrap" ref={wrap}>
      <button className="export-arrow" disabled={!d.n} title={`Exporter ${d.label}`} aria-label={`Exporter ${d.label}`} onClick={() => (both ? setOpen(!open) : (d.csv ?? d.geo)!())}>
        <Download size={16} />
      </button>
      {open && (
        <span className="export-pop">
          <button onClick={d.csv}><FileDown size={14} /> CSV</button>
          <button onClick={d.geo}><FileDown size={14} /> GeoJSON</button>
        </span>
      )}
    </span>
  );
}

function PoliceCard() {
  const { stations, source, fileName, importedAt } = usePolice();
  const toast = useUI((s) => s.showToast);
  return (
    <div className="card">
      <h4 className="card-title"><Shield size={16} /> Postes de police</h4>
      <OriginBadge source={source} fileName={fileName} importedAt={importedAt} />
      {stations.map((st) => (
        <div key={st.id} className="dark-row">
          <span className="ellipsis">{st.name}<small className="muted"> · {st.address}{st.phone ? ` · ${st.phone}` : ''}</small></span>
          <b>{st.hours}</b>
        </div>
      ))}
      {stations.some((st) => st.approximate) && <p className="disclaimer">Position approximative (à vérifier) : la propriété POSITION vaut « approximative ».</p>}
      <div className="row-btns">
        <ImportButton label="Importer un GeoJSON" accept=".geojson,.json" onFile={async (f) => {
          try {
            const res = await importPoliceFile(f);
            if (res.error) toast(res.error, '⚠️');
            else toast(`${res.stations.length} poste(s) de police importé(s)`, '🚓');
          } catch { toast('Fichier GeoJSON illisible', '⚠️'); }
        }} />
        {source === 'import' && <button className="btn btn-soft" title="Revenir aux fichiers du projet" onClick={async () => { await resetImports(); toast('Retour aux fichiers du projet', '↩️'); }}><RotateCcw size={16} /></button>}
      </div>
      <p className="disclaimer">Utilisés par le score de sécurité des trajets (aide la plus proche). Fichier du projet : <b>public/donnees/postes-police.geojson</b> (NOM, ADRESSE, TELEPHONE, HORAIRE, POSITION).</p>
    </div>
  );
}

function Kpi({ icon, value, label, color, exportKey }: { icon: React.ReactNode; value: number | string; label: string; color: string; exportKey?: ExportKey }) {
  return (
    <motion.div className="kpi" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      {exportKey && <span className="kpi-export"><ExportArrow k={exportKey} /></span>}
      <span className="kpi-icon" style={{ background: `${color}1F`, color }}>{icon}</span>
      <b>{value}</b>
      <small>{label}</small>
    </motion.div>
  );
}

function AdminReport({ r }: { r: Report }) {
  const setStatus = useApp((s) => s.setReportStatus);
  const m = REPORT_META[r.category];
  return (
    <div className="admin-report">
      <div className="ar-top" onClick={() => showOnMap('report', r.id, r.ll)}>
        {r.photo ? <img src={r.photo} alt="" className="rr-photo" /> : <span className="rr-icon" style={{ background: m.color }}><Icon name={m.icon} size={17} /></span>}
        <span className="rr-main">
          <b>{m.label}</b>
          <small>{r.description}</small>
          <small className="muted">{timeAgo(r.createdAt)} · {r.author} · {r.votes} appuis</small>
        </span>
        <MapIcon size={18} className="muted" />
        <ChevronRight size={16} className="muted" />
      </div>
      <div className="status-choices">
        {(Object.keys(STATUS_META) as ReportStatus[]).map((s) => (
          <button key={s} className={`status-choice ${r.status === s ? 'on' : ''}`} style={{ ['--c' as string]: STATUS_META[s].color }} onClick={() => setStatus(r.id, s)}>{STATUS_META[s].label}</button>
        ))}
      </div>
    </div>
  );
}

/* Signalement rapide pendant un trajet : un toucher pour la catégorie, position = position actuelle */
export function QuickReport({ ll, onClose }: { ll: LngLat; onClose: () => void }) {
  const add = useApp((s) => s.addReport);
  const profile = useApp((s) => s.profile);
  const toast = useUI((s) => s.showToast);
  const [cat, setCat] = useState<ReportCategory | null>(null);
  const [desc, setDesc] = useState('');
  const submit = () => {
    if (!cat) return;
    add({
      id: `ur-${Date.now()}`, category: cat, ll, description: desc.trim() || `${REPORT_META[cat].label} signalé pendant un trajet`,
      createdAt: new Date().toISOString(), status: 'nouveau', author: profile === 'entreprise' ? 'Commerçant·e' : 'Moi', mine: true, votes: 0,
    });
    toast('Signalement enregistré à votre position', '📍');
    onClose();
  };
  return (
    <Modal title="Signaler ici" onClose={onClose} footer={<button className="btn btn-primary full big" disabled={!cat} onClick={submit}>Enregistrer et reprendre le trajet</button>}>
      <p className="muted small-text">Le guidage est en pause. Le signalement sera placé à votre position actuelle sur le trajet. Danger immédiat : <a className="link" href="tel:911">911</a>.</p>
      <SafetyGrid selected={cat} onPick={setCat} />
      <h4 className="mini-title">Infrastructure</h4>
      <div className="report-grid compact">
        {INFRA_CATS.map((c) => {
          const m = REPORT_META[c];
          return (
            <button key={c} className={`report-cat ${cat === c ? 'picked' : ''}`} style={{ ['--c' as string]: m.color }} onClick={() => setCat(c)}>
              <span style={{ background: `${m.color}1F`, color: m.color }}><Icon name={m.icon} size={18} /></span>
              <b>{m.label}</b>
            </button>
          );
        })}
      </div>
      {cat && (cat === 'agressif' || cat === 'comportement') && <PeopleNotice />}
      <Field label="Précision (facultatif)"><input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex. : lampadaire éteint au coin de la rue" /></Field>
      <div className="local-notice"><Info size={16} /><span>Enregistré <b>localement dans l’application</b>, non transmis à la Ville. Pour une demande officielle : <b>311</b>.</span></div>
    </Modal>
  );
}

/* Grille des signalements de sécurité (tuiles larges, icône dans un cercle coloré) */
export function SafetyGrid({ onPick, selected }: { onPick: (c: ReportCategory) => void; selected?: ReportCategory | null }) {
  return (
    <div className="safety-grid">
      {SAFETY_CATS.map((c, i) => {
        const m = REPORT_META[c];
        return (
          <motion.button key={c} className={`safety-tile ${selected === c ? 'picked' : ''}`} style={{ ['--c' as string]: m.color }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} whileTap={{ scale: 0.96 }} onClick={() => onPick(c)}>
            <span className="st-icon"><Icon name={m.icon} size={24} strokeWidth={2.4} /></span>
            <b>{m.label}</b>
          </motion.button>
        );
      })}
    </div>
  );
}

function PeopleNotice() {
  return (
    <div className="local-notice warn"><Info size={16} /><span>Signalez une <b>situation</b> ou un comportement, jamais une personne en raison de son apparence ou de sa situation (itinérance, etc.). Ce signalement disparaît automatiquement après 3 heures. En cas de danger, composez le <b>911</b>.</span></div>
  );
}
