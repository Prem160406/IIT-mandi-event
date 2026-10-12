import {useEffect, useMemo} from 'react';
import {useFrame} from '@react-three/fiber';
import {Html, useGLTF} from '@react-three/drei';
import * as THREE from 'three';
import arteryConfig from '@config/arteries.json';
import type {ArteryConfig, Target} from '../types';
import {useStore} from '../store/useStore';
import {NEUTRAL, formatProb, riskColor} from '../lib/colorScale';

export const MODEL_URL = '/models/heart.glb';
const CONFIG = arteryConfig as ArteryConfig;
export const HOME = {position: new THREE.Vector3(0.9, 0.55, 10.2), target: new THREE.Vector3(-0.05, 0.45, 0)};
export const HEART_CENTER = new THREE.Vector3(0, 0.2, 0);

interface Artery {
  key: string;
  mesh: THREE.Mesh;
  material: THREE.MeshPhysicalMaterial;
  anchor: THREE.Vector3;
  current: THREE.Color;
  target: THREE.Color;
  outlineMaterial: THREE.MeshBasicMaterial;
}

/** A label spot on the artery: the vertex nearest to the centre of its mesh. */
function anchorOf(mesh: THREE.Mesh): THREE.Vector3 {
  const pos = mesh.geometry.getAttribute('position');
  const c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) c.add(v.fromBufferAttribute(pos, i));
  c.divideScalar(pos.count);
  let best = Infinity;
  const out = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const d = v.distanceToSquared(c);
    if (d < best) { best = d; out.copy(v); }
  }
  return mesh.localToWorld(out);
}

/** A thin dark shell around an artery so it stays visible on red heart muscle at any risk colour. */
function outlineOf(mesh: THREE.Mesh): THREE.Mesh {
  const g = mesh.geometry.clone();
  const pos = g.getAttribute('position'), nor = g.getAttribute('normal');
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i, pos.getX(i) + nor.getX(i) * 0.014, pos.getY(i) + nor.getY(i) * 0.014, pos.getZ(i) + nor.getZ(i) * 0.014);
  }
  const material = new THREE.MeshBasicMaterial({
    color: 0x2a0a14, side: THREE.BackSide,
  });
  const outline = new THREE.Mesh(g, material);
  outline.name = `${mesh.name}_outline`;
  outline.raycast = () => undefined; // never steals clicks
  return outline;
}

/** A warm animated outer shell to make a selected artery unmistakable. */
function selectionOutlineOf(mesh: THREE.Mesh): {mesh: THREE.Mesh; material: THREE.MeshBasicMaterial} {
  const g = mesh.geometry.clone();
  const pos = g.getAttribute('position'), nor = g.getAttribute('normal');
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i, pos.getX(i) + nor.getX(i) * 0.024, pos.getY(i) + nor.getY(i) * 0.024, pos.getZ(i) + nor.getZ(i) * 0.024);
  }
  const material = new THREE.MeshBasicMaterial({
    color: 0x56fff2, side: THREE.BackSide, transparent: true, toneMapped: false,
    opacity: 0, depthWrite: false,
  });
  const outline = new THREE.Mesh(g, material);
  outline.name = `${mesh.name}_selection`;
  outline.raycast = () => undefined; // never steals clicks
  return {mesh: outline, material};
}

/** Maps a hit mesh name ("LAD" or "LAD_pick") back to its artery key. */
function keyFromName(name: string): string | null {
  const base = name.replace(/_pick$/, '');
  return CONFIG.arteries.some((a) => a.meshNode === base) ? CONFIG.arteries.find((a) => a.meshNode === base)!.key : null;
}

