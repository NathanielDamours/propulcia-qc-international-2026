import { motion } from 'framer-motion';
import { Building2, ChevronRight, Home, Landmark, MapPin } from 'lucide-react';
import { Profile, useApp, useUI } from '../lib/store';
import { ReactNode } from 'react';

export const PROFILES: { id: Profile; title: string; text: string; icon: ReactNode; g: [string, string] }[] = [
  { id: 'citoyen', title: 'Citoyen', text: 'Se déplacer, participer et améliorer son quartier', icon: <Home size={24} />, g: ['#4F7CFF', '#6A5BFF'] },
  { id: 'entreprise', title: 'Entreprise / commerçant', text: 'Collaborer, publier et rejoindre la clientèle', icon: <Building2 size={24} />, g: ['#10B981', '#06B6D4'] },
  { id: 'ville', title: 'Ville / Administration', text: 'Suivre les signalements et la vitalité du quartier', icon: <Landmark size={24} />, g: ['#F59E0B', '#F97316'] },
];

export function ProfilePicker() {
  const setProfile = useApp((s) => s.setProfile);
  const setTab = useUI((s) => s.setTab);
  return (
    <motion.div className="picker" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.04, transition: { duration: 0.35 } }}>
      <div className="picker-bg">
        <svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="pk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#5B7CFF" /><stop offset="1" stopColor="#B05BFF" /></linearGradient>
          </defs>
          {[...Array(12)].map((_, i) => (
            <line key={`h${i}`} x1="-50" y1={i * 40} x2="450" y2={i * 40 - 180} stroke="url(#pk)" strokeOpacity="0.16" strokeWidth={i % 4 === 0 ? 5 : 1.5} />
          ))}
          {[...Array(12)].map((_, i) => (
            <line key={`v${i}`} x1={i * 45 - 60} y1="-40" x2={i * 45 + 120} y2="440" stroke="url(#pk)" strokeOpacity="0.12" strokeWidth={i % 3 === 0 ? 4 : 1.2} />
          ))}
        </svg>
        <div className="picker-glow g1" />
        <div className="picker-glow g2" />
      </div>
      <div className="picker-content">
        <motion.div className="brand" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
          <div className="brand-logo"><MapPin size={26} strokeWidth={2.4} /></div>
          <div>
            <h1>Notre Saint-Roch</h1>
            <p>Le quartier vivant, dans votre poche</p>
          </div>
        </motion.div>
        <motion.h2 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.18 }}>Qui êtes-vous ?</motion.h2>
        <motion.p className="picker-sub" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.22 }}>
          Choisissez votre profil pour personnaliser la carte et les outils. Vous pourrez le changer en tout temps.
        </motion.p>
        <div className="profile-list">
          {PROFILES.map((p, i) => (
            <motion.button
              key={p.id}
              className="profile-card"
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.28 + i * 0.07, type: 'spring', stiffness: 300, damping: 26 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => { setTab('carte'); setProfile(p.id); }}
            >
              <span className="profile-icon" style={{ background: `linear-gradient(135deg, ${p.g[0]}, ${p.g[1]})` }}>{p.icon}</span>
              <span className="profile-text">
                <b>{p.title}</b>
                <small>{p.text}</small>
              </span>
              <ChevronRight size={20} className="profile-chev" />
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
