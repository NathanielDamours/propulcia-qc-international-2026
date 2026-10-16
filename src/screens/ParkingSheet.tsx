import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { BottomSheet } from '../components/BottomSheet';
import { PARKING_COLOR } from '../data/parkings';
import { useUI } from '../lib/store';
import { dist, formatDist, ME } from '../lib/geo';
import { ParkingDetail } from './Details';
import { Chip } from '../components/ui';
import { useParkings } from '../lib/parkingData';

type Filter = 'interieur' | 'exterieur';

export function ParkingSheet() {
  const parkings = useParkings();
  const selection = useUI((s) => s.selection);
  const select = useUI((s) => s.select);
  const flyTo = useUI((s) => s.flyTo);
  const focus = useUI((s) => s.parkingFocus);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter | null>(null);
  const origin = focus ?? ME;

  const list = useMemo(() => {
    const n = q.toLowerCase();
    return parkings
      .filter((p) => (!n || (p.name + p.address).toLowerCase().includes(n)) && (!filter || (filter === 'interieur') === p.indoor))
      .map((p) => ({ p, d: dist(origin, p.ll) }))
      .sort((a, b) => a.d - b.d);
  }, [q, filter, origin, parkings]);

  const totalCases = parkings.reduce((a, p) => a + p.capacity, 0);

  if (selection?.type === 'parking') {
    return (
      <BottomSheet sheetKey={`pk-${selection.id}`} snap="half" half={0.5}>
        <div className="pad"><ParkingDetail id={selection.id} /></div>
      </BottomSheet>
    );
  }

  const header = (
    <div className="sheet-header">
      <div>
        <h3>Stationnements municipaux</h3>
        <small>{parkings.length} stationnements · {totalCases} cases · {focus ? 'près de votre destination' : 'autour de vous'}</small>
      </div>
      {focus && <button className="chip small" onClick={() => useUI.getState().setParkingFocus(null)}>Autour de moi <X size={12} /></button>}
    </div>
  );

  return (
    <BottomSheet header={header} snap="half" sheetKey="pk-list" half={0.5}>
      <div className="pad">
        <div className="search-input soft">
          <Search size={17} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un stationnement ou une adresse…" />
          {q && <button onClick={() => setQ('')}><X size={15} /></button>}
        </div>
        <div className="chips-scroll">
          <Chip active={!filter} onClick={() => setFilter(null)}>Tous</Chip>
          <Chip active={filter === 'interieur'} onClick={() => setFilter(filter === 'interieur' ? null : 'interieur')}>Intérieur</Chip>
          <Chip active={filter === 'exterieur'} onClick={() => setFilter(filter === 'exterieur' ? null : 'exterieur')}>Extérieur</Chip>
        </div>
        <div className="parking-list">
          {list.map(({ p, d }, i) => (
            <motion.button key={p.id} className="parking-item" onClick={() => { select({ type: 'parking', id: p.id }); flyTo(p.ll, 16.8); }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.03 }}>
              <span className="pi-badge" style={{ background: PARKING_COLOR }}>P</span>
              <span className="pi-main">
                <b>{p.name}</b>
                <small>{p.typeLabel} · {formatDist(d)}</small>
              </span>
              <span className="pi-right">
                <b>{p.capacity || '—'}</b>
                <small>cases</small>
              </span>
            </motion.button>
          ))}
          {list.length === 0 && <p className="disclaimer">Aucun stationnement ne correspond à cette recherche.</p>}
        </div>
        <p className="disclaimer">Source : stationnements municipaux hors rue (Ville de Québec). Le jeu de données ne fournit ni tarifs ni disponibilité.</p>
      </div>
    </BottomSheet>
  );
}
