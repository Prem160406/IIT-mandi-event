import * as THREE from 'three';

// Probability -> colour (roadmap 12.5). Pure functions so they can be unit tested.
export const NEUTRAL = '#8d8d95';

export const PERFUSION_COLOR_STOPS = [
  {at: 0.00, hex: '#9A3B35'},
  {at: 0.28, hex: '#D4743A'},
  {at: 0.48, hex: '#F2C14E'},
  {at: 0.66, hex: '#A99CBB'},
  {at: 0.82, hex: '#6D52B3'},
  {at: 1.00, hex: '#35206B'},
] as const;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function hslToHex(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const hex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}

function mixHex(a: string, b: string, t: number): string {
  const p = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  const m = (i: number) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * t).toString(16).padStart(2, '0');
  return `#${m(0)}${m(1)}${m(2)}`;
}

/** Green (low) to red (high). A blue-to-orange scale is available for colour-blind viewers. */
export function riskColor(p: number | null | undefined, colorBlind = false): string {
  if (p == null || Number.isNaN(p)) return NEUTRAL;
  const t = clamp01(p);
  return colorBlind ? mixHex('#2b78c9', '#f08a1c', t) : hslToHex(120 * (1 - t), 0.82, 0.46);
}

export function cssGradient(colorBlind: boolean): string {
  return colorBlind
    ? 'linear-gradient(90deg,#2b78c9,#f08a1c)'
    : 'linear-gradient(90deg,hsl(120 82% 46%),hsl(60 82% 46%),hsl(0 82% 46%))';
}

/** Blend each mesh vertex's LAD/LCX/RCA supply weights with the live model probabilities. */
export function combinePerfusionRisk(
  weights: readonly [number, number, number],
  risks: readonly [number, number, number],
): number {
  return weights[0] * risks[0] + weights[1] * risks[1] + weights[2] * risks[2];
}

/** Piecewise-linear perfusion ramp; THREE.Color converts sRGB hex stops to linear RGB. */
export function perfusionColorAt(risk: number, target = new THREE.Color()): THREE.Color {
  const value = THREE.MathUtils.clamp(risk, 0, 1);
  let upper = PERFUSION_COLOR_STOPS.findIndex((stop) => stop.at >= value);
  if (upper <= 0) return target.set(PERFUSION_COLOR_STOPS[0].hex);
  if (upper < 0) upper = PERFUSION_COLOR_STOPS.length - 1;
  const lowerStop = PERFUSION_COLOR_STOPS[upper - 1];
  const upperStop = PERFUSION_COLOR_STOPS[upper];
  return target.set(lowerStop.hex).lerp(new THREE.Color(upperStop.hex), (value - lowerStop.at) / (upperStop.at - lowerStop.at));
}

/** CSS color samples from the exact same linear-RGB ramp used by the 3D vertex colors. */
export function perfusionCssGradient(): string {
  const samples = Array.from({length: 101}, (_, index) => {
    const percent = index;
    const hex = `#${perfusionColorAt(index / 100).getHexString(THREE.SRGBColorSpace)}`;
    return `${hex} ${percent}%`;
  });
  return `linear-gradient(90deg,${samples.join(',')})`;
}

/** The logistic models are very confident on some inputs, so avoid printing a misleading "100%". */
export function formatProb(p: number): string {
  if (p >= 0.995) return '>99%';
  if (p < 0.005) return '<1%';
  return `${Math.round(p * 100)}%`;
}