export function useHeart() {
  const {scene} = useGLTF(MODEL_URL);
  return useMemo(() => {
    const root = scene.clone(true);
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.material = (m.material as THREE.Material).clone();
    });
    root.updateMatrixWorld(true);
    const arteries: Artery[] = [];
    const missing: string[] = [];
    for (const def of CONFIG.arteries) {
      const mesh = root.getObjectByName(def.meshNode) as THREE.Mesh | undefined;
      if (!mesh || !mesh.isMesh) { missing.push(def.meshNode); continue; }
      const material = mesh.material as THREE.MeshPhysicalMaterial;
      material.color.set(NEUTRAL);
      const selectionOutline = selectionOutlineOf(mesh);
      mesh.add(outlineOf(mesh), selectionOutline.mesh);
      const pick = root.getObjectByName(`${def.meshNode}_pick`) as THREE.Mesh | undefined;
      if (pick) pick.material = Object.assign((pick.material as THREE.Material).clone(), {visible: false}); // clickable, never drawn
      arteries.push({
        key: def.key, mesh, material, anchor: anchorOf(mesh),
        current: new THREE.Color(NEUTRAL), target: new THREE.Color(NEUTRAL),
        outlineMaterial: selectionOutline.material,
      });
    }
    const muscle = root.getObjectByName('Ventricle_Muscle') as THREE.Mesh | undefined;
    return {root, arteries, missing, muscle};
  }, [scene]);
}

export function HeartModel({onAnchors}: {onAnchors?: (a: Record<string, THREE.Vector3>, missing: string[]) => void}) {
  const heart = useHeart();
  const select = useStore((s) => s.select);
  const hover = useStore((s) => s.hover);

  useEffect(() => {
    onAnchors?.(Object.fromEntries(heart.arteries.map((a) => [a.key, a.anchor])), heart.missing);
  }, [heart, onAnchors]);

  // Colours come only from the store: probability -> colourScale -> material (roadmap 12.5).
  useFrame((_, dt) => {
    const {prediction, selectedTarget, hoveredTarget, settings} = useStore.getState();
    const k = 1 - Math.pow(0.001, dt); // smooth ~0.5 s transition
    for (const a of heart.arteries) {
      const p = prediction?.vessels[a.key]?.probability ?? null;
      a.target.set(riskColor(p, settings.colorBlind));
      a.current.lerp(a.target, k);
      a.material.color.copy(a.current);
      const selected = selectedTarget === a.key;
      const hovered = hoveredTarget === a.key;
      const blink = 0.5 + 0.5 * Math.sin(performance.now() / 1150);
      const selectionGlow = selected ? 0.42 + 0.3 * blink : 0;
      a.outlineMaterial.opacity = selected ? 0.68 + 0.3 * blink : hovered ? 0.48 : 0;
      const riskPulse = p != null && p >= CONFIG.riskLevels.high ? 0.08 * Math.sin(performance.now() / 350) : 0;
      a.material.emissive.copy(a.current).multiplyScalar(Math.max(selectionGlow, hovered ? 0.55 : 0.22 + riskPulse));
    }
  });

  return (
    <primitive
      object={heart.root}
      onPointerMove={(e: {object: THREE.Object3D; stopPropagation: () => void}) => {
        const key = keyFromName(e.object.name);
        hover(key as Target | null);
        document.body.style.cursor = key ? 'pointer' : 'auto';
      }}
      onPointerOut={() => { hover(null); document.body.style.cursor = 'auto'; }}
      onClick={(e: {object: THREE.Object3D; stopPropagation: () => void}) => {
        const key = keyFromName(e.object.name) as Target | null;
        if (!key) return; // a click on the heart body is ignored
        e.stopPropagation();
        const cur = useStore.getState().selectedTarget;
        select(cur === key ? null : key);
      }}
    />
  );
}

export function ArteryLabel({name, position}: {name: string; position: THREE.Vector3}) {
  const p = useStore((s) => s.prediction?.vessels[name]?.probability ?? null);
  const colorBlind = useStore((s) => s.settings.colorBlind);
  const selected = useStore((s) => s.selectedTarget === name);
  return (
    <Html position={position} zIndexRange={[5, 0]} style={{pointerEvents: 'none'}}>
      <div className={`lbl${selected ? ' sel' : ''}`}>
        <i style={{background: riskColor(p, colorBlind)}} />
        <span>{name}{p == null ? '' : ` ${formatProb(p)}`}</span>
      </div>
    </Html>
  );
}

useGLTF.preload(MODEL_URL);
