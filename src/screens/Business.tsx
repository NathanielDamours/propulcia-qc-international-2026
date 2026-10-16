import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Briefcase, Calendar, ChevronRight, Clock, DollarSign, Handshake, Heart, Inbox, MapPin, Map as MapIcon, MessageSquare, Navigation, Phone, Plus, Search, Send, Star, X, CheckCircle2 } from 'lucide-react';
import { CATEGORY_META, PlaceCategory } from '../data/places';
import { MY_COMPANY, Proposal, Annonce } from '../data/community';
import { useApp, useUI } from '../lib/store';
import { useAnnonces, useProposals, usePlaces, usePlace } from '../lib/selectors';
import { Avatar, Chip, Empty, Field, FullPage, Modal, Segmented, Stars } from '../components/ui';
import { Icon } from '../components/Icon';
import { goRoute, showOnMap } from '../lib/actions';
import { Discussion } from './Groups';
import { dist, formatDist, ME } from '../lib/geo';

/* ===================== ANNUAIRE ===================== */
export function DirectoryPage() {
  const push = useUI((s) => s.pushOverlay);
  const favs = useApp((s) => s.favoritePlaces);
  const profile = useApp((s) => s.profile);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<PlaceCategory | 'orgs' | 'ville' | null>(null);
  const [limit, setLimit] = useState(60);
  const places = usePlaces();
  const list = useMemo(() => places.filter((p) => {
    if (cat === 'orgs' && !p.isOrganization) return false;
    if (cat === 'ville' && !p.installation) return false;
    if (cat && cat !== 'orgs' && cat !== 'ville' && p.category !== cat) return false;
    return (p.name + p.description + p.address + p.tags.join()).toLowerCase().includes(q.toLowerCase());
  }).map((p) => ({ p, d: p.registry && !p.located ? Infinity : dist(ME, p.ll) })).sort((a, b) => a.d - b.d), [q, cat, places]);
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <small className="eyebrow">Entreprises & organismes</small>
          <h1>Annuaire</h1>
        </div>
        <span className="going-count"><Heart size={15} /> {favs.length}</span>
      </div>
      <div className="page-sticky">
        <div className="search-input soft">
          <Search size={17} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Café, librairie, organisme…" />
          {q && <button onClick={() => setQ('')}><X size={15} /></button>}
        </div>
        <div className="chips-scroll">
          <Chip active={!cat} onClick={() => setCat(null)}>Tous</Chip>
          <Chip active={cat === 'ville'} color="#2563EB" onClick={() => setCat(cat === 'ville' ? null : 'ville')}>Installations municipales</Chip>
          <Chip active={cat === 'orgs'} color="#14B8A6" onClick={() => setCat(cat === 'orgs' ? null : 'orgs')}>Organismes</Chip>
          {(Object.keys(CATEGORY_META) as PlaceCategory[]).map((c) => <Chip key={c} active={cat === c} color={CATEGORY_META[c].color} onClick={() => setCat(cat === c ? null : c)}>{CATEGORY_META[c].label}</Chip>)}
        </div>
      </div>
      <div className="biz-list">
        {list.length === 0 && <Empty icon={<Search size={26} />} title="Aucun résultat" text="Modifiez votre recherche." />}
        <p className="list-count">{list.length} lieu{list.length > 1 ? 'x' : ''}</p>
        {list.slice(0, limit).map(({ p, d }, i) => {
          const m = CATEGORY_META[p.category];
          return (
            <motion.button key={p.id} className="biz-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }} onClick={() => push({ kind: 'place', id: p.id })}>
              <span className="biz-icon" style={{ background: m.color }}><Icon name={m.icon} size={20} /></span>
              <span className="biz-main">
                <b>{p.name}</b>
                <small>{m.label}{isFinite(d) ? ` · ${formatDist(d)}` : ''}{p.reviews > 0 && <> · <Star size={11} fill="currentColor" /> {p.rating.toFixed(1)}</>}</small>
                <small className="muted">{p.address}</small>
              </span>
              {favs.includes(p.id) && <Heart size={16} className="fav-on-text" fill="currentColor" />}
              <ChevronRight size={18} className="muted" />
            </motion.button>
          );
        })}
        {list.length > limit && <button className="btn btn-soft full" onClick={() => setLimit(limit + 60)}>Afficher plus ({list.length - limit})</button>}
      </div>
    </div>
  );
}

