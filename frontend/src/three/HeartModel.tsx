import {useEffect, useMemo, useRef, useState} from 'react';
import {useFrame, type ThreeEvent} from '@react-three/fiber';
import {Html, useGLTF} from '@react-three/drei';
import * as THREE from 'three';
import arteryConfig from '@config/arteries.json';
import type {ArteryConfig, Prediction, Target} from '../types';
import {useStore} from '../store/useStore';
import {combinePerfusionRisk, NEUTRAL, perfusionColorAt, formatProb, riskColor} from '../lib/colorScale';

export const MODEL_URL = '/models/Heart2_Perfusion_Map.glb';
const CONFIG = arteryConfig as ArteryConfig;
export const HOME = {position: new THREE.Vector3(0.9, 0.55, 10.2), target: new THREE.Vector3(-0.05, 0.45, 0)};
export const HEART_CENTER = new THREE.Vector3(0, 0.2, 0);
export const PERFUSION_RISK_THRESHOLDS = {low: 0.35, high: 0.65} as const;
const CLINICAL_THRESHOLDS = {highBloodPressure: 140, lowPulseRate: 60, lowEjectionFraction: 40} as const;
const PERFUSION_MESH_NAMES = ['Ventricle_Muscle', 'Left_Atrium', 'Left_Atrial_Appendage', 'Right_Atrium', 'Right_Atrium_Back'];
const ANCHOR_NAMES = ['ANCHOR_Mitral_Valve', 'ANCHOR_Aortic_Valve', 'ANCHOR_Tricuspid_Valve', 'ANCHOR_SA_Node', 'ANCHOR_AV_Node', 'ANCHOR_LV_Apex'];
const SELECTED_PULSE_PERIOD_SECONDS = 2.0;
const SELECTED_EMISSIVE_MIN = 1.5;
const SELECTED_EMISSIVE_MAX = 2.3;
const TRANSITION_SECONDS = 0.08;
const VESSEL_KEYS = ['LAD', 'LCX', 'RCA'] as const;
const TERRITORY_VESSEL: Record<number, typeof VESSEL_KEYS[number]> = {1: 'LAD', 2: 'LCX', 3: 'RCA'};

export type HeartViewMode = 'arteries' | 'perfusion' | 'complications';
export interface ChamberSelection {
  meshName: string;
  label: string;
  dominantVessel?: typeof VESSEL_KEYS[number];
}
interface Artery {
  key: string;
  materials: THREE.MeshStandardMaterial[];
  current: THREE.Color;
  target: THREE.Color;
  outlineMaterial: THREE.MeshBasicMaterial;
}
interface PerfusionMesh {
  name: string;
  geometry: THREE.BufferGeometry;
  weights: [THREE.BufferAttribute, THREE.BufferAttribute, THREE.BufferAttribute];
  materials: THREE.MeshStandardMaterial[];
}
interface Anchor {
  name: string;
  position: THREE.Vector3;
  extras: Record<string, unknown>;
}
interface MeshState { mesh: THREE.Mesh; materials: THREE.Material[] }

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

function outlineOf(mesh: THREE.Mesh): THREE.Mesh {
  const g = mesh.geometry.clone();
  const pos = g.getAttribute('position'), nor = g.getAttribute('normal');
  for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) + nor.getX(i) * 0.014, pos.getY(i) + nor.getY(i) * 0.014, pos.getZ(i) + nor.getZ(i) * 0.014);
  const outline = new THREE.Mesh(g, new THREE.MeshBasicMaterial({color: 0x2a0a14, side: THREE.BackSide}));
  outline.name = `${mesh.name}_outline`;
  outline.raycast = () => undefined;
  return outline;
}

function selectionOutlineOf(mesh: THREE.Mesh): {mesh: THREE.Mesh; material: THREE.MeshBasicMaterial} {
  const g = mesh.geometry.clone();
  const pos = g.getAttribute('position'), nor = g.getAttribute('normal');
  for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) + nor.getX(i) * 0.024, pos.getY(i) + nor.getY(i) * 0.024, pos.getZ(i) + nor.getZ(i) * 0.024);
  const material = new THREE.MeshBasicMaterial({color: 0xffffff, side: THREE.BackSide, transparent: true, toneMapped: false, opacity: 0, depthWrite: false});
  const outline = new THREE.Mesh(g, material);
  outline.name = `${mesh.name}_selection`;
  outline.raycast = () => undefined;
  return {mesh: outline, material};
}

function keyFromName(name: string): string | null {
  const base = name.replace(/_pick$/, '');
  return CONFIG.arteries.find((a) => a.meshNode === base)?.key ?? null;
}

