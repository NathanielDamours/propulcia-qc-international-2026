import { ReactNode, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Star, X } from 'lucide-react';
import { Icon } from './Icon';
import { useUI } from '../lib/store';

/* Visuel de couverture généré (aucune image externe nécessaire) */
export function Cover({ gradient, icon, seed = 0, height = 140, children, rounded = 20 }: { gradient: [string, string]; icon: string; seed?: number; height?: number; children?: ReactNode; rounded?: number }) {
  const shapes = [0, 1, 2, 3].map((i) => {
    const s = (seed * 7 + i * 13) % 17;
    return { x: (s * 37) % 100, y: (s * 53) % 100, r: 30 + ((s * 11) % 50), o: 0.1 + ((s % 5) * 0.04) };
  });
  return (
    <div className="cover" style={{ height, borderRadius: rounded, background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})` }}>
      <svg className="cover-art" viewBox="0 0 100 100" preserveAspectRatio="none">
        {shapes.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={s.o} />)}
        <path d={`M0 ${70 + (seed % 4) * 4} Q 25 ${55 + (seed % 3) * 6} 50 ${68} T 100 ${60 + (seed % 5) * 3} V100 H0 Z`} fill="#000" opacity="0.12" />
      </svg>
      <div className="cover-icon"><Icon name={icon} size={height > 160 ? 64 : 44} strokeWidth={1.6} /></div>
      {children}
    </div>
  );
}

export function Chip({ active, onClick, children, color, icon }: { active?: boolean; onClick?: () => void; children: ReactNode; color?: string; icon?: ReactNode }) {
  return (
    <button className={`chip ${active ? 'active' : ''}`} onClick={onClick} style={active && color ? { background: color, borderColor: color } : undefined}>
      {icon}
      {children}
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string; badge?: number }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {value === o.value && <motion.span layoutId={`seg-${options.map((x) => x.value).join()}`} className="seg-pill" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
          <span className="seg-label">{o.label}{o.badge ? <em>{o.badge}</em> : null}</span>
        </button>
      ))}
    </div>
  );
}

export function Stars({ value, size = 14, onChange }: { value: number; size?: number; onChange?: (v: number) => void }) {
  return (
    <span className={`stars ${onChange ? 'interactive' : ''}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} onClick={onChange ? () => onChange(i) : undefined} fill={i <= Math.round(value) ? 'currentColor' : 'none'} strokeWidth={1.8} />
      ))}
    </span>
  );
}

export function Avatar({ name, color, size = 36 }: { name: string; color?: string; size?: number }) {
  const initials = name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38, background: color ?? `linear-gradient(135deg, hsl(${hue} 80% 62%), hsl(${(hue + 40) % 360} 75% 52%))` }}>
      {initials}
    </span>
  );
}

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h4>{title}</h4>
      <p>{text}</p>
      {action}
    </div>
  );
}

/* Page plein écran qui glisse depuis la droite (pile d'écrans) */
export function FullPage({ title, onBack, children, right, transparentHeader, className = '' }: { title?: ReactNode; onBack?: () => void; children: ReactNode; right?: ReactNode; transparentHeader?: boolean; className?: string }) {
  return (
    <motion.div className={`fullpage ${className}`} initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 420, damping: 42 }}>
      <div className={`fp-header ${transparentHeader ? 'transparent' : ''}`}>
        {onBack ? <button className="icon-btn" onClick={onBack} aria-label="Retour"><ChevronLeft size={22} /></button> : <span style={{ width: 40 }} />}
        <div className="fp-title">{title}</div>
        <div className="fp-right">{right ?? <span style={{ width: 40 }} />}</div>
      </div>
      <div className="fp-body">{children}</div>
    </motion.div>
  );
}

/* Modale bas d'écran (formulaires) */
export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="modal" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 380, damping: 38 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="sheet-handle" />
          <div className="modal-title-row">
            <h3>{title}</h3>
            <button className="icon-btn ghost" onClick={onClose} aria-label="Fermer"><X size={20} /></button>
          </div>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </motion.div>
    </motion.div>
  );
}

export function Toast() {
  const toast = useUI((s) => s.toast);
  const show = useUI((s) => s.showToast);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => useUI.setState({ toast: null }), 2600);
    return () => clearTimeout(t);
  }, [toast, show]);
  return (
    <AnimatePresence>
      {toast && (
        <motion.div key={toast.t} className="toast" initial={{ y: -40, opacity: 0, scale: 0.95 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -30, opacity: 0 }}>
          {toast.icon && <span className="toast-icon">{toast.icon}</span>}
          {toast.text}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="section-title">
      <h3>{children}</h3>
      {action}
    </div>
  );
}