export function PlacePage({ id }: { id: string }) {
  const p = usePlace(id);
  const pop = useUI((s) => s.popOverlay);
  const favs = useApp((s) => s.favoritePlaces);
  const toggleFav = useApp((s) => s.toggleFavoritePlace);
  if (!p) return null;
  const m = CATEGORY_META[p.category];
  return (
    <FullPage onBack={pop} title={m.label} right={<button className={`icon-btn ${favs.includes(id) ? 'fav-on' : 'ghost'}`} onClick={() => toggleFav(id)}><Heart size={19} fill={favs.includes(id) ? 'currentColor' : 'none'} /></button>}>
      <div className="place-hero" style={{ background: `linear-gradient(135deg, ${m.color}, ${m.color}AA)` }}>
        <span className="place-hero-icon"><Icon name={m.icon} size={34} /></span>
        <h1>{p.name}</h1>
        <div className="place-hero-meta">{p.reviews > 0 ? <><Stars value={p.rating} size={14} /> {p.rating.toFixed(1)} · {p.reviews} avis</> : p.installation ? `Installation municipale${p.code ? ` · ${p.code}` : ''}` : 'Registre des entreprises de Saint-Roch'}</div>
      </div>
      <div className="ed-body">
        <p className="detail-text">{p.description}</p>
        <div className="info-list">
          <div className="info-item"><MapPin size={16} /><span>{p.address}</span></div>
          {p.hours && <div className="info-item"><Clock size={16} /><span>{p.hours}</span></div>}
          {p.phone && <div className="info-item"><Phone size={16} /><a href={`tel:${p.phone}`}>{p.phone}</a></div>}
        </div>
        {p.tags.length > 0 && <div className="tags">{p.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div>}
        {p.registry && <p className="disclaimer">{p.installation ? `Source : liste des installations municipales. ${p.located ? (p.approxPosition ? 'Position estimée à partir de l’adresse.' : '') : 'Adresse non reconnue : position inconnue.'}` : `Source : registre des entreprises. ${p.located ? 'Position approximative sur la rue (pas de numéro civique dans le registre).' : 'Rue non reconnue : position inconnue.'}`}</p>}
        <div className="go-grid">
          <button disabled={p.registry && !p.located} onClick={() => showOnMap('place', p.id, p.ll)}><MapIcon size={20} /><span>Voir sur la carte</span></button>
          <button disabled={p.registry && !p.located} onClick={() => goRoute(p.ll, p.name)}><Navigation size={20} /><span>Itinéraire</span></button>
          {p.phone ? <a href={`tel:${p.phone}`}><Phone size={20} /><span>Appeler</span></a> : <button onClick={() => toggleFav(id)}><Heart size={20} /><span>Favori</span></button>}
        </div>
      </div>
    </FullPage>
  );
}

/* ===================== COLLABORATIONS ===================== */
type CTab = 'explorer' | 'annonces' | 'propositions';

export function CollabsPage() {
  const annonces = useAnnonces();
  const proposals = useProposals();
  const push = useUI((s) => s.pushOverlay);
  const [tab, setTab] = useState<CTab>('explorer');
  const [q, setQ] = useState('');
  const explore = annonces.filter((a) => !a.mine && (a.title + a.description + a.needs.join()).toLowerCase().includes(q.toLowerCase()));
  const mine = annonces.filter((a) => a.mine);
  const myProps = proposals.filter((p) => p.mine);
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <small className="eyebrow">{MY_COMPANY} · Espace entreprise</small>
          <h1>Collaborations</h1>
        </div>
        <button className="btn btn-primary" onClick={() => push({ kind: 'new-annonce' })}><Plus size={17} /> Annonce</button>
      </div>
      <div className="page-sticky">
        <Segmented value={tab} onChange={setTab} options={[
          { value: 'explorer', label: 'Explorer' },
          { value: 'annonces', label: 'Mes annonces', badge: mine.length },
          { value: 'propositions', label: 'Mes propositions', badge: myProps.length },
        ]} />
        {tab === 'explorer' && (
          <div className="search-input soft">
            <Search size={17} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Salle, traiteur, artiste…" />
            {q && <button onClick={() => setQ('')}><X size={15} /></button>}
          </div>
        )}
      </div>
      <div className="collab-list">
        {tab === 'explorer' && explore.map((a, i) => <AnnonceCard key={a.id} a={a} i={i} count={proposals.filter((p) => p.annonceId === a.id).length} />)}
        {tab === 'annonces' && (mine.length ? mine.map((a, i) => (
          <div key={a.id}>
            <AnnonceCard a={a} i={i} count={proposals.filter((p) => p.annonceId === a.id).length} />
            <div className="received">
              <h4 className="mini-title"><Inbox size={14} /> Propositions reçues</h4>
              {proposals.filter((p) => p.annonceId === a.id).map((p) => <ProposalRow key={p.id} p={p} />)}
              {proposals.filter((p) => p.annonceId === a.id).length === 0 && <p className="disclaimer">Aucune proposition pour l’instant.</p>}
            </div>
          </div>
        )) : <Empty icon={<Briefcase size={26} />} title="Aucune annonce" text="Publiez un besoin pour trouver des partenaires du quartier." />)}
        {tab === 'propositions' && (myProps.length ? myProps.map((p) => {
          const a = annonces.find((x) => x.id === p.annonceId);
          return (
            <div key={p.id} className="my-prop">
              <small className="muted">En réponse à</small>
              <b>{a?.title}</b>
              <small className="muted">{a?.company}</small>
              <ProposalRow p={p} showCompany={false} />
            </div>
          );
        }) : <Empty icon={<Send size={26} />} title="Aucune proposition" text="Explorez les annonces et proposez vos services." />)}
      </div>
    </div>
  );
}