function riskValues(prediction: Prediction | null): [number | null, number | null, number | null] {
  return VESSEL_KEYS.map((key) => {
    const risk = prediction?.vessels[key]?.probability;
    return typeof risk === 'number' && Number.isFinite(risk) ? risk : null;
  }) as [number | null, number | null, number | null];
}

function buildPerfusionColors(mesh: PerfusionMesh, risks: [number | null, number | null, number | null], viewMode: HeartViewMode) {
  const position = mesh.geometry.getAttribute('position');
  const [lad, lcx, rca] = mesh.weights;
  const colors = new Float32Array(position.count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    if (risks.some((r) => r == null)) color.set(NEUTRAL);
    else if (viewMode === 'arteries') color.set(mesh.name === 'Ventricle_Muscle' ? '#7A1A1F' : '#6B1218');
    else {
      const risk = combinePerfusionRisk(
        [lad.getX(i), lcx.getX(i), rca.getX(i)],
        [risks[0]!, risks[1]!, risks[2]!],
      );
      perfusionColorAt(risk, color);
      if (viewMode === 'complications') color.multiplyScalar(0.9);
    }
    color.toArray(colors, i * 3);
  }
  mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  mesh.geometry.attributes.color.needsUpdate = true;
}

function dominantVesselAtHit(mesh: THREE.Mesh, event: {face?: THREE.Face | null; faceIndex?: number; point: THREE.Vector3}): typeof VESSEL_KEYS[number] | undefined {
  const geometry = mesh.geometry;
  const weights = VESSEL_KEYS.map((key) => geometry.getAttribute(`_${key.toLowerCase()}_w`));
  const territory = geometry.getAttribute('_territory');
  const face = event.face;
  if (!weights.every((a): a is THREE.BufferAttribute => !!a)) {
    if (territory && face) return TERRITORY_VESSEL[Math.round(territory.getX(face.a))];
    return undefined;
  }
  let ids: number[];
  if (face) ids = [face.a, face.b, face.c];
  else if (event.faceIndex != null) {
    const start = event.faceIndex * 3;
    ids = [start, start + 1, start + 2].map((n) => geometry.index ? geometry.index.getX(n) : n);
  } else return undefined;
  const point = mesh.worldToLocal(event.point.clone());
  const p0 = new THREE.Vector3().fromBufferAttribute(geometry.getAttribute('position'), ids[0]);
  const p1 = new THREE.Vector3().fromBufferAttribute(geometry.getAttribute('position'), ids[1]);
  const p2 = new THREE.Vector3().fromBufferAttribute(geometry.getAttribute('position'), ids[2]);
  const bary = new THREE.Vector3();
  THREE.Triangle.getBarycoord(point, p0, p1, p2, bary);
  const values = weights.map((attribute) => {
    const a = attribute.getX(ids[0]), b = attribute.getX(ids[1]), c = attribute.getX(ids[2]);
    return a * bary.x + b * bary.y + c * bary.z;
  });
  const max = Math.max(...values);
  if (max > 0) return VESSEL_KEYS[values.indexOf(max)];
  if (territory) return TERRITORY_VESSEL[Math.round(territory.getX(ids[0]))];
  return undefined;
}

