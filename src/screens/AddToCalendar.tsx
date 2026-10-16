import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { CalendarPlus, Download, ExternalLink } from 'lucide-react';
import type { AppEvent } from '../data/events';
import { downloadICS, googleCalendarUrl } from '../lib/calendar';
import { formatEventWhen } from '../lib/selectors';
import { Modal } from '../components/ui';
import { useUI } from '../lib/store';

/** Bouton « Ajouter à mon calendrier » : fichier .ics (calendrier du téléphone) ou Google Agenda. */
export function AddToCalendar({ event, render }: { event: AppEvent; render?: (open: () => void) => JSX.Element }) {
  const [open, setOpen] = useState(false);
  const toast = useUI((s) => s.showToast);
  return (
    <>
      {render ? render(() => setOpen(true)) : (
        <button className="btn btn-soft full cal-btn" onClick={() => setOpen(true)}><CalendarPlus size={18} /> Ajouter à mon calendrier</button>
      )}
      <AnimatePresence>
        {open && (
          <Modal title="Ajouter à mon calendrier" onClose={() => setOpen(false)}>
            <div className="cal-summary">
              <b>{event.title}</b>
              <small>{formatEventWhen(event)} · {event.venue}</small>
            </div>
            <button className="cal-option" onClick={() => { downloadICS(event); setOpen(false); toast('Fichier de calendrier téléchargé', '📅'); }}>
              <span className="cal-icon"><Download size={20} /></span>
              <span><b>Calendrier du téléphone</b><small>iPhone, Android, Outlook… (fichier .ics, rappel 1 h avant)</small></span>
            </button>
            <a className="cal-option" href={googleCalendarUrl(event)} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>
              <span className="cal-icon google"><ExternalLink size={20} /></span>
              <span><b>Google Agenda</b><small>Ouvre Google Agenda avec l’événement prérempli</small></span>
            </a>
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}
