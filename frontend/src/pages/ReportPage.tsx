import {Fragment, useMemo, useRef, useState} from 'react';
import {useStore} from '../store/useStore';
import {APP_NAME} from '../lib/brand';
import {DISCLAIMER} from '../lib/anatomy';
import {formatProb} from '../lib/colorScale';
import {INPUT_NAMES, buildSpecs, valueText, type InputSpec} from '../lib/inputs';
import {PageHead} from '../components/PageHead';
import {PhysiologicalBreakdown} from '../components/PhysiologicalBreakdown';

const ROWS = [
  ['CAD', 'Overall coronary artery disease', 'Overall result (not drawn on the heart)'],
  ['LAD', 'Left anterior descending', 'Front of the heart'],
  ['LCX', 'Left circumflex', 'Side and back of the heart'],
  ['RCA', 'Right coronary artery', 'Right side and bottom of the heart'],
] as const;
const BADGE: Record<string, [string, string]> = {low: ['#1b7f46', '#dff5e8'], moderate: ['#a16207', '#fdf0cf'], high: ['#b91c1c', '#fde3e3']};
const two = (n: number) => String(n).padStart(2, '0');
const DOC_CSS = 'body{font-family:Calibri,Arial,sans-serif;font-size:10.5pt;color:#111}table{border-collapse:collapse;width:100%}td,th{border:1px solid #b9cfc6;padding:4px 7px;text-align:left;vertical-align:top}th{background:#e3f3ec}h1{font-size:18pt;color:#0b4d3d;margin:0}h2{font-size:12pt;color:#0b4d3d;margin:14px 0 4px}.meta{color:#555;font-size:9pt}.disc{font-size:9pt;color:#555;border-top:1px solid #b9cfc6;padding-top:6px}';

