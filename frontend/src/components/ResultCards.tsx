import arteryConfig from '@config/arteries.json';
import {useStore} from '../store/useStore';
import type {ArteryConfig, Target, VesselPrediction} from '../types';
import {formatProb, riskColor} from '../lib/colorScale';

const CONFIG = arteryConfig as ArteryConfig;

function Card({target, title, sub, v}: {target: Target; title: string; sub: string; v: VesselPrediction | null}) {
  const selected = useStore((s) => s.selectedTarget === target);
  const hovered = useStore((s) => s.hoveredTarget === target);
  const select = useStore((s) => s.select);
  const colorBlind = useStore((s) => s.settings.colorBlind);
  const p = v?.probability ?? null;
  const level = v?.risk_level ?? 'none';
  const color = riskColor(p, colorBlind);
  return (
    <button
      type="button"
      className={`card${hovered ? ' hot' : ''}`}
      aria-pressed={selected}
      onClick={() => select(selected ? null : target)}
    >
      <span className="key">{title}</span>
      <span className="p">{p == null ? '–' : formatProb(p)}</span>
      <span className={`risk ${level}`}><i />{level === 'none' ? 'No prediction' : `${level} risk`}</span>
      <span className="meter"><span style={{width: `${(p ?? 0) * 100}%`, background: color}} /></span>
      <small>{sub}</small>
    </button>
  );
}

export function ResultCards() {
  const prediction = useStore((s) => s.prediction);
  const status = useStore((s) => s.status);
  const error = useStore((s) => s.error);
  const total = useStore((s) => s.features.length);

  const maxVessel = prediction ? Math.max(...Object.values(prediction.vessels).map((v) => v.probability)) : 0;
  const inconsistent = prediction ? prediction.cad.probability < maxVessel - 0.05 : false;

  return (
    <section aria-label="Results" className="box results">
      <div className="boxhead">
        <h2>Assessment</h2>
        <span className="note">{prediction ? `Model ${prediction.model_version}` : 'Run a prediction to see results'}</span>
      </div>
      {status === 'error' && error && <div className="warn" role="alert">{error}</div>}
      <div className="cards4">
        <Card target="CAD" title="Overall CAD" sub={prediction ? prediction.cad.label : 'Not drawn on the heart'} v={prediction?.cad ?? null} />
        {CONFIG.arteries.map((a) => (
          <Card key={a.key} target={a.key as Target} title={a.key} sub={a.label} v={prediction?.vessels[a.key] ?? null} />
        ))}
      </div>
      {prediction && prediction.missing_fields.length > 0 && (
        <p className="note">{prediction.missing_fields.length} of {total} fields were not provided, so this result is less reliable.</p>
      )}
      {inconsistent && (
        <p className="note">The overall CAD probability is lower than the highest vessel probability. The four models are trained separately, so treat the difference as a sign of uncertainty.</p>
      )}
    </section>
  );
}
