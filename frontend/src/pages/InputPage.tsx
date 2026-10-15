import {useMemo, useState} from 'react';
import {useStore} from '../store/useStore';
import {PageHead} from '../components/PageHead';
import {INPUTS, INPUT_NAMES, bmiBand, buildSpecs, type InputSpec} from '../lib/inputs';

function Control({s}: {s: InputSpec}) {
  const v = useStore((x) => x.input[s.name]);
  const setField = useStore((x) => x.setField);
  if (s.kind === 'bmi') {
    const b = typeof v === 'number' ? v : undefined;
    return <div className="bmi"><strong>{b === undefined ? '–' : b.toFixed(1)}</strong>{b !== undefined && <span className="tagc">{bmiBand(b)}</span>}<em>auto</em></div>;
  }
  if (s.kind === 'yesno') {
    return (
      <div className="seg" role="group" aria-label={s.label}>
        <button type="button" aria-pressed={v === s.yes} onClick={() => setField(s.name, v === s.yes ? undefined : s.yes)}>Yes</button>
        <button type="button" aria-pressed={v === s.no} onClick={() => setField(s.name, v === s.no ? undefined : s.no)}>No</button>
      </div>
    );
  }
  if (s.kind === 'choice') {
    return (
      <div className="seg" role="group" aria-label={s.label}>
        {(s.choices ?? []).map((c) => (
          <button key={String(c.value)} type="button" aria-pressed={v === c.value} onClick={() => setField(s.name, v === c.value ? undefined : c.value)}>{c.text}</button>
        ))}
      </div>
    );
  }
  const num = typeof v === 'number' ? v : undefined;
  const minVal = s.min ?? 0;
  const maxVal = s.max ?? Infinity;
  const bump = (d: number) => {
    if (num !== undefined) {
      const next = Math.max(minVal, Math.min(maxVal, Math.round((num + d) * 100) / 100));
      setField(s.name, next);
    }
  };

  const handleInput = (valStr: string) => {
    if (valStr === '') {
      setField(s.name, undefined);
      return;
    }
    const cleaned = valStr.replace(/[^0-9.]/g, '');
    if (cleaned === '') {
      setField(s.name, undefined);
      return;
    }
    let n = Number(cleaned);
    if (!isNaN(n)) {
      if (s.max !== undefined && n > s.max) n = s.max;
      setField(s.name, n);
    }
  };

  return (
    <div className="num">
      <button type="button" aria-label={`Decrease ${s.label}`} disabled={num === undefined || num <= minVal} onClick={() => bump(-1)}>−</button>
      <input
        type="number"
        inputMode="decimal"
        step="any"
        min={minVal}
        max={s.max}
        placeholder="–"
        aria-label={s.label}
        value={v === undefined ? '' : String(v)}
        onKeyDown={(e) => {
          if (e.key === '-' || e.key === 'e' || e.key === 'E') {
            e.preventDefault();
          }
        }}
        onChange={(e) => handleInput(e.target.value)}
      />
      <button type="button" aria-label={`Increase ${s.label}`} disabled={num === undefined || (s.max !== undefined && num >= s.max)} onClick={() => bump(1)}>+</button>
      {s.unit && <em>{s.unit}</em>}
    </div>
  );
}

function Group({title, specs}: {title: string; specs: InputSpec[]}) {
  return (
    <div className="box grp">
      <h3>{title}</h3>
      {specs.map((s) => (
        <div className="rowf" key={s.name}>
          <div className="lab"><b>{s.label}</b>{s.full && <span>{s.full}</span>}</div>
          <Control s={s} />
        </div>
      ))}
    </div>
  );
}

function groupBy(specs: InputSpec[]): [string, InputSpec[]][] {
  const m = new Map<string, InputSpec[]>();
  specs.forEach((s) => m.set(s.group, [...(m.get(s.group) ?? []), s]));
  return [...m.entries()];
}

export function InputPage() {
  const input = useStore((x) => x.input);
  const features = useStore((x) => x.features);
  const samples = useStore((x) => x.samples);
  const status = useStore((x) => x.status);
  const prediction = useStore((x) => x.prediction);
  const loadSample = useStore((x) => x.loadSample);
  const resetForm = useStore((x) => x.resetForm);
  const [tab, setTab] = useState<'key' | 'more'>('key');

  const specs = useMemo(() => buildSpecs(features), [features]);
  const keySpecs = INPUTS;
  const moreSpecs = specs.filter((s) => !INPUT_NAMES.has(s.name));
  const keyTyped = keySpecs.filter((s) => s.kind !== 'bmi');
  const nKey = keyTyped.filter((s) => input[s.name] !== undefined).length;
  const nMore = moreSpecs.filter((s) => input[s.name] !== undefined).length;
  const total = Object.keys(input).length;
  const state = status === 'loading' ? 'Calculating…' : prediction ? 'Result ready' : 'Waiting for values';

  return (
    <section className="page">
      <PageHead title="Patient Data">
        <select aria-label="Sample patient" defaultValue="" onChange={(e) => { if (e.target.value) loadSample(e.target.value); e.target.value = ''; }}>
          <option value="">Load a sample…</option>
          {samples.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <button type="button" className="btn" onClick={resetForm}>Clear</button>
      </PageHead>

      <div className="tabs2" role="tablist">
        <button role="tab" type="button" aria-selected={tab === 'key'} onClick={() => setTab('key')}>Key measurements <span>{nKey}/{keyTyped.length}</span></button>
        <button role="tab" type="button" aria-selected={tab === 'more'} onClick={() => setTab('more')}>More clinical details <span>{nMore}/{moreSpecs.length}</span></button>
        <p className="note hint2">Leave unknown values empty. Both tabs feed one result.</p>
      </div>

      {tab === 'key' && <div className="grid3">{groupBy(keySpecs).map(([g, s]) => <Group key={g} title={g} specs={s} />)}</div>}
      {tab === 'more' && (
        <div className="cols">
          {moreSpecs.length === 0 ? <p className="note">Loading the field list from the backend…</p> : groupBy(moreSpecs).map(([g, s]) => <Group key={g} title={g} specs={s} />)}
        </div>
      )}

      <div className="bar-foot">
        <div className="prog" aria-label={`${total} of 55 entered`}><i style={{width: `${(total / 55) * 100}%`}} /></div>
        <span className="note"><span className={`pulse${status === 'loading' ? ' busy' : ''}`} />{total} of 55 entered · {state}</span>
        {tab === 'key' ? <button type="button" className="btn" onClick={() => setTab('more')}>More details →</button> : <button type="button" className="btn" onClick={() => setTab('key')}>← Key measurements</button>}
        <a className="btn primary" href="#/heart">Open artery map →</a>
      </div>
    </section>
  );
}