function AnnonceCard({ a, i, count }: { a: Annonce; i: number; count: number }) {
  const push = useUI((s) => s.pushOverlay);
  return (
    <motion.div className="annonce" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} onClick={() => push({ kind: 'annonce', id: a.id })}>
      <div className="an-head">
        <Avatar name={a.company} color={a.companyColor} size={38} />
        <div>
          <b>{a.company}</b>
          <small>{a.createdAt}{a.mine ? ' · Votre annonce' : ''}</small>
        </div>
        <span className="an-count"><MessageSquare size={13} /> {count}</span>
      </div>
      <h3>{a.title}</h3>
      <p>{a.description}</p>
      <div className="needs">{a.needs.map((n) => <span key={n} className="need">{n}</span>)}</div>
      <div className="an-foot">
        <span><Calendar size={13} /> {a.date}</span>
        <span><DollarSign size={13} /> {a.budget}</span>
      </div>
    </motion.div>
  );
}

const STATUS_P: Record<Proposal['status'], { label: string; cls: string }> = {
  'en-attente': { label: 'En attente', cls: 'wait' },
  acceptee: { label: 'Acceptée', cls: 'ok' },
  refusee: { label: 'Refusée', cls: 'no' },
};

function ProposalRow({ p, showCompany = true }: { p: Proposal; showCompany?: boolean }) {
  const push = useUI((s) => s.pushOverlay);
  const last = p.chat[p.chat.length - 1];
  return (
    <button className="proposal" onClick={() => push({ kind: 'chat', proposalId: p.id })}>
      <Avatar name={p.company} size={40} />
      <span className="pr-main">
        <b>{showCompany ? p.company : p.service} <em className={`pstatus ${STATUS_P[p.status].cls}`}>{STATUS_P[p.status].label}</em></b>
        <small>{p.service} · {p.price}</small>
        {last && <small className="muted ellipsis">{last.me ? 'Vous : ' : ''}{last.text}</small>}
      </span>
      <ChevronRight size={18} className="muted" />
    </button>
  );
}

