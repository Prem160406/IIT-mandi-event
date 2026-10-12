import {useEffect, useRef} from 'react';
import {NOTICE} from '../lib/brand';
import {HeartShape} from './Heartbeat';

export function DisclaimerModal({open, onClose}: {open: boolean; onClose: () => void}) {
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (open) btn.current?.focus(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-back" role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="notice-title">
        <HeartShape className="modal-heart" />
        <h2 id="notice-title">Before you begin</h2>
        <p>{NOTICE}</p>
        <button ref={btn} type="button" className="btn primary" onClick={onClose}>Got it</button>
      </div>
    </div>
  );
}
