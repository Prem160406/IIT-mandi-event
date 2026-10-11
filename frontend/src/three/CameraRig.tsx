import {useEffect, useRef, type ElementRef} from 'react';
import {useFrame, useThree} from '@react-three/fiber';
import {OrbitControls} from '@react-three/drei';
import * as THREE from 'three';
import {useStore} from '../store/useStore';
import {HEART_CENTER, HOME} from './HeartModel';

interface Tween { t: number; p0: THREE.Vector3; t0: THREE.Vector3; p1: THREE.Vector3; t1: THREE.Vector3 }

/** Orbit controls plus a smooth fly-to for the selected artery and the reset button. */
export function CameraRig({anchors}: {anchors: Record<string, THREE.Vector3>}) {
  const controls = useRef<ElementRef<typeof OrbitControls>>(null);
  const camera = useThree((s) => s.camera);
  const tween = useRef<Tween | null>(null);
  const selected = useStore((s) => s.selectedTarget);
  const nonce = useStore((s) => s.resetNonce);
  const autoRotate = useStore((s) => s.settings.autoRotate);
  const first = useRef(true);

  const fly = (p1: THREE.Vector3, t1: THREE.Vector3) => {
    if (!controls.current) return;
    tween.current = {t: 0, p0: camera.position.clone(), t0: controls.current.target.clone(), p1, t1};
  };

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (selected && anchors[selected]) {
      const a = anchors[selected];
      const dir = a.clone().sub(HEART_CENTER).normalize().add(new THREE.Vector3(0, 0, 0.15)).normalize();
      fly(a.clone().add(dir.multiplyScalar(4.2)), a.clone());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  useEffect(() => {
    if (nonce > 0) fly(HOME.position.clone(), HOME.target.clone());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  useFrame((_, dt) => {
    const tw = tween.current, c = controls.current;
    if (!tw || !c) return;
    tw.t = Math.min(1, tw.t + dt / 0.7);
    const e = 1 - Math.pow(1 - tw.t, 3);
    camera.position.lerpVectors(tw.p0, tw.p1, e);
    c.target.lerpVectors(tw.t0, tw.t1, e);
    if (tw.t >= 1) tween.current = null;
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={3}
      maxDistance={16}
      autoRotate={autoRotate}
      autoRotateSpeed={1.2}
      target={HOME.target.toArray()}
    />
  );
}
