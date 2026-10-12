import {useEffect, useRef, useState} from 'react';

// Smoothly animates a number toward its target (used for probabilities).
export function useCountUp(target: number | null): number {
  const [v, setV] = useState(target ?? 0);
  const cur = useRef(target ?? 0);
  useEffect(() => {
    if (target == null) { cur.current = 0; setV(0); return; }
    const from = cur.current, t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 450);
      cur.current = from + (target - from) * (1 - Math.pow(1 - k, 3));
      setV(cur.current);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
}
