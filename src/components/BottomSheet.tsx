import { ReactNode, useEffect, useRef, useState } from 'react';
import { motion, useAnimation, PanInfo, useDragControls } from 'framer-motion';

/**
 * Panneau coulissant (bottom sheet) à trois positions : aperçu, mi-hauteur, plein écran.
 * Les positions sont exprimées en pixels visibles au-dessus de la barre de navigation.
 */
export type Snap = 'peek' | 'half' | 'full';

interface Props {
  children: ReactNode;
  header?: ReactNode;
  snap?: Snap;
  onSnapChange?: (s: Snap) => void;
  peek?: number;
  half?: number;
  sheetKey?: string;
  bottomOffset?: number;
}

export function BottomSheet({ children, header, snap = 'half', onSnapChange, peek = 150, half = 0.48, sheetKey, bottomOffset = 0 }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(700);
  const controls = useAnimation();
  const drag = useDragControls();
  const [current, setCurrent] = useState<Snap>(snap);
  const grabRef = useRef<HTMLDivElement>(null);
  const [grabH, setGrabH] = useState(28);
  useEffect(() => {
    if (!grabRef.current) return;
    const ro = new ResizeObserver(() => setGrabH(grabRef.current?.offsetHeight ?? 28));
    ro.observe(grabRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = container.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(() => setH(el.clientHeight));
    ro.observe(el);
    setH(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const fullH = h - 64 - bottomOffset;
  const heights: Record<Snap, number> = { peek, half: Math.round((h - bottomOffset) * half), full: fullH };
  const yFor = (s: Snap) => fullH - heights[s];

  useEffect(() => { setCurrent(snap); }, [snap, sheetKey]);
  useEffect(() => {
    controls.start({ y: yFor(current), transition: { type: 'spring', stiffness: 380, damping: 38, mass: 0.9 } });
    onSnapChange?.(current);
  }, [current, h]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const y = yFor(current) + info.offset.y;
    const v = info.velocity.y;
    const order: Snap[] = ['full', 'half', 'peek'];
    let target: Snap;
    if (Math.abs(v) > 600) {
      const idx = order.indexOf(current);
      target = v > 0 ? order[Math.min(2, idx + 1)] : order[Math.max(0, idx - 1)];
    } else {
      target = order.reduce((best, s) => (Math.abs(yFor(s) - y) < Math.abs(yFor(best) - y) ? s : best), 'half' as Snap);
    }
    setCurrent(target);
    controls.start({ y: yFor(target), transition: { type: 'spring', stiffness: 380, damping: 38 } });
  };

  return (
    <motion.div
      ref={container}
      className={`sheet snap-${current}`}
      style={{ height: fullH, bottom: bottomOffset }}
      initial={{ y: fullH }}
      animate={controls}
      exit={{ y: fullH, transition: { duration: 0.25 } }}
      drag="y"
      dragListener={false}
      dragControls={drag}
      dragConstraints={{ top: 0, bottom: yFor('peek') }}
      dragElastic={0.08}
      onDragEnd={onDragEnd}
    >
      <div ref={grabRef} className="sheet-grab" onPointerDown={(e) => drag.start(e)} onDoubleClick={() => setCurrent(current === 'full' ? 'half' : 'full')}>
        <div className="sheet-handle" />
        {header}
      </div>
      <div className="sheet-body" style={{ height: Math.max(60, heights[current] - grabH) }} onPointerDownCapture={(e) => { if (current === 'peek') { const t = e.target as HTMLElement; if (!t.closest('button, input, a, select, textarea')) setCurrent('half'); } }}>
        {children}
      </div>
    </motion.div>
  );
}