export function AnnoncePage({ id }: { id: string }) {
  const annonces = useAnnonces();
  const proposals = useProposals();
  const a = annonces.find((x) => x.id === id);
  const pop = useUI((s) => s.popOverlay);
  const push = useUI((s) => s.pushOverlay);
  if (!a) return null;
  const props = proposals.filter((p) => p.annonceId === id);
  const already = props.find((p) => p.mine);
  return (
    <FullPage onBack={pop} title="Annonce">
      <div className="ed-body">
        <div className="an-head big">
          <Avatar name={a.company} color={a.companyColor} size={52} />
          <div><b>{a.company}</b><small>Publiée {a.createdAt}</small></div>
        </div>
        <h1 className="an-title">{a.title}</h1>
        <p className="detail-text">{a.description}</p>
        <h4 className="mini-title">Besoins</h4>
        <div className="needs big">{a.needs.map((n) => <span key={n} className="need">{n}</span>)}</div>
        <div className="ed-cards">
          <div className="ed-card"><Calendar size={18} /><div><b>{a.date}</b><small>Date</small></div></div>
          <div className="ed-card"><DollarSign size={18} /><div><b>{a.budget}</b><small>Budget</small></div></div>
          <div className="ed-card"><MapPin size={18} /><div><b>{a.location}</b><small>Lieu</small></div></div>
          <div className="ed-card"><MessageSquare size={18} /><div><b>{props.length}</b><small>Propositions</small></div></div>
        </div>
        {a.mine ? (
          <>
            <h4 className="mini-title"><Inbox size={14} /> Propositions reçues</h4>
            {props.map((p) => <ProposalRow key={p.id} p={p} />)}
          </>
        ) : already ? (
          <button className="btn btn-soft full big" onClick={() => push({ kind: 'chat', proposalId: already.id })}><CheckCircle2 size={18} /> Proposition envoyée — ouvrir la conversation</button>
        ) : (
          <button className="btn btn-primary full big" onClick={() => push({ kind: 'propose', annonceId: id })}><Handshake size={18} /> Faire une proposition</button>
        )}
      </div>
    </FullPage>
  );
}

export function ProposeModal({ annonceId }: { annonceId: string }) {
  const annonces = useAnnonces();
  const a = annonces.find((x) => x.id === annonceId)!;
  const pop = useUI((s) => s.popOverlay);
  const push = useUI((s) => s.pushOverlay);
  const add = useApp((s) => s.addProposal);
  const toast = useUI((s) => s.showToast);
  const [service, setService] = useState(a.needs[0]);
  const [price, setPrice] = useState('');
  const [message, setMessage] = useState('');
  const submit = () => {
    const id = `upr-${Date.now()}`;
    const time = new Date().toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
    add({ id, annonceId, company: MY_COMPANY, service, price: price || 'À discuter', message, status: 'en-attente', mine: true, chat: [{ id: 'c0', author: MY_COMPANY, text: message, time, me: true }] });
    pop();
    toast('Proposition envoyée !', '🤝');
    setTimeout(() => push({ kind: 'chat', proposalId: id }), 250);
  };
  return (
    <Modal title="Faire une proposition" onClose={pop} footer={<button className="btn btn-primary full big" disabled={message.trim().length < 5} onClick={submit}><Send size={17} /> Envoyer</button>}>
      <p className="muted small-text">Pour : <b>{a.title}</b> — {a.company}</p>
      <Field label="Service proposé"><div className="chips-wrap">{[...a.needs, 'Autre'].map((n) => <Chip key={n} active={service === n} onClick={() => setService(n)}>{n}</Chip>)}</div></Field>
      <Field label="Prix proposé"><input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Ex. : 1 200 $" /></Field>
      <Field label="Message"><textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Présentez votre offre…" /></Field>
    </Modal>
  );
}

