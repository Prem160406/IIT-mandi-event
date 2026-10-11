import {Suspense, lazy, useEffect, useState} from 'react';
import {useStore} from './store/useStore';
import {DisclaimerBanner} from './components/DisclaimerBanner';
import {InputForm} from './components/InputForm';
import {ResultCards} from './components/ResultCards';
import {Explanation} from './components/Explanation';
import {Measurements} from './components/Measurements';
import {ModelPerformance} from './components/ModelPerformance';
import {About} from './components/About';
import {API_URL} from './api/client';
import {DISCLAIMER} from './lib/anatomy';

const HeartScene = lazy(() => import('./three/HeartScene').then((m) => ({default: m.HeartScene})));
const TABS = ['Explanation', 'Measurements', 'Model performance', 'About'] as const;

export default function App() {
  const init = useStore((s) => s.init);
  const backend = useStore((s) => s.backend);
  const error = useStore((s) => s.error);
  const [tab, setTab] = useState<(typeof TABS)[number]>('Explanation');

  useEffect(() => { void init(); }, [init]);

  return (
    <div className="wrap">
      <DisclaimerBanner />
      <header className="head">
        <div>
          <p className="eyebrow">Coronary artery disease · risk assessment</p>
          <h1>Cardiac Risk 3D</h1>
          <p className="sub">Enter a patient's measurements to estimate overall disease and narrowing of the three main coronary arteries. The heart shows each artery's predicted risk.</p>
        </div>
        <span className={`status s-${backend}`}><i />{backend === 'up' ? 'API connected' : backend === 'down' ? 'API offline' : 'Connecting…'}</span>
      </header>

      {backend === 'down' && (
        <div className="warn" role="alert">
          {error} <br />Start it from the project root with <code>scripts/run_dev.sh</code> (or <code>scripts/run_dev.ps1</code> on Windows). API address: <code>{API_URL}</code>
        </div>
      )}

      <main className="main">
        <InputForm />
        <Suspense fallback={<div className="stage"><span className="note pad">Loading 3D…</span></div>}>
          <HeartScene />
        </Suspense>
      </main>

      <ResultCards />

      <section className="box details" aria-label="Details">
        <div className="tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className="tab" onClick={() => setTab(t)} type="button">{t}</button>
          ))}
        </div>
        <div role="tabpanel">
          {tab === 'Explanation' && <Explanation />}
          {tab === 'Measurements' && <Measurements />}
          {tab === 'Model performance' && <ModelPerformance />}
          {tab === 'About' && <About />}
        </div>
      </section>

      <footer className="foot">
        <p>{DISCLAIMER}</p>
        <p>Dataset: Z-Alizadeh Sani extension, UCI Machine Learning Repository. 3D heart: procedural model made for this project.</p>
      </footer>
    </div>
  );
}
