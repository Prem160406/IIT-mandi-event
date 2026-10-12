const HEART = 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';

export function Heartbeat({size = 'lg'}: {size?: 'sm' | 'lg'}) {
  return (
    <div className={`hb hb-${size}`} aria-hidden="true">
      <svg className="hb-heart" viewBox="0 0 24 24"><path d={HEART} /></svg>
      <svg className="hb-line" viewBox="0 0 300 60" preserveAspectRatio="none">
        <path pathLength={100} d="M0 30 H70 L78 24 L86 30 H110 L118 34 L126 4 L136 56 L144 30 H185 L195 20 L205 30 H300" />
      </svg>
    </div>
  );
}

export function Ecg({className = ''}: {className?: string}) {
  return (
    <svg className={`ecg ${className}`} viewBox="0 0 600 60" preserveAspectRatio="none" aria-hidden="true">
      <path pathLength={100} d="M0 30 H110 L120 24 L130 30 H170 L178 34 L186 6 L196 54 L204 30 H260 L272 20 L284 30 H400 L410 24 L420 30 H460 L468 34 L476 6 L486 54 L494 30 H600" />
    </svg>
  );
}

export const HeartShape = ({className}: {className?: string}) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d={HEART} /></svg>
);
