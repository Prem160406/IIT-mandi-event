import {useMemo} from 'react';
import {useStore} from '../store/useStore';
import type {FeatureDef, Primitive} from '../types';

function Field({f}: {f: FeatureDef}) {
  const value = useStore((s) => s.input[f.name]);
  const setField = useStore((s) => s.setField);
  const id = `f-${f.name.replace(/\W+/g, '_')}`;
  const cats = f.categories;
  const isChoice = f.type !== 'continuous' && cats && cats.length > 0;
  const label = f.unit ? `${f.name} (${f.unit})` : f.name;

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {isChoice ? (
        <select
          id={id}
          value={value === undefined ? '' : String(value)}
          onChange={(e) => {
            const hit = cats!.find((c) => String(c) === e.target.value);
            setField(f.name, hit as Primitive | undefined);
          }}
        >
          <option value="">not provided</option>
          {cats!.map((c) => <option key={String(c)} value={String(c)}>{String(c)}</option>)}
        </select>
      ) : (
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step="any"
          placeholder="not provided"
          min={f.input_range?.[0]}
          max={f.input_range?.[1]}
          value={value === undefined ? '' : String(value)}
          onChange={(e) => setField(f.name, e.target.value === '' ? undefined : Number(e.target.value))}
        />
      )}
    </div>
  );
}

export function InputForm() {
  const features = useStore((s) => s.features);
  const samples = useStore((s) => s.samples);
  const input = useStore((s) => s.input);
  const status = useStore((s) => s.status);
  const live = useStore((s) => s.settings.live);
  const loadSample = useStore((s) => s.loadSample);
  const resetForm = useStore((s) => s.resetForm);
  const predict = useStore((s) => s.predict);
  const setSetting = useStore((s) => s.setSetting);

  const groups = useMemo(() => {
    const m = new Map<string, FeatureDef[]>();
    features.forEach((f) => m.set(f.group, [...(m.get(f.group) ?? []), f]));
    return [...m.entries()];
  }, [features]);

  const filled = Object.keys(input).length;

  return (
    <section className="box form" aria-label="Patient input">
      <div className="boxhead">
        <h2>Patient input</h2>
        <span className="note">{filled} of {features.length} fields filled</span>
      </div>
      <div className="row">
        <label htmlFor="sample" className="sr">Sample patient</label>
        <select id="sample" defaultValue="" onChange={(e) => { if (e.target.value) loadSample(e.target.value); e.target.value = ''; }}>
          <option value="">Load a sample patient…</option>
          {samples.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>
      <div className="row">
        <button type="button" className="btn primary" onClick={() => void predict()} disabled={status === 'loading'}>
          {status === 'loading' ? 'Predicting…' : 'Predict'}
        </button>
        <button type="button" className="btn" onClick={resetForm}>Reset</button>
        <label className="live"><input type="checkbox" checked={live} onChange={(e) => setSetting('live', e.target.checked)} /> Live mode</label>
      </div>
      <p className="note">Leave a field empty if it is unknown. The model fills gaps with typical values, so fewer fields means a less reliable result.</p>
      <div className="groups">
        {groups.map(([g, fs], i) => (
          <details key={g} open={i === 0}>
            <summary>{g} <span className="note">({fs.filter((f) => input[f.name] !== undefined).length}/{fs.length})</span></summary>
            <div className="fields">{fs.map((f) => <Field key={f.name} f={f} />)}</div>
          </details>
        ))}
      </div>
    </section>
  );
}