function Pairs({specs, input}: {specs: InputSpec[]; input: Record<string, string | number>}) {
  const rows: InputSpec[][] = [];
  for (let i = 0; i < specs.length; i += 2) rows.push(specs.slice(i, i + 2));
  return (
    <table className="rp-pairs">
      <tbody>
        {rows.map((r) => (
          <tr key={r[0].name}>
            {r.map((s) => <Fragment key={s.name}><th>{s.full && s.label !== s.full ? `${s.label} · ${s.full}` : s.label}</th><td>{valueText(s, input[s.name])}</td></Fragment>)}
            {r.length === 1 && <><th /><td /></>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ReportPage() {
  const input = useStore((s) => s.input);
  const prediction = useStore((s) => s.prediction);
  const features = useStore((s) => s.features);
  const sheet = useRef<HTMLDivElement>(null);
  const [ask, setAsk] = useState(false);
  const started = useMemo(() => new Date(), []);
  const now = new Date();
  const rid = `AL-${started.getFullYear()}${two(started.getMonth() + 1)}${two(started.getDate())}-${two(started.getHours())}${two(started.getMinutes())}${two(started.getSeconds())}`;
  const date = now.toLocaleDateString(undefined, {day: '2-digit', month: 'long', year: 'numeric'});
  const time = now.toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit', second: '2-digit'});

  const specs = useMemo(() => buildSpecs(features), [features]);
  const entered = specs.filter((s) => input[s.name] !== undefined);
  const key = entered.filter((s) => INPUT_NAMES.has(s.name));
  const more = entered.filter((s) => !INPUT_NAMES.has(s.name));
  const total = Object.keys(input).length;
  const factors = (prediction?.explanations.CAD ?? []).slice(0, 5);
  const vessels = prediction ? ROWS.slice(1).map(([k]) => [k, prediction.vessels[k]] as const) : [];
  const top = vessels.length ? vessels.reduce((a, b) => (b[1].probability > a[1].probability ? b : a)) : null;
  const attributionMethod = prediction?.explanations.CAD?.[0]?.method;
  const breakdownSection = (factors.length > 0 ? 5 : 4) + (more.length > 0 ? 1 : 0);

  const exportPdf = () => { setAsk(false); window.setTimeout(() => window.print(), 60); };
  const exportDoc = () => {
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${APP_NAME} report</title><style>${DOC_CSS}</style></head><body>${sheet.current?.innerHTML ?? ''}</body></html>`;
    const url = URL.createObjectURL(new Blob(['\ufeff', html], {type: 'application/msword'}));
    const a = document.createElement('a');
    a.href = url; a.download = `${rid}.doc`; a.click();
    URL.revokeObjectURL(url);
    setAsk(false);
  };

  return (
    <section className="page">
      <PageHead title="Risk Report"><button type="button" className="btn cta" onClick={() => setAsk(true)}>Export report</button></PageHead>

      <div className="sheet" ref={sheet}>
        <table className="rp-head"><tbody><tr>
          <td className="rp-brand"><span className="rp-logo">♥</span> <b>{APP_NAME}</b><br /><span className="meta">Coronary artery disease risk assessment</span></td>
          <td className="rp-meta"><b>REPORT {rid}</b><br />Date: {date}<br />Time: {time}</td>
        </tr></tbody></table>
        <h1>Cardiovascular Risk Assessment Report</h1>

        <h2>1. Patient summary</h2>
        {key.length === 0 ? <p>No values entered.</p> : <Pairs specs={key} input={input} />}
        {more.length > 0 && <><h2>2. Additional clinical details</h2><Pairs specs={more} input={input} /></>}

        <h2>{more.length > 0 ? '3' : '2'}. Assessment results</h2>
        {!prediction ? <p>No result yet. Enter patient data to generate results.</p> : (
          <table className="rp-res">
            <thead><tr><th>Target</th><th>Region</th><th>Probability</th><th>Risk band</th></tr></thead>
            <tbody>
              {ROWS.map(([k, name, region]) => {
                const v = k === 'CAD' ? prediction.cad : prediction.vessels[k];
                const [fg, bg] = BADGE[v?.risk_level ?? ''] ?? ['#444', '#eee'];
                return (
                  <tr key={k}>
                    <td><b>{k}</b> · {name}</td><td>{region}</td>
                    <td><b>{v ? formatProb(v.probability) : '–'}</b></td>
                    <td><span className="badge" style={{color: fg, background: bg}}>{v ? v.risk_level.toUpperCase() : '–'}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {prediction && (
          <>
            <h2>{more.length > 0 ? '4' : '3'}. Interpretation</h2>
            <ul>
              <li>Estimated probability of coronary artery disease: <b>{formatProb(prediction.cad.probability)}</b> ({prediction.cad.risk_level} band).</li>
              {top && <li>Highest artery-level estimate: <b>{top[0]}</b> at {formatProb(top[1].probability)} ({top[1].risk_level} band).</li>}
              <li>Based on {total} of 55 model inputs{total < 55 ? '; the rest were filled with typical values, so treat the estimate with caution' : ''}.</li>
            </ul>
            {factors.length > 0 && (
              <>
                <h2>{more.length > 0 ? '5' : '4'}. Main factors for overall CAD</h2>
                <p className="note">Attribution method: {attributionMethod === 'shap.LinearExplainer' ? 'SHAP (LinearExplainer)' : attributionMethod === 'exact_linear_decomposition' ? 'exact linear decomposition (fallback)' : '–'}</p>
                <table className="rp-pairs"><tbody>
                  {factors.map((f) => {
                    const s = specs.find((x) => x.name === f.feature);
                    return <tr key={f.feature}><th>{f.log_odds >= 0 ? '▲ Raises' : '▼ Lowers'}</th><td>{s ? s.label : f.feature}{input[f.feature] === undefined ? ' (typical value used)' : ''}</td><td>{f.log_odds > 0 ? '+' : ''}{f.log_odds.toFixed(2)}</td></tr>;
                  })}
                </tbody></table>
              </>
            )}
            <h2>{breakdownSection}. Physiological group breakdown for overall CAD</h2>
            <PhysiologicalBreakdown contributions={prediction.group_contributions?.CAD} />
          </>
        )}
        <p className="disc"><b>Notice.</b> {DISCLAIMER}</p>
        <p className="meta">Generated by {APP_NAME} · Report {rid} · {date}, {time}</p>
      </div>

      {ask && (
        <div className="modal-back" role="presentation" onClick={() => setAsk(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="exp-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="exp-title">Export report as</h2>
            <div className="row">
              <button type="button" className="btn primary" onClick={exportPdf}>PDF</button>
              <button type="button" className="btn primary" onClick={exportDoc}>Word (.doc)</button>
              <button type="button" className="btn" onClick={() => setAsk(false)}>Cancel</button>
            </div>
            <p className="note">PDF opens the print window. Choose “Save as PDF”.</p>
          </div>
        </div>
      )}
    </section>
  );
}
