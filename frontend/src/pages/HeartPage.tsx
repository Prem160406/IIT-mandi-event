import {useMemo} from 'react';
import arteryConfig from '@config/arteries.json';
import {HeartScene} from '../three/HeartScene';
import {useStore} from '../store/useStore';
import {ANATOMY} from '../lib/anatomy';
import {cssGradient, formatProb, riskColor} from '../lib/colorScale';
import {buildSpecs, valueText} from '../lib/inputs';
import {useCountUp} from '../components/useCountUp';
import {PhysiologicalBreakdown} from '../components/PhysiologicalBreakdown';
import type {ArteryConfig, Target, VesselPrediction} from '../types';

const CONFIG = arteryConfig as ArteryConfig;
const FULL: Record<string, string> = {CAD: 'Overall coronary artery disease'};
CONFIG.arteries.forEach((a) => { FULL[a.key] = a.label; });
const fmt = (x: number) => (x > 0 ? '+' : '') + x.toFixed(2);
const lo = Math.round(CONFIG.riskLevels.low * 100), hi = Math.round(CONFIG.riskLevels.high * 100);

function Percent({p}: {p: number | null}) {
  const v = useCountUp(p);
  return <span className="ap">{p == null ? '–' : formatProb(v)}</span>;
}

function Row({t, v}: {t: Target; v: VesselPrediction | null}) {
  const selected = useStore((s) => s.selectedTarget === t);
  const hovered = useStore((s) => s.hoveredTarget === t);
  const select = useStore((s) => s.select);
  const hover = useStore((s) => s.hover);
  const cb = useStore((s) => s.settings.colorBlind);
  const input = useStore((s) => s.input);
  const features = useStore((s) => s.features);
  const prediction = useStore((s) => s.prediction);
  const specs = useMemo(() => buildSpecs(features), [features]);
  const p = v?.probability ?? null;
  const items = selected ? (prediction?.explanations[t] ?? []).slice(0, 5) : [];
  const col = riskColor(p, cb);

  return (
    <div className={`arow${selected ? ' open' : ''}${hovered ? ' hot' : ''}`} onMouseEnter={() => hover(t)} onMouseLeave={() => hover(null)}>
      <button type="button" className="ahead" aria-expanded={selected} onClick={() => select(selected ? null : t)}>
        <span className={`sw${t === 'CAD' ? ' dashed' : ''}`} style={{background: t === 'CAD' ? 'transparent' : col}} />
        <span className="an"><b>{t}</b><small>{FULL[t]}</small></span>
        <Percent p={p} />
        <span className={`risk ${v?.risk_level ?? 'none'}`}>{v ? v.risk_level : 'none'}</span>
      </button>
      <div className="rbar" aria-hidden="true">
        <i style={{width: `${(p ?? 0) * 100}%`, background: col}} />
        <u style={{left: `${lo}%`}} /><u style={{left: `${hi}%`}} />
      </div>
      {selected && (
        <div className="detail">
          <h3 className="detail-title">Assessment details</h3>
          <p>{ANATOMY[t]}</p>
          {items.length > 0 && (
            <ul className="why">
              {items.map((i) => {
                const s = specs.find((x) => x.name === i.feature);
                const assumed = input[i.feature] === undefined;
                return (
                  <li key={i.feature}>
                    <span className={`dir ${i.log_odds >= 0 ? 'up' : 'down'}`}>{i.log_odds >= 0 ? '▲' : '▼'}</span>
                    <span className="fn">{s ? s.label : i.feature}<small>{i.value == null ? 'n/a' : s ? valueText(s, i.value) : String(i.value)}{assumed ? ' · typical value' : ''}</small></span>
                    <span className="mono">{fmt(i.log_odds)}</span>
                  </li>
                );
              })}
            </ul>
          )}
          {items.length > 0 && <p className="note">▲ raises, ▼ lowers the score. Typical values were not entered.</p>}
          {t !== 'CAD' && <PhysiologicalBreakdown contributions={prediction?.group_contributions?.[t]} />}
        </div>
      )}
    </div>
  );
}

export function HeartPage() {
  const prediction = useStore((s) => s.prediction);
  const status = useStore((s) => s.status);
  const total = useStore((s) => Object.keys(s.input).length);
  const cb = useStore((s) => s.settings.colorBlind);
  const live = status === 'loading' ? 'Updating…' : prediction ? 'Live result' : 'No result yet';

  return (
    <section className="heartpage">
      <HeartScene />
      <aside className="assess">
        <div className="ah"><h2>Assessment</h2><span className={`live${prediction ? ' on' : ''}`}><i />{live}</span></div>
        <div className="rows">
          <Row t="CAD" v={prediction?.cad ?? null} />
          {CONFIG.arteries.map((a) => <Row key={a.key} t={a.key as Target} v={prediction?.vessels[a.key] ?? null} />)}
        </div>
        {!prediction && <p className="note">Enter values on <a href="#/input">Patient Data</a> to colour the arteries.</p>}
        <div className="key">
          <div className="gradbar" style={{background: cssGradient(cb)}} />
          <div className="ticks"><span>0%</span><span>{lo}%</span><span>{hi}%</span><span>100%</span></div>
          <ul className="bands">
            <li><i style={{background: riskColor(0.1, cb)}} />Low · under {lo}%</li>
            <li><i style={{background: riskColor(0.5, cb)}} />Moderate · {lo}–{hi}%</li>
            <li><i style={{background: riskColor(0.9, cb)}} />High · over {hi}%</li>
            <li><i style={{background: riskColor(null, cb)}} />Grey · no result</li>
          </ul>
        </div>
        <p className="note foot2">Based on {total} of 55 inputs. <a href="#/input">Edit data</a></p>
      </aside>
    </section>
  );
}
