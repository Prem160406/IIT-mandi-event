import {Suspense, useCallback, useState} from 'react';
import {Canvas} from '@react-three/fiber';
import {Html} from '@react-three/drei';
import * as THREE from 'three';
import arteryConfig from '@config/arteries.json';
import type {ArteryConfig, Prediction, Primitive} from '../types';
import {useStore} from '../store/useStore';
import {cssGradient, formatProb, perfusionCssGradient} from '../lib/colorScale';
import {ArteryLabel, HOME, HeartModel, PERFUSION_RISK_THRESHOLDS, type ChamberSelection, type HeartViewMode} from './HeartModel';
import {CameraRig} from './CameraRig';
import {Env} from './Env';

const CONFIG = arteryConfig as ArteryConfig;
const TERRITORIES = [
  ['LAD', 'Anterior LV wall, septum and apex'],
  ['LCX', 'Lateral and posterior LV plus left atrium'],
  ['RCA', 'Right ventricle, inferior LV wall and right atrium'],
];
const DISPLAY: Record<string, string> = {'N': 'None', 'Y': 'Yes', 'LBBB': 'LBBB', 'RBBB': 'RBBB'};
const shown = (input: Record<string, Primitive>, key: string) => input[key] === undefined ? 'Not recorded' : DISPLAY[String(input[key])] ?? String(input[key]);
const percent = (p: number | undefined) => p === undefined ? 'Not available' : formatProb(p);
const PERFUSION_CSS_GRADIENT = perfusionCssGradient();

function AssessmentInspector({selection, prediction, input, onClose}: {
  selection: ChamberSelection;
  prediction: Prediction | null;
  input: Record<string, Primitive>;
  onClose: () => void;
}) {
  const rightSide = selection.label.startsWith('Right ventricle');
  const leftAtrium = selection.label === 'Left atrium';
  const aorta = selection.label.startsWith('Aorta');
  const ventricle = selection.meshName === 'Ventricle_Muscle';
  const supplies = ventricle
    ? selection.dominantVessel === 'RCA' ? ['RCA'] : ['LAD', 'LCX']
    : rightSide ? ['RCA'] : leftAtrium ? ['LCX'] : [];
  const riskList = supplies.map((v) => ({v, p: prediction?.vessels[v]?.probability}));
  const rwma = Number(input['Region RWMA']);
  const relevant = selection.dominantVessel
    ? prediction?.vessels[selection.dominantVessel]?.probability
    : riskList.length ? Math.max(...riskList.map((r) => r.p ?? 0)) : undefined;
  let concordance: string | null = null;
  if (ventricle && input['Region RWMA'] !== undefined && relevant !== undefined && Number.isFinite(rwma)) {
    if (relevant > PERFUSION_RISK_THRESHOLDS.high && rwma > 0) concordance = 'Concordant: stenosis matches the wall motion defect.';
    else if (relevant > PERFUSION_RISK_THRESHOLDS.high && rwma === 0) concordance = 'Possible silent ischaemia: high stenosis risk before wall motion damage.';
    else if (relevant < PERFUSION_RISK_THRESHOLDS.low && rwma > 0) concordance = 'Wall motion defect without predicted stenosis: review other causes.';
  }
  const observed = rightSide
    ? [['Pulse rate (PR)', 'PR'], ['BBB', 'BBB'], ['Edema', 'Edema']]
    : leftAtrium ? []
    : aorta ? [['Blood pressure (BP)', 'BP'], ['VHD', 'VHD'], ['Systolic murmur', 'Systolic Murmur'], ['Diastolic murmur', 'Diastolic Murmur']]
    : [['EF-TTE', 'EF-TTE'], ['Region RWMA', 'Region RWMA'], ['LVH', 'LVH']];
  const territory = selection.dominantVessel && TERRITORIES.find(([v]) => v === selection.dominantVessel)?.[1];
  return (
    <aside className="heart-inspector" aria-label="Chamber assessment">
      <header><div><small>ANATOMY INSPECTOR</small><h3>{selection.label}</h3></div><button type="button" className="btn" onClick={onClose} aria-label="Close inspector">×</button></header>
      {supplies.length > 0 && <section><b>Supplying vessel{supplies.length > 1 ? 's' : ''}</b>
        {riskList.map(({v, p}) => <div className="inspector-risk" key={v}><span>{v}{territory && v === selection.dominantVessel ? ` · ${territory}` : ''}</span><strong>{percent(p)}</strong></div>)}
      </section>}
      {observed.length > 0 && <section><b>Observed patient data</b>{observed.map(([label, key]) => <div className="inspector-data" key={key}><span>{label}</span><strong>{shown(input, key)}</strong></div>)}</section>}
      {concordance && <p className="inspector-concordance"><small>Rule-based echo concordance</small><br />{concordance}</p>}
      {ventricle && <p className="note">RWMA concordance uses the clicked territory and recorded Region RWMA score (0–4).</p>}
      <p className="note">Decision support only—not a diagnosis.</p>
    </aside>
  );
}

