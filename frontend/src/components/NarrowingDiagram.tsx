import {useState} from 'react';

// Longitudinal section of an artery. Plaque on both walls narrows the lumen by n%.
export function NarrowingDiagram() {
  const [n, setN] = useState(60);
  const h = (35 * n) / 100; // plaque thickness per side at the centre (lumen is 70 tall)
  const lumen = 70 * (1 - n / 100);
  return (
    <div className="diagram">
      <svg viewBox="0 0 400 150" role="img" aria-label={`Artery narrowed by ${n} percent`}>
        <rect x="8" y="28" width="384" height="94" rx="14" className="d-wall" />
        <rect x="8" y="40" width="384" height="70" className="d-lumen" />
        <path d={`M110 40 Q200 ${40 + 2 * h} 290 40 Z`} className="d-plaque" />
        <path d={`M110 110 Q200 ${110 - 2 * h} 290 110 Z`} className="d-plaque" />
        <line x1="18" y1="75" x2="382" y2="75" className="d-flow" style={{strokeWidth: Math.max(2, lumen * 0.55)}} />
        <text x="14" y="18" className="d-t">Blood flow</text>
        <text x="200" y="144" textAnchor="middle" className="d-t">Plaque narrows the lumen</text>
      </svg>
      <label className="dslide">
        <span>Narrowing <b>{n}%</b> · open lumen <b>{100 - n}%</b></span>
        <input type="range" min={0} max={90} value={n} onChange={(e) => setN(Number(e.target.value))} aria-label="Artery narrowing" />
      </label>
      <p className={`dflag${n >= 50 ? ' sig' : ''}`}>{n >= 50 ? 'Counted as significant stenosis in this dataset (50% or more).' : 'Below the 50% level used in this dataset.'}</p>
    </div>
  );
}
