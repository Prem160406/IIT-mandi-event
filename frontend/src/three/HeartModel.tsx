import {useEffect, useMemo, useRef} from 'react';
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
  materials: THREE.MeshStandardMaterial[];
  anchor: THREE.Vector3;
  current: THREE.Color;
  target: THREE.Color;
  outlineMaterial: THREE.MeshBasicMaterial;
}

interface MaterialState {
  material: THREE.Material;
  color: THREE.Color | null;
  emissiveIntensity: number | null;
}

interface MeshState {
  mesh: THREE.Mesh;
  materials: THREE.Material[];
}

// Dim non-selected anatomy by 34% while an artery is selected.
const UNSELECTED_DIM_FACTOR = 0.66;
const TRANSITION_SECONDS = 0.08; // reaches ~95% of its target in about 250 ms
const SELECTED_PULSE_PERIOD_SECONDS = 2.0;
const SELECTED_EMISSIVE_MIN = 1.5;
const SELECTED_EMISSIVE_MAX = 2.3;

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
function outlineOf(mesh: THREE.Mesh, ownedGeometries: THREE.BufferGeometry[], ownedMaterials: THREE.Material[]): THREE.Mesh {
  const g = mesh.geometry.clone();
  ownedGeometries.push(g);
  const pos = g.getAttribute('position'), nor = g.getAttribute('normal');
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i, pos.getX(i) + nor.getX(i) * 0.014, pos.getY(i) + nor.getY(i) * 0.014, pos.getZ(i) + nor.getZ(i) * 0.014);
  }
  const material = new THREE.MeshBasicMaterial({
    color: 0x2a0a14, side: THREE.BackSide,
  });
  ownedMaterials.push(material);
  const outline = new THREE.Mesh(g, material);
  outline.name = `${mesh.name}_outline`;
  outline.raycast = () => undefined; // never steals clicks
  return outline;
}

/** A warm animated outer shell to make a selected artery unmistakable. */
function selectionOutlineOf(mesh: THREE.Mesh, ownedGeometries: THREE.BufferGeometry[], ownedMaterials: THREE.Material[]): {mesh: THREE.Mesh; material: THREE.MeshBasicMaterial} {
  const g = mesh.geometry.clone();
  ownedGeometries.push(g);
  const pos = g.getAttribute('position'), nor = g.getAttribute('normal');
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i, pos.getX(i) + nor.getX(i) * 0.024, pos.getY(i) + nor.getY(i) * 0.024, pos.getZ(i) + nor.getZ(i) * 0.024);
  }
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff, side: THREE.BackSide, transparent: true, toneMapped: false,
    opacity: 0, depthWrite: false,
  });
  ownedMaterials.push(material);
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
    const ownedMaterials: THREE.Material[] = [];
    const ownedGeometries: THREE.BufferGeometry[] = [];
    const meshStates: MeshState[] = [];
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const sourceMaterials = Array.isArray(m.material) ? m.material : [m.material];
      const materials = sourceMaterials.map((source) => {
        const clone = source.clone();
        ownedMaterials.push(clone);
        return clone;
      });
      m.material = Array.isArray(m.material) ? materials : materials[0];
      meshStates.push({mesh: m, materials});
    });
    root.updateMatrixWorld(true);
    const arteries: Artery[] = [];
    const missing: string[] = [];
    for (const def of CONFIG.arteries) {
      const mesh = root.getObjectByName(def.meshNode) as THREE.Mesh | undefined;
      if (!mesh || !mesh.isMesh) { missing.push(def.meshNode); continue; }
      const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshStandardMaterial[];
      for (const material of materials) {
        material.color.set(NEUTRAL);
        material.emissive.set(NEUTRAL);
        material.emissiveIntensity = 0.04;
      }
      const selectionOutline = selectionOutlineOf(mesh, ownedGeometries, ownedMaterials);
      mesh.add(outlineOf(mesh, ownedGeometries, ownedMaterials), selectionOutline.mesh);
      const pick = root.getObjectByName(`${def.meshNode}_pick`) as THREE.Mesh | undefined;
      if (pick) {
        const pickMaterials = Array.isArray(pick.material) ? pick.material : [pick.material];
        pickMaterials.forEach((m) => { m.visible = false; }); // clickable, never drawn
      }
      arteries.push({
        key: def.key, mesh, materials, anchor: anchorOf(mesh),
        current: new THREE.Color(NEUTRAL), target: new THREE.Color(NEUTRAL),
        outlineMaterial: selectionOutline.material,
      });
    }
    const arteryMeshes = new Set(arteries.map((a) => a.mesh));
    const bodyMaterials: MaterialState[] = [];
    for (const {mesh, materials} of meshStates) {
      if (arteryMeshes.has(mesh) || mesh.name.endsWith('_pick')) continue;
      for (const material of materials) {
        const colored = material as THREE.Material & {color?: THREE.Color; emissiveIntensity?: number};
        bodyMaterials.push({
          material,
          color: colored.color?.isColor ? colored.color.clone() : null,
          emissiveIntensity: typeof colored.emissiveIntensity === 'number' ? colored.emissiveIntensity : null,
        });
      }
    }
    const muscle = root.getObjectByName('Ventricle_Muscle') as THREE.Mesh | undefined;
    return {root, arteries, missing, bodyMaterials, ownedMaterials, ownedGeometries, muscle};
  }, [scene]);
}

