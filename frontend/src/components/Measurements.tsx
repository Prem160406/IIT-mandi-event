import {useStore} from '../store/useStore';

export function Measurements() {
  const features = useStore((s) => s.features);
  const input = useStore((s) => s.input);
  const prediction = useStore((s) => s.prediction);
  const target = useStore((s) => s.selectedTarget) ?? 'CAD';
  const contrib = new Map((prediction?.explanations[target] ?? []).map((i) => [i.feature, i]));
  const rows = features.filter((f) => input[f.name] !== undefined);

  if (rows.length === 0) return <p className="note">No values entered yet. Fill the form or load a sample patient.</p>;
  return (
    <div>
      <p className="note">Entered values for <b>{target}</b>. The contribution is shown for the eight strongest features only. Reference ranges are not shown because they are not yet configured in config/features.yaml.</p>
      <div className="scroll">
        <table>
          <thead><tr><th>Feature</th><th>Group</th><th className="r">Value</th><th className="r">Contribution</th></tr></thead>
          <tbody>
            {rows.map((f) => {
              const c = contrib.get(f.name);
              return (
                <tr key={f.name}>
                  <td>{f.name}</td><td>{f.group}</td>
                  <td className="r mono">{String(input[f.name])}{f.unit ? ` ${f.unit}` : ''}</td>
                  <td className={`r mono ${c ? (c.log_odds >= 0 ? 'up' : 'down') : ''}`}>{c ? `${c.log_odds > 0 ? '+' : ''}${c.log_odds.toFixed(2)}` : '–'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
