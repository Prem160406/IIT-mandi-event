import {useStore} from '../store/useStore';
import {ANATOMY} from '../lib/anatomy';
import type {ExplanationItem} from '../types';

const fmt = (x: number) => (x > 0 ? '+' : '') + x.toFixed(2);

function sentence(items: ExplanationItem[]): string {
  const up = items.filter((i) => i.direction === 'raises_risk').slice(0, 3).map((i) => i.feature);
  const down = items.filter((i) => i.direction === 'lowers_risk').slice(0, 2).map((i) => i.feature);
  const join = (a: string[]) => (a.length > 1 ? `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}` : a[0]);
  const parts: string[] = [];
  if (up.length) parts.push(`raised mainly by ${join(up)}`);
  if (down.length) parts.push(`lowered by ${join(down)}`);
  return parts.length ? `Risk is ${parts.join(' and ')}.` : 'No single feature stands out.';
}

export function Explanation() {
  const prediction = useStore((s) => s.prediction);
  const target = useStore((s) => s.selectedTarget) ?? 'CAD';
  const select = useStore((s) => s.select);

  const tabs = (
    <div className="chips" role="group" aria-label="Target">
      {(['CAD', 'LAD', 'LCX', 'RCA'] as const).map((t) => (
        <button key={t} type="button" className="btn" aria-pressed={target === t} onClick={() => select(t)}>{t}</button>
      ))}
    </div>
  );

  if (!prediction) return <div>{tabs}<p className="note">Run a prediction to see why the model gave its answer.</p></div>;

  const items = prediction.explanations[target] ?? [];
  const max = Math.max(0.01, ...items.map((i) => Math.abs(i.log_odds)));
  const groups = Object.entries(prediction.group_contributions[target] ?? {});
  const gmax = Math.max(0.01, ...groups.map(([, v]) => Math.abs(v)));

  return (
    <div className="expl">
      {tabs}
      <p><b>{target === 'CAD' ? 'Overall CAD' : target}</b>. {ANATOMY[target]}</p>
      <p className="lead">{sentence(items)}</p>

      <div className="twocol">
        <div>
          <h3>Top features</h3>
          <ul className="bars" aria-label="Top feature contributions">
            {items.map((i) => (
              <li key={i.feature}>
                <span className="name">{i.feature}<small> = {i.value ?? 'n/a'}</small></span>
                <span className="track"><span className={`fill ${i.log_odds >= 0 ? 'up' : 'down'}`} style={{width: `${(Math.abs(i.log_odds) / max) * 100}%`}} /></span>
                <span className="num">{fmt(i.log_odds)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>By category</h3>
          <ul className="bars" aria-label="Contribution by category">
            {groups.map(([g, v]) => (
              <li key={g}>
                <span className="name">{g}</span>
                <span className="track"><span className={`fill ${v >= 0 ? 'up' : 'down'}`} style={{width: `${(Math.abs(v) / gmax) * 100}%`}} /></span>
                <span className="num">{fmt(v)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="note">Bars show each feature's exact additive contribution to the model score (log-odds). Red raises the predicted risk and blue lowers it. This describes model behaviour, not a medical cause.</p>
    </div>
  );
}