export function useHeart() {
  const {scene} = useGLTF(MODEL_URL);
  return useMemo(() => {
    const root = scene.clone(true);
    const ownedMaterials: THREE.Material[] = [];
    const ownedGeometries: THREE.BufferGeometry[] = [];
    const meshStates: MeshState[] = [];
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (PERFUSION_MESH_NAMES.includes(mesh.name)) {
        mesh.geometry = mesh.geometry.clone();
        ownedGeometries.push(mesh.geometry);
      }
      const source = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const materials = source.map((m) => { const clone = m.clone(); ownedMaterials.push(clone); return clone; });
      mesh.material = Array.isArray(mesh.material) ? materials : materials[0];
      meshStates.push({mesh, materials});
    });
    root.updateMatrixWorld(true);
    const arteries: Artery[] = [];
    const missing: string[] = [];
    for (const def of CONFIG.arteries) {
      const mesh = root.getObjectByName(def.meshNode) as THREE.Mesh | undefined;
      if (!mesh?.isMesh) { missing.push(def.meshNode); continue; }
      const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshStandardMaterial[];
      materials.forEach((m) => { m.color.set(NEUTRAL); m.emissive.set(NEUTRAL); m.emissiveIntensity = 0.04; });
      const selection = selectionOutlineOf(mesh), outline = outlineOf(mesh);
      ownedMaterials.push(selection.material, (outline.material as THREE.Material));
      ownedGeometries.push(selection.mesh.geometry, outline.geometry);
      mesh.add(outline, selection.mesh);
      const pick = root.getObjectByName(`${def.meshNode}_pick`) as THREE.Mesh | undefined;
      if (pick) (Array.isArray(pick.material) ? pick.material : [pick.material]).forEach((m) => { m.visible = false; });
      arteries.push({key: def.key, materials, current: new THREE.Color(NEUTRAL), target: new THREE.Color(NEUTRAL), outlineMaterial: selection.material});
    }
    const perfusionMeshes: PerfusionMesh[] = [];
    for (const name of PERFUSION_MESH_NAMES) {
      const mesh = root.getObjectByName(name) as THREE.Mesh | undefined;
      if (!mesh?.isMesh) { console.warn(`[EuKardia] Perfusion mesh missing: ${name}`); continue; }
      const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshStandardMaterial[];
      materials.forEach((m) => {
        m.color.set(0xffffff);
        m.roughness = 0.45;
        m.vertexColors = true;
        m.needsUpdate = true;
      });
      const attrs = ['_lad_w', '_lcx_w', '_rca_w'].map((key) => mesh.geometry.getAttribute(key));
      if (attrs.some((attr) => !attr)) {
        console.warn(`[EuKardia] ${name} is missing GLTFLoader supply attributes. Found: ${Object.keys(mesh.geometry.attributes).join(', ')}`);
        continue;
      }
      perfusionMeshes.push({
        name,
        geometry: mesh.geometry,
        weights: attrs as [THREE.BufferAttribute, THREE.BufferAttribute, THREE.BufferAttribute],
        materials,
      });
    }
    const anchors: Anchor[] = ANCHOR_NAMES.flatMap((name) => {
      const node = root.getObjectByName(name);
      if (!node) { console.warn(`[EuKardia] Anchor missing: ${name}`); return []; }
      const position = node.getWorldPosition(new THREE.Vector3());
      return [{name, position, extras: {...node.userData}}];
    });
    return {root, arteries, missing, perfusionMeshes, anchors, ownedMaterials, ownedGeometries};
  }, [scene]);
}

function supportedComplications(prediction: Prediction | null, input: Record<string, string | number>) {
  const [lad, lcx, rca] = riskValues(prediction);
  const high = (value: number | null) => value != null && value > PERFUSION_RISK_THRESHOLDS.high;
  const vhd = String(input.VHD ?? 'N');
  const hasVhd = vhd !== 'N' && vhd !== 'None' && vhd !== '';
  const severeVhd = ['Moderate', 'Severe'].includes(vhd);
  const systolic = input['Systolic Murmur'] === 'Y' || input['Systolic Murmur'] === 1;
  const diastolic = input['Diastolic Murmur'] === 'Y' || input['Diastolic Murmur'] === 1;
  const murmur = systolic || diastolic;
  const bp = Number(input.BP);
  const pr = Number(input.PR);
  const bbb = input.BBB != null && input.BBB !== '' && input.BBB !== 'N';
  const dyspnea = input.Dyspnea === 'Y' || input.Dyspnea === 1;
  const ef = Number(input['EF-TTE']);
  const mitral = (high(lcx) || high(rca)) && (hasVhd || systolic);
  const aortic = severeVhd || murmur || (Number.isFinite(bp) && bp >= CLINICAL_THRESHOLDS.highBloodPressure);
  const conduction = high(rca) && ((Number.isFinite(pr) && pr < CLINICAL_THRESHOLDS.lowPulseRate) || bbb);
  const pump = high(lad) && ((Number.isFinite(ef) && ef < CLINICAL_THRESHOLDS.lowEjectionFraction) || dyspnea);
  const format = (key: string) => input[key] === undefined ? 'not recorded' : String(input[key]);
  const riskText = (key: string, value: number | null) => `${key} risk ${value == null ? 'not available' : formatProb(value)}`;
  const badges: {anchor: string; label: string; title: string; reasoning: string; values: string[]}[] = [];
  if (mitral) badges.push({anchor: 'ANCHOR_Mitral_Valve', label: 'Mitral valve risk', title: 'Risk of ischaemic mitral regurgitation', reasoning: 'High LCX/RCA risk coincides with valve disease or a systolic murmur.', values: [riskText('LCX', lcx), riskText('RCA', rca), `VHD ${format('VHD')}`, `Systolic murmur ${format('Systolic Murmur')}`]});
  if (aortic) badges.push({anchor: 'ANCHOR_Aortic_Valve', label: 'Aortic valve review', title: 'Aortic valve / root findings', reasoning: 'Valve disease, a murmur, or elevated recorded blood pressure supports review.', values: [`VHD ${format('VHD')}`, `Systolic murmur ${format('Systolic Murmur')}`, `Diastolic murmur ${format('Diastolic Murmur')}`, `BP ${format('BP')} (high threshold: ${CLINICAL_THRESHOLDS.highBloodPressure})`]});
  if (conduction) {
    const why = `High RCA risk with ${Number.isFinite(pr) && pr < CLINICAL_THRESHOLDS.lowPulseRate ? 'low pulse rate' : 'bundle branch block'}.`;
    const values = [riskText('RCA', rca), `PR ${format('PR')}`, `BBB ${format('BBB')}`];
    badges.push({anchor: 'ANCHOR_SA_Node', label: 'SA node risk', title: 'Conduction / arrhythmia risk', reasoning: why, values});
    badges.push({anchor: 'ANCHOR_AV_Node', label: 'AV node risk', title: 'Conduction / arrhythmia risk', reasoning: why, values});
  }
  if (pump) badges.push({anchor: 'ANCHOR_LV_Apex', label: 'LV apex risk', title: 'Pump failure risk', reasoning: 'High LAD risk coincides with reduced EF or dyspnea.', values: [riskText('LAD', lad), `EF-TTE ${format('EF-TTE')}`, `Dyspnea ${format('Dyspnea')}`]});
  return badges;
}

