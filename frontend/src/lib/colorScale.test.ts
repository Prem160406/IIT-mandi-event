import {describe, expect, it} from 'vitest';
import {NEUTRAL, formatProb, hslToHex, riskColor} from './colorScale';

describe('riskColor', () => {
  it('is neutral grey before any prediction', () => {
    expect(riskColor(null)).toBe(NEUTRAL);
    expect(riskColor(undefined)).toBe(NEUTRAL);
    expect(riskColor(Number.NaN)).toBe(NEUTRAL);
  });
  it('runs from green at 0 to red at 1', () => {
    const g = riskColor(0), r = riskColor(1);
    expect(parseInt(g.slice(3, 5), 16)).toBeGreaterThan(parseInt(g.slice(1, 3), 16));
    expect(parseInt(r.slice(1, 3), 16)).toBeGreaterThan(parseInt(r.slice(3, 5), 16));
  });
  it('clamps out-of-range probabilities', () => {
    expect(riskColor(-3)).toBe(riskColor(0));
    expect(riskColor(7)).toBe(riskColor(1));
  });
  it('has a colour-blind palette that differs from the default', () => {
    expect(riskColor(0.8, true)).not.toBe(riskColor(0.8, false));
  });
});

describe('helpers', () => {
  it('hslToHex returns pure red for hue 0', () => {
    expect(hslToHex(0, 1, 0.5)).toBe('#ff0000');
  });
  it('formats extreme probabilities without claiming certainty', () => {
    expect(formatProb(0.9999)).toBe('>99%');
    expect(formatProb(0.0001)).toBe('<1%');
    expect(formatProb(0.74)).toBe('74%');
  });
});
