import {useEffect, useState, type CSSProperties} from 'react';
import {Ecg, HeartShape} from '../components/Heartbeat';
import {DESCRIPTION, QUOTES, TAGLINE} from '../lib/brand';
import {Wordmark} from '../components/Wordmark';

export function Home() {
  const [bpm, setBpm] = useState(72);
  const [q, setQ] = useState(0);
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setQ((i) => (i + 1) % QUOTES.length), 5500);
    return () => window.clearInterval(t);
  }, []);

  return (
    <section className="hero">
      <div className="hero-art" role="img" aria-label="Beating heart. Hover or click to speed it up."
        style={{'--beat': `${60 / bpm}s`} as CSSProperties}
        onMouseEnter={() => setBpm(110)} onMouseLeave={() => setBpm(72)} onClick={() => setBurst((b) => b + 1)}>
        <span className="ring r1" /><span className="ring r2" /><span className="ring r3" />
        <span key={burst} className={`ripple${burst ? ' go' : ''}`} />
        <HeartShape className="bigheart" />
        <div className="bpm"><b>{bpm}</b> BPM</div>
      </div>
      <div className="hero-text">
        <p className="eyebrow">Coronary artery disease · risk assessment</p>
        <h1 className="hero-wordmark"><Wordmark /></h1>
        <p className="tagline">{TAGLINE}</p>
        <p className="desc">{DESCRIPTION}</p>
        <blockquote key={q} className="quote">“{QUOTES[q]}”</blockquote>
        <div className="dots">
          {QUOTES.map((_, i) => <button key={i} type="button" aria-label={`Quote ${i + 1}`} aria-pressed={i === q} onClick={() => setQ(i)} />)}
        </div>
        <a className="btn cta lg" href="#/input">Let’s check →</a>
      </div>
      <Ecg className="hero-ecg" />
    </section>
  );
}