export function HeartModel({onAnchors}: {onAnchors?: (a: Record<string, THREE.Vector3>, missing: string[]) => void}) {
  const heart = useHeart();
  const select = useStore((s) => s.select);
  const hover = useStore((s) => s.hover);
  const dimAmount = useRef(1);
  const lastSelectedArtery = useRef<Target | null>(null);
  const selectionPulseStart = useRef(0);

  useEffect(() => () => {
    heart.ownedMaterials.forEach((material) => material.dispose());
    heart.ownedGeometries.forEach((geometry) => geometry.dispose());
  }, [heart]);

  useEffect(() => {
    onAnchors?.(Object.fromEntries(heart.arteries.map((a) => [a.key, a.anchor])), heart.missing);
  }, [heart, onAnchors]);

  // Colours come only from the store: probability -> colourScale -> material (roadmap 12.5).
  useFrame((state, dt) => {
    const {prediction, selectedTarget, hoveredTarget, settings} = useStore.getState();
    const selectedArtery = selectedTarget;
    const hoveredArtery = hoveredTarget;
    if (selectedArtery !== lastSelectedArtery.current) {
      lastSelectedArtery.current = selectedArtery;
      selectionPulseStart.current = state.clock.elapsedTime;
    }
    const k = 1 - Math.exp(-dt / TRANSITION_SECONDS);
    const hasSelection = selectedArtery != null && selectedArtery !== 'CAD';
    const dimTarget = hasSelection ? UNSELECTED_DIM_FACTOR : 1;
    dimAmount.current += (dimTarget - dimAmount.current) * k;
    const pulse = selectedArtery
      ? 0.5 + 0.5 * Math.cos((2 * Math.PI * (state.clock.elapsedTime - selectionPulseStart.current)) / SELECTED_PULSE_PERIOD_SECONDS)
      : 0;
    for (const entry of heart.bodyMaterials) {
      const material = entry.material as THREE.Material & {color?: THREE.Color; emissiveIntensity?: number};
      if (entry.color && material.color?.isColor) material.color.copy(entry.color).multiplyScalar(dimAmount.current);
      if (entry.emissiveIntensity != null && typeof material.emissiveIntensity === 'number') {
        material.emissiveIntensity = entry.emissiveIntensity * dimAmount.current;
      }
    }
    for (const a of heart.arteries) {
      const p = prediction?.vessels[a.key]?.probability ?? null;
      a.target.set(riskColor(p, settings.colorBlind));
      a.current.lerp(a.target, k);
      const selected = selectedArtery === a.key;
      const hovered = hoveredArtery === a.key;
      const arteryDim = selected ? 1 : dimAmount.current;
      const displayColor = a.current.clone().multiplyScalar(arteryDim);
      const glowColor = a.current.clone().lerp(new THREE.Color(0xffffff), 0.14);
      for (const material of a.materials) {
        material.color.copy(displayColor);
        material.emissive.copy(glowColor);
        const targetIntensity = selected
          ? SELECTED_EMISSIVE_MIN + (SELECTED_EMISSIVE_MAX - SELECTED_EMISSIVE_MIN) * pulse
          : hovered ? 0.72 : 0.035;
        material.emissiveIntensity += (targetIntensity - material.emissiveIntensity) * k;
      }
      a.outlineMaterial.color.copy(glowColor);
      const targetOutline = selected ? 0.24 : hovered ? 0.1 : 0;
      a.outlineMaterial.opacity += (targetOutline - a.outlineMaterial.opacity) * k;
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