export function HeartScene() {
  const labels = useStore((s) => s.settings.labels);
  const colorBlind = useStore((s) => s.settings.colorBlind);
  const prediction = useStore((s) => s.prediction);
  const input = useStore((s) => s.input);
  const select = useStore((s) => s.select);
  const hover = useStore((s) => s.hover);
  const [viewMode, setViewMode] = useState<HeartViewMode>('arteries');
  const [inspection, setInspection] = useState<ChamberSelection | null>(null);
  const [anchors, setAnchors] = useState<Record<string, THREE.Vector3>>({});
  const [missing, setMissing] = useState<string[]>([]);
  const onAnchors = useCallback((a: Record<string, THREE.Vector3>, m: string[]) => { setAnchors(a); setMissing(m); }, []);
  const modeOptions: [HeartViewMode, string][] = [
    ['arteries', 'Coronary Arteries'],
    ['perfusion', 'Myocardial Perfusion & Chambers'],
    ['complications', 'Complications & Valves'],
  ];

  return (
    <div className="stage">
      <Canvas
        dpr={[1, 1.5]}
        camera={{fov: 28, near: 0.1, far: 100, position: HOME.position.toArray()}}
        gl={{antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05}}
        onPointerMissed={() => { select(null); hover(null); setInspection(null); }}
        aria-label="Interactive 3D heart. Drag to rotate, scroll to zoom, click an artery or chamber to inspect."
      >
        <hemisphereLight args={[0xffffff, 0xb08a85, 0.45]} />
        <directionalLight position={[-4, 6, 8]} intensity={1.6} />
        <directionalLight position={[6, 2, -5]} intensity={0.6} color={0xffe6dc} />
        <Env />
        <Suspense fallback={<Html center><span className="note">Loading 3D heart…</span></Html>}>
          <HeartModel onAnchors={onAnchors} viewMode={viewMode} onInspect={setInspection} />
          {labels && CONFIG.arteries.map((a) => anchors[a.key] && <ArteryLabel key={a.key} name={a.key} position={anchors[a.key]} />)}
        </Suspense>
        <CameraRig anchors={anchors} />
      </Canvas>

      <div className="tools view-tools" role="group" aria-label="Heart view mode">
        {modeOptions.map(([mode, label]) => <button key={mode} type="button" className="btn" aria-pressed={viewMode === mode} onClick={() => setViewMode(mode)}>{label}</button>)}
      </div>
      {missing.length > 0 && <div className="warn" role="alert">The 3D model has no mesh named {missing.join(', ')}. Check config/arteries.json against the supplied GLB.</div>}
      {inspection && <AssessmentInspector selection={inspection} prediction={prediction} input={input} onClose={() => setInspection(null)} />}
      {viewMode !== 'arteries' ? (
        <div className="perfusion-legend" style={{['--perfusion-gradient' as string]: PERFUSION_CSS_GRADIENT}}>
          <div><span className="perfusion-gradient" /> <span>Low · &lt;{Math.round(PERFUSION_RISK_THRESHOLDS.low * 100)}%　 Moderate · {Math.round(PERFUSION_RISK_THRESHOLDS.low * 100)}–{Math.round(PERFUSION_RISK_THRESHOLDS.high * 100)}%　 High · &gt;{Math.round(PERFUSION_RISK_THRESHOLDS.high * 100)}%</span></div>
          <small>Healthy → ischaemic perfusion risk · grey = no prediction</small>
          <div className="territory-key">{TERRITORIES.map(([v, meaning]) => <span key={v}><b>{v}</b> · {meaning}</span>)}</div>
        </div>
      ) : (
        <div className="legend" style={{['--grad' as string]: cssGradient(colorBlind)}}><span>low</span><div className="bar" /><span>high</span><span className="muted">· grey = no prediction</span></div>
      )}
      {viewMode === 'complications' && <p className="complication-disclaimer">Rule-based decision support only—not a diagnosis. Badges appear only when recorded patient data supports each rule.</p>}
      <div className="hint">Drag to rotate · scroll to zoom · click an artery or chamber</div>
    </div>
  );
}
