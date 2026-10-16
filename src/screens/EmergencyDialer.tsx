import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Delete, Phone } from 'lucide-react';

const KEYS: [string, string][] = [
  ['1', ''], ['2', 'ABC'], ['3', 'DEF'],
  ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'],
  ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'],
  ['*', ''], ['0', '+'], ['#', ''],
];

/** Clavier téléphonique (style iPhone) avec le 911 déjà composé. Le bouton vert lance l'appel. */
export function EmergencyDialer({ onClose }: { onClose: () => void }) {
  const [number, setNumber] = useState('911');
  const root = document.querySelector('.device-screen') ?? document.body;
  return createPortal(
    <motion.div className="dialer" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }} transition={{ type: 'spring', stiffness: 380, damping: 36 }}>
      <button className="dialer-cancel" onClick={onClose}>Annuler</button>
      <div className="dialer-number">
        <span>{number}</span>
        {number === '911' && <small>Urgence</small>}
      </div>
      <div className="dialer-keys">
        {KEYS.map(([d, l]) => (
          <motion.button key={d} className="dialer-key" whileTap={{ scale: 0.92, backgroundColor: '#C7C7CC' }} onClick={() => setNumber((n) => (n + d).slice(0, 15))}>
            <b>{d}</b>
            {l && <small>{l}</small>}
          </motion.button>
        ))}
        <span />
        <motion.a className={`dialer-call ${number ? '' : 'off'}`} href={number ? `tel:${number}` : undefined} whileTap={{ scale: 0.92 }} aria-label={`Appeler le ${number}`}>
          <Phone size={30} fill="currentColor" strokeWidth={0} />
        </motion.a>
        <button className="dialer-del" onClick={() => setNumber((n) => n.slice(0, -1))} aria-label="Effacer" style={{ visibility: number ? 'visible' : 'hidden' }}>
          <Delete size={26} />
        </button>
      </div>
    </motion.div>,
    root,
  );
}
