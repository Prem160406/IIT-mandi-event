// Probability -> colour (roadmap 12.5). Pure functions so they can be unit tested.
export const NEUTRAL = '#8d8d95';

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

/** The logistic models are very confident on some inputs, so avoid printing a misleading "100%". */
export function formatProb(p: number): string {
  if (p >= 0.995) return '>99%';
  if (p < 0.005) return '<1%';
  return `${Math.round(p * 100)}%`;
}