function AnchorMarker({anchor, badge, open, onToggle}: {anchor: Anchor; badge: ReturnType<typeof supportedComplications>[number]; open: boolean; onToggle: () => void}) {
  const extras = anchor.extras;
  return (
    <Html position={anchor.position} occlude={false} zIndexRange={[30, 0]}>
      <div className="perfusion-anchor" onPointerDown={(e) => e.stopPropagation()}>
        <button type="button" className="perfusion-anchor-button" onClick={(e) => { e.stopPropagation(); onToggle(); }} aria-expanded={open}>
          <span aria-hidden="true">!</span>{badge.label}
        </button>
        {open && <div className="perfusion-anchor-tip">
          <small>Rule-based decision support</small><b>{badge.title}</b><p>{badge.reasoning}</p>
          <small>{badge.values.join(' · ')}</small>
          {typeof extras.supply === 'string' && <small>Supply: {extras.supply}</small>}
          {typeof extras.findings === 'string' && <small>Relevant findings: {extras.findings}</small>}
          {typeof extras.risk === 'string' && <small>Clinical context: {extras.risk}</small>}
        </div>}
      </div>
    </Html>
  );
}

export function HeartModel({
  onAnchors,
  viewMode = 'arteries',
  onInspect,
}: {
  onAnchors?: (a: Record<string, THREE.Vector3>, missing: string[]) => void;
  viewMode?: HeartViewMode;
  onInspect?: (selection: ChamberSelection | null) => void;
}) {
  const heart = useHeart();
  const select = useStore((s) => s.select);
  const hover = useStore((s) => s.hover);
  const prediction = useStore((s) => s.prediction);
  const input = useStore((s) => s.input);
  const risks = riskValues(prediction);
  const lastSelectedArtery = useRef<Target | null>(null);
  const selectionPulseStart = useRef(0);
  const [openBadge, setOpenBadge] = useState<string | null>(null);
  const badges = useMemo(() => supportedComplications(prediction, input), [prediction, input]);

  useEffect(() => () => {
    heart.ownedMaterials.forEach((material) => material.dispose());
    heart.ownedGeometries.forEach((geometry) => geometry.dispose());
  }, [heart]);

  useEffect(() => {
    const entries = heart.arteries.map((artery) => {
      const nodeName = CONFIG.arteries.find((def) => def.key === artery.key)?.meshNode;
      const mesh = nodeName ? heart.root.getObjectByName(nodeName) as THREE.Mesh | undefined : undefined;
      return [artery.key, mesh ? anchorOf(mesh) : new THREE.Vector3()] as const;
    });
    onAnchors?.(Object.fromEntries(entries), heart.missing);
  }, [heart, onAnchors]);

  useEffect(() => {
    heart.perfusionMeshes.forEach((mesh) => buildPerfusionColors(mesh, risks, viewMode));
  }, [heart, risks[0], risks[1], risks[2], viewMode]);

  useFrame((state, dt) => {
    const {prediction: latestPrediction, selectedTarget, hoveredTarget, settings} = useStore.getState();
    if (selectedTarget !== lastSelectedArtery.current) {
      lastSelectedArtery.current = selectedTarget;
      selectionPulseStart.current = state.clock.elapsedTime;
    }
    const k = 1 - Math.exp(-dt / TRANSITION_SECONDS);
    const pulse = selectedTarget
      ? 0.5 + 0.5 * Math.cos((2 * Math.PI * (state.clock.elapsedTime - selectionPulseStart.current)) / SELECTED_PULSE_PERIOD_SECONDS)
      : 0;
    for (const artery of heart.arteries) {
      const p = latestPrediction?.vessels[artery.key]?.probability ?? null;
      artery.target.set(riskColor(p, settings.colorBlind));
      artery.current.lerp(artery.target, k);
      const selected = selectedTarget === artery.key;
      const hovered = hoveredTarget === artery.key;
      for (const material of artery.materials) {
        material.color.copy(artery.current);
        material.emissive.copy(artery.current).lerp(new THREE.Color(0xffffff), 0.14);
        const targetIntensity = selected
          ? SELECTED_EMISSIVE_MIN + (SELECTED_EMISSIVE_MAX - SELECTED_EMISSIVE_MIN) * pulse
          : hovered ? 0.72 : 0.035;
        material.emissiveIntensity += (targetIntensity - material.emissiveIntensity) * k;
      }
      artery.outlineMaterial.color.copy(artery.current);
      artery.outlineMaterial.opacity += ((selected ? 0.24 : hovered ? 0.1 : 0) - artery.outlineMaterial.opacity) * k;
    }
  });

  const chooseAnatomy = (name: string, event: ThreeEvent<MouseEvent>) => {
    const mesh = event.object as THREE.Mesh;
    let selection: ChamberSelection | null = null;
    if (name === 'Ventricle_Muscle') {
      const dominantVessel = mesh.isMesh ? dominantVesselAtHit(mesh, event) : undefined;
      selection = {meshName: name, label: dominantVessel === 'RCA' ? 'Right ventricle / inferior LV region' : 'Left ventricle', dominantVessel};
    } else if (['Right_Atrium', 'Right_Atrium_Back'].includes(name)) {
      selection = {meshName: name, label: 'Right atrium', dominantVessel: 'RCA'};
    } else if (['Left_Atrium', 'Left_Atrial_Appendage'].includes(name)) {
      selection = {meshName: name, label: 'Left atrium', dominantVessel: 'LCX'};
    } else if (name === 'Aorta') selection = {meshName: name, label: 'Aorta / valve zone'};
    if (selection) { select(null); onInspect?.(selection); }
  };

  return (
    <>
      <primitive
        object={heart.root}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => {
          const key = keyFromName(e.object.name);
          hover(key as Target | null);
          const clickable = key || PERFUSION_MESH_NAMES.includes(e.object.name) || e.object.name === 'Aorta';
          document.body.style.cursor = clickable ? 'pointer' : 'auto';
        }}
        onPointerOut={() => { hover(null); document.body.style.cursor = 'auto'; }}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          const key = keyFromName(e.object.name) as Target | null;
          if (key) {
            e.stopPropagation();
            const current = useStore.getState().selectedTarget;
            select(current === key ? null : key);
            onInspect?.(null);
            return;
          }
          if (PERFUSION_MESH_NAMES.includes(e.object.name) || e.object.name === 'Aorta') {
            e.stopPropagation();
            chooseAnatomy(e.object.name, e);
          }
        }}
      />
      {viewMode === 'complications' && badges.map((badge) => {
        const anchor = heart.anchors.find((a) => a.name === badge.anchor);
        return anchor ? <AnchorMarker key={badge.anchor} anchor={anchor} badge={badge} open={openBadge === badge.anchor} onToggle={() => setOpenBadge(openBadge === badge.anchor ? null : badge.anchor)} /> : null;
      })}
    </>
  );
}

export function ArteryLabel({name, position}: {name: string; position: THREE.Vector3}) {
  const p = useStore((s) => s.prediction?.vessels[name]?.probability ?? null);
  const colorBlind = useStore((s) => s.settings.colorBlind);
  const selected = useStore((s) => s.selectedTarget === name);
  return <Html position={position} zIndexRange={[5, 0]} style={{pointerEvents: 'none'}}><div className={`lbl${selected ? ' sel' : ''}`}><i style={{background: riskColor(p, colorBlind)}} /><span>{name}{p == null ? '' : ` ${formatProb(p)}`}</span></div></Html>;
}

useGLTF.preload(MODEL_URL);
