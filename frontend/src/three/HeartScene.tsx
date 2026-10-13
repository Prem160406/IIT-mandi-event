import {Suspense, useCallback, useState} from 'react';
import {Canvas} from '@react-three/fiber';
import {Html} from '@react-three/drei';
import * as THREE from 'three';
import arteryConfig from '@config/arteries.json';
import type {ArteryConfig} from '../types';
import {useStore} from '../store/useStore';
import {cssGradient} from '../lib/colorScale';
import {ArteryLabel, HOME, HeartModel} from './HeartModel';
import {CameraRig} from './CameraRig';
import {Env} from './Env';

const CONFIG = arteryConfig as ArteryConfig;

export function HeartScene() {
  const labels = useStore((s) => s.settings.labels);
  const colorBlind = useStore((s) => s.settings.colorBlind);
  const select = useStore((s) => s.select);
  const hover = useStore((s) => s.hover);
  const [anchors, setAnchors] = useState<Record<string, THREE.Vector3>>({});
  const [missing, setMissing] = useState<string[]>([]);

  const onAnchors = useCallback((a: Record<string, THREE.Vector3>, m: string[]) => { setAnchors(a); setMissing(m); }, []);

  return (
    <div className="stage">
      <Canvas
        dpr={[1, 1.5]}
        camera={{fov: 28, near: 0.1, far: 100, position: HOME.position.toArray()}}
        gl={{antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05}}
        onPointerMissed={() => { select(null); hover(null); }}
        aria-label="Interactive 3D heart. Drag to rotate, scroll to zoom, click an artery to select it."
      >
        <hemisphereLight args={[0xffffff, 0xb08a85, 0.45]} />
        <directionalLight position={[-4, 6, 8]} intensity={1.6} />
        <directionalLight position={[6, 2, -5]} intensity={0.6} color={0xffe6dc} />
        <Env />
        <Suspense fallback={<Html center><span className="note">Loading 3D heart…</span></Html>}>
          <HeartModel onAnchors={onAnchors} />
          {labels && CONFIG.arteries.map((a) => anchors[a.key] && <ArteryLabel key={a.key} name={a.key} position={anchors[a.key]} />)}
        </Suspense>
        <CameraRig anchors={anchors} />
      </Canvas>

      {missing.length > 0 && (
        <div className="warn" role="alert">
          The 3D model has no mesh named {missing.join(', ')}. Check config/arteries.json against heart.glb.
        </div>
      )}
      <Toolbar />
      <div className="legend" style={{['--grad' as string]: cssGradient(colorBlind)}}>
        <span>low</span><div className="bar" /><span>high</span>
        <span className="muted">· grey = no prediction</span>
      </div>
      <div className="hint">Drag to rotate · scroll to zoom · click an artery</div>
    </div>
  );
}

function Toolbar() {
  const s = useStore((x) => x.settings);
  const setSetting = useStore((x) => x.setSetting);
  const resetView = useStore((x) => x.resetView);
  const Btn = ({k, children}: {k: 'labels' | 'colorBlind' | 'autoRotate'; children: string}) => (
    <button type="button" className="btn" aria-pressed={s[k]} onClick={() => setSetting(k, !s[k])}>{children}</button>
  );
  return (
    <div className="tools">
      <button type="button" className="btn" onClick={resetView}>Reset view</button>
      <Btn k="labels">Labels</Btn>
      <Btn k="colorBlind">Colour-blind palette</Btn>
      <Btn k="autoRotate">Auto-rotate</Btn>
    </div>
  );
}
