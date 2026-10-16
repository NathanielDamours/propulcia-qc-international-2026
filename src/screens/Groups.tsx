import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, Check, MapPin, MessageCircle, Plus, Search, Send, Users, X, LogOut, Lock } from 'lucide-react';
import { GROUP_META, GroupCategory, ChatMessage, Group } from '../data/community';
import { useGroups } from '../lib/selectors';
import { useApp, useUI } from '../lib/store';
import { Avatar, Chip, Cover, Empty, Field, FullPage, Modal, Segmented } from '../components/ui';
import { AnimatePresence } from 'framer-motion';

export function GroupsPage() {
  const joined = useApp((s) => s.joined);
  const push = useUI((s) => s.pushOverlay);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<GroupCategory | null>(null);
  const [creating, setCreating] = useState(false);
  const groups = useGroups();
  const list = useMemo(() => groups.filter((g) => (!cat || g.category === cat) && (g.name + g.description).toLowerCase().includes(q.toLowerCase())), [q, cat, groups]);
  const mine = groups.filter((g) => joined.includes(g.id));
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <small className="eyebrow">Communauté</small>
          <h1>Groupes</h1>
        </div>
        <button className="btn btn-primary small" onClick={() => setCreating(true)}><Plus size={16} /> Créer</button>
      </div>
      <AnimatePresence>{creating && <CreateGroupModal onClose={() => setCreating(false)} />}</AnimatePresence>
      <div className="page-sticky">
        <div className="search-input soft">
          <Search size={17} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un groupe" />
          {q && <button onClick={() => setQ('')}><X size={15} /></button>}
        </div>
        <div className="chips-scroll">
          <Chip active={!cat} onClick={() => setCat(null)}>Tous</Chip>
          {(Object.keys(GROUP_META) as GroupCategory[]).map((c) => <Chip key={c} active={cat === c} color={GROUP_META[c].color} onClick={() => setCat(cat === c ? null : c)}>{GROUP_META[c].label}</Chip>)}
        </div>
      </div>
      {mine.length > 0 && !q && !cat && (
        <>
          <h4 className="mini-title pad-x">Mes groupes</h4>
          <div className="my-groups">
            {mine.map((g) => {
              const m = GROUP_META[g.category];
              return (
                <button key={g.id} className="my-group" onClick={() => push({ kind: 'group', id: g.id })}>
                  <span className="mg-icon" style={{ background: `linear-gradient(135deg, ${m.gradient[0]}, ${m.gradient[1]})` }}><Users size={20} /></span>
                  <span>{g.name}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
      <h4 className="mini-title pad-x">Découvrir</h4>
      <div className="group-list">
        {list.length === 0 && <Empty icon={<Users size={28} />} title="Aucun groupe" text="Essayez une autre recherche." />}
        {list.map((g, i) => {
          const m = GROUP_META[g.category];
          const isIn = joined.includes(g.id);
          return (
            <motion.div key={g.id} className="group-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} onClick={() => push({ kind: 'group', id: g.id })}>
              <Cover gradient={m.gradient} icon={m.icon} seed={i + 3} height={96} rounded={18}>
                <span className="cover-badge">{m.label}</span>
              </Cover>
              <div className="gc-body">
                <b>{g.name}</b>
                <p>{g.description}</p>
                <div className="gc-foot">
                  <span className="members"><span className="stack">{memberNames(g).slice(0, 3).map((n) => <Avatar key={n} name={n} size={22} />)}</span>{membersLabel(g.members + (isIn ? 1 : 0))}</span>
                  <JoinButton id={g.id} />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function JoinButton({ id, big }: { id: string; big?: boolean }) {
  const joined = useApp((s) => s.joined.includes(id));
  const toggle = useApp((s) => s.toggleJoin);
  const toast = useUI((s) => s.showToast);
  return (
    <motion.button
      whileTap={{ scale: 0.94 }}
      className={`btn ${joined ? 'btn-soft' : 'btn-primary'} ${big ? 'big' : 'small'}`}
      onClick={(e) => { e.stopPropagation(); toggle(id); toast(joined ? 'Vous avez quitté le groupe' : 'Bienvenue dans le groupe !', joined ? '👋' : '🎉'); }}
    >
      {joined ? <><Check size={15} /> Membre</> : 'Rejoindre'}
    </motion.button>
  );
}

export function GroupDetailPage({ id }: { id: string }) {
  const g = useGroups().find((x) => x.id === id);
  if (!g) return null;
  return <GroupDetail g={g} />;
}

function GroupDetail({ g }: { g: Group }) {
  const id = g.id;
  const pop = useUI((s) => s.popOverlay);
  const joined = useApp((s) => s.joined.includes(id));
  const toggle = useApp((s) => s.toggleJoin);
  const extra = useApp((s) => s.groupMessages[id]);
  const send = useApp((s) => s.sendGroupMessage);
  const [tab, setTab] = useState<'apropos' | 'activites' | 'discussion'>('apropos');
  const m = GROUP_META[g.category];
  const messages = [...g.messages, ...(extra ?? [])];
  return (
    <FullPage onBack={pop} transparentHeader className="group-detail" right={joined ? <button className="icon-btn glass-btn" onClick={() => toggle(id)} title="Quitter"><LogOut size={18} /></button> : undefined}>
      <Cover gradient={m.gradient} icon={m.icon} seed={4} height={220} rounded={0}>
        <div className="ed-cover-info">
          <span className="cover-badge">{m.label}</span>
          <h1>{g.name}</h1>
          <small className="cover-sub"><Users size={14} /> {membersLabel(g.members + (joined ? 1 : 0))} · Admin : {g.admins.join(', ')}</small>
        </div>
      </Cover>
      <div className="ed-body">
        <div className="gd-join"><JoinButton id={id} big /></div>
        <Segmented value={tab} onChange={setTab} options={[{ value: 'apropos', label: 'À propos' }, { value: 'activites', label: 'Activités', badge: g.activities.length }, { value: 'discussion', label: 'Discussion', badge: messages.length }]} />
        {tab === 'apropos' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="detail-text">{g.description}</p>
            <div className="tags">{g.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div>
            <h4 className="mini-title">Membres</h4>
            <div className="member-grid">
              {memberNames(g).slice(0, 8).map((n, i) => (
                <div key={n} className="member"><Avatar name={n} size={44} /><small>{n}</small>{i < g.admins.length && <em>Admin</em>}</div>
              ))}
            </div>
          </motion.div>
        )}
        {tab === 'activites' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="activities">
            {g.activities.length === 0 && <Empty icon={<CalendarDays size={28} />} title="Aucune activité" text="Les activités du groupe apparaîtront ici." />}
            {g.activities.map((a) => (
              <div key={a.id} className="activity">
                <span className="act-icon" style={{ background: m.color }}><CalendarDays size={18} /></span>
                <div><b>{a.title}</b><small>{a.when}</small><small><MapPin size={11} /> {a.where}</small></div>
              </div>
            ))}
          </motion.div>
        )}
        {tab === 'discussion' && (
          <Discussion
            messages={messages}
            locked={!joined}
            onSend={(text) => send(id, { id: `gm-${Date.now()}`, author: 'Moi', text, time: new Date().toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' }), me: true })}
          />
        )}
      </div>
    </FullPage>
  );
}

export function Discussion({ messages, onSend, locked, placeholder = 'Écrire un message…' }: { messages: ChatMessage[]; onSend: (t: string) => void; locked?: boolean; placeholder?: string }) {
  const [text, setText] = useState('');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages.length]);
  return (
    <div className="discussion">
      <div className="messages">
        {messages.map((msg) => (
          <motion.div key={msg.id} className={`msg ${msg.me ? 'me' : ''}`} initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
            {!msg.me && <Avatar name={msg.author} size={30} />}
            <div className="bubble">
              {!msg.me && <b>{msg.author}</b>}
              <p>{msg.text}</p>
              <small>{msg.time}</small>
            </div>
          </motion.div>
        ))}
        <div ref={end} />
      </div>
      {locked ? (
        <div className="locked"><Lock size={16} /> Rejoignez le groupe pour participer à la discussion</div>
      ) : (
        <form className="composer" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { onSend(text.trim()); setText(''); } }}>
          <MessageCircle size={18} className="composer-icon" />
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />
          <button type="submit" disabled={!text.trim()}><Send size={17} /></button>
        </form>
      )}
    </div>
  );
}

/** Membres affichés : groupes de démonstration (membres fictifs) ou groupe créé ici (vous seul au départ) */
function memberNames(g: Group) {
  return g.userCreated ? g.admins : [...g.admins, 'Sophie L.', 'Marc-André', 'Yasmine K.', 'Pierre-Luc', 'Aïcha D.', 'Thomas'];
}

function CreateGroupModal({ onClose }: { onClose: () => void }) {
  const create = useApp((s) => s.createGroup);
  const push = useUI((s) => s.pushOverlay);
  const toast = useUI((s) => s.showToast);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<GroupCategory>('sorties');
  const [desc, setDesc] = useState('');
  const [tags, setTags] = useState('');
  const valid = name.trim().length >= 3 && desc.trim().length >= 5;
  const submit = () => {
    const g: Group = {
      id: `ug-${Date.now()}`, name: name.trim(), category, description: desc.trim(), members: 0, admins: ['Vous'],
      activities: [], messages: [], tags: tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 5), userCreated: true,
    };
    create(g);
    onClose();
    toast('Groupe créé, vous en êtes l’administrateur', '🎉');
    push({ kind: 'group', id: g.id });
  };
  return (
    <Modal title="Créer un groupe" onClose={onClose} footer={<button className="btn btn-primary full big" disabled={!valid} onClick={submit}>Créer le groupe</button>}>
      <Field label="Nom du groupe"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. : Club de lecture Saint-Roch" maxLength={60} /></Field>
      <Field label="Catégorie">
        <div className="chips-wrap">
          {(Object.keys(GROUP_META) as GroupCategory[]).map((c) => <Chip key={c} active={category === c} color={GROUP_META[c].color} onClick={() => setCategory(c)}>{GROUP_META[c].label}</Chip>)}
        </div>
      </Field>
      <Field label="Description"><textarea rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Qui peut rejoindre, ce que vous ferez ensemble…" /></Field>
      <Field label="Mots-clés" hint="Facultatif, séparés par des virgules"><input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Lecture, Café, Soirées" /></Field>
    </Modal>
  );
}

const membersLabel = (n: number) => `${n} membre${n > 1 ? 's' : ''}`;