export function NewAnnonceModal() {
  const pop = useUI((s) => s.popOverlay);
  const add = useApp((s) => s.addAnnonce);
  const toast = useUI((s) => s.showToast);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [needs, setNeeds] = useState<string[]>([]);
  const [date, setDate] = useState('');
  const [budget, setBudget] = useState('');
  const ALL = ['Salle', 'Traiteur', 'Chaises & tables', 'Animation', 'Artiste', 'Design', 'Logistique', 'Commandite', 'Bénévoles', 'Sécurité'];
  const valid = title.trim().length > 3 && needs.length > 0;
  return (
    <Modal title="Nouvelle annonce" onClose={pop} footer={<button className="btn btn-primary full big" disabled={!valid} onClick={() => {
      add({ id: `uan-${Date.now()}`, title: title.trim(), company: MY_COMPANY, companyColor: '#06B6D4', description: desc.trim() || 'Détails à venir.', needs, date: date || 'À définir', budget: budget || 'À discuter', location: 'Saint-Roch', mine: true, createdAt: 'à l’instant' });
      pop();
      toast('Annonce publiée auprès des entreprises du quartier', '📢');
    }}>Publier l’annonce</button>}>
      <Field label="Titre"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. : Party de Noël pour 200 personnes" /></Field>
      <Field label="Besoins"><div className="chips-wrap">{ALL.map((n) => <Chip key={n} active={needs.includes(n)} onClick={() => setNeeds((x) => (x.includes(n) ? x.filter((y) => y !== n) : [...x, n]))}>{n}</Chip>)}</div></Field>
      <div className="field-row">
        <Field label="Date"><input value={date} onChange={(e) => setDate(e.target.value)} placeholder="12 décembre" /></Field>
        <Field label="Budget"><input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="5 000 $" /></Field>
      </div>
      <Field label="Description"><textarea rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Décrivez votre projet…" /></Field>
    </Modal>
  );
}

const AUTO_REPLIES = [
  'Merci pour votre message ! Je vous reviens d’ici la fin de la journée.',
  'Parfait, c’est noté 👍',
  'Bonne idée ! Pouvons-nous en discuter de vive voix cette semaine ?',
  'Je vous envoie une soumission détaillée sous peu.',
];

export function ChatPage({ proposalId }: { proposalId: string }) {
  const proposals = useProposals();
  const annonces = useAnnonces();
  const p = proposals.find((x) => x.id === proposalId);
  const pop = useUI((s) => s.popOverlay);
  const send = useApp((s) => s.sendProposalMessage);
  const setStatus = useApp((s) => s.setProposalStatus);
  const toast = useUI((s) => s.showToast);
  if (!p) return null;
  const a = annonces.find((x) => x.id === p.annonceId);
  const other = p.mine ? a?.company ?? 'Entreprise' : p.company;
  const isMyAnnonce = a?.mine;
  return (
    <FullPage onBack={pop} className="chat-page" title={<div className="chat-title"><Avatar name={other} size={32} /><div><b>{other}</b><small>{p.service} · {a?.title}</small></div></div>}>
      <div className="chat-context">
        <div><small>Proposition</small><b>{p.service} — {p.price}</b></div>
        <em className={`pstatus ${STATUS_P[p.status].cls}`}>{STATUS_P[p.status].label}</em>
      </div>
      {isMyAnnonce && p.status === 'en-attente' && (
        <div className="chat-decide">
          <button className="btn btn-success small" onClick={() => { setStatus(p.id, 'acceptee'); toast('Proposition acceptée', '✅'); }}>Accepter</button>
          <button className="btn btn-soft small" onClick={() => { setStatus(p.id, 'refusee'); toast('Proposition refusée', '🙅'); }}>Refuser</button>
        </div>
      )}
      <Discussion
        messages={p.chat}
        onSend={(text) => {
          const time = new Date().toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
          send(p.id, { id: `x-${Date.now()}`, author: MY_COMPANY, text, time, me: true });
          setTimeout(() => send(p.id, { id: `y-${Date.now()}`, author: other, text: AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)], time: new Date().toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' }) }), 1600);
        }}
      />
    </FullPage>
  );
}
