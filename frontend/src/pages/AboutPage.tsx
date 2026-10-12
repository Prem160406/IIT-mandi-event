import {useMemo, useState} from 'react';
import {GROUP_TITLE, KEY_TERMS, NAMES} from '../lib/glossary';
import {ModelPerformance} from '../components/ModelPerformance';
import {NarrowingDiagram} from '../components/NarrowingDiagram';
import {PageHead} from '../components/PageHead';
import {useStore} from '../store/useStore';

const TABS = ['Overview', 'Terms', 'Model'] as const;
const FACTORS = ['High blood pressure', 'High LDL', 'Low HDL', 'Diabetes', 'Smoking', 'Age', 'Family history', 'Obesity', 'Inactivity'];
const ARTERIES = [
  {k: 'LAD', where: 'Runs down the front of the heart, between the two ventricles.', feeds: 'Front wall of the left ventricle and most of the septum.', ifNarrow: 'Affects the main pumping muscle. A severe blockage high up can be dangerous.'},
  {k: 'LCX', where: 'Wraps around the left side toward the back.', feeds: 'Side and back wall of the left ventricle.', ifNarrow: 'Can reduce blood to the side and back of the heart.'},
  {k: 'RCA', where: 'Runs along the right side and under the heart.', feeds: 'Right ventricle, bottom of the heart and often the rhythm nodes.', ifNarrow: 'Can slow the heartbeat or lower blood pressure.'},
] as const;

function Terms() {
  const [q, setQ] = useState('');
  const rest = useMemo(() => {
    const used = new Set(KEY_TERMS.map((t) => t[0].toLowerCase()));
    return Object.values(NAMES).filter(([label]) => !used.has(label.toLowerCase())).map(([label, full, g]) => [label, full, GROUP_TITLE[g]] as [string, string, string]);
  }, []);
  const all = [...KEY_TERMS, ...rest];
  const shown = all.filter((r) => r.join(' ').toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div>
      <div className="row between"><input className="search" type="search" placeholder="Search a term…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search terms" /><span className="note">{shown.length} of {all.length} terms · key terms first</span></div>
      <div className="scroll terms">
        <table>
          <thead><tr><th>Term</th><th>Full form</th><th>Meaning / group</th></tr></thead>
          <tbody>{shown.map(([a, b, c], i) => <tr key={`${a}-${i}`} className={i < KEY_TERMS.length && !q ? 'keyrow' : ''}><td><b>{a}</b></td><td>{b}</td><td>{c}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

export function AboutPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Overview');
  const metrics = useStore((s) => s.metrics);
  const stat = (k: string) => metrics?.targets.find((t) => t.target === k);
  return (
    <section className="page">
      <PageHead title="About Us" />
      <div className="tabs2" role="tablist">
        {TABS.map((t) => <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>)}
      </div>
      {tab === 'Overview' && (
        <div className="about">
          <div className="box prose">
            <h3>The disease</h3>
            <p><b>Coronary artery disease (CAD)</b> is the narrowing of the arteries that feed the heart muscle. Plaque (fat, cholesterol and cells) builds up in the artery wall, a process called atherosclerosis.</p>
            <p>The narrowing is called <b>stenosis</b>. Here, 50% or more in a main artery counts as significant, and coronary angiography is the test that confirms it.</p>
            <p>Less blood reaches the muscle, especially during effort. This can cause chest pain (angina) and breathlessness, or a heart attack if a clot blocks the artery. It often develops silently for years.</p>
            <div className="chips">{FACTORS.map((f) => <span key={f}>{f}</span>)}</div>
            <p className="callout">Chest pain, pressure or sudden breathlessness needs urgent medical care.</p>
          </div>
          <div className="box"><h3>See how narrowing works</h3><NarrowingDiagram /></div>
          <div className="arts">
            {ARTERIES.map((a) => {
              const m = stat(a.k);
              return (
                <div className="box art" key={a.k}>
                  <h3>{a.k} · {a.k === 'LAD' ? 'Left anterior descending' : a.k === 'LCX' ? 'Left circumflex' : 'Right coronary artery'}</h3>
                  <p><b>Where:</b> {a.where}</p>
                  <p><b>Supplies:</b> {a.feeds}</p>
                  <p><b>If narrowed:</b> {a.ifNarrow}</p>
                  <p className="note">{m ? `In the data: ${m.class_counts_full_dataset['1']} of ${m.dataset_rows} patients narrowed · test AUC ${m.holdout_metrics.roc_auc.toFixed(2)}` : 'Data figures load from the backend.'}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {tab === 'Terms' && <div className="box"><Terms /></div>}
      {tab === 'Model' && (
        <div className="box prose">
          <p><b>Data:</b> Z-Alizadeh Sani extension (UCI), 303 patients referred for angiography. <b>Models:</b> one logistic regression each for overall CAD, LAD, LCX and RCA.</p>
          <ModelPerformance />
        </div>
      )}
    </section>
  );
}
