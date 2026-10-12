import {Suspense, lazy, useCallback, useEffect, useState} from 'react';
import {useStore} from './store/useStore';
import {APP_NAME} from './lib/brand';
import {Heartbeat} from './components/Heartbeat';
import {DisclaimerModal} from './components/DisclaimerModal';
import {Home} from './pages/Home';
import {InputPage} from './pages/InputPage';
import {ReportPage} from './pages/ReportPage';
import {AboutPage} from './pages/AboutPage';

const HeartPage = lazy(() => import('./pages/HeartPage').then((m) => ({default: m.HeartPage})));
const PAGES = [
  {k: 'home', t: 'Welcome'}, {k: 'input', t: 'Patient Data'}, {k: 'heart', t: 'Artery Map'},
  {k: 'report', t: 'Risk Report'}, {k: 'about', t: 'About Us'},
] as const;
type Page = (typeof PAGES)[number]['k'];
const readPage = (): Page => {
  const h = window.location.hash.replace(/^#\/?/, '');
  return PAGES.find((p) => p.k === h)?.k ?? 'home';
};
const seen = () => { try { return window.sessionStorage.getItem('notice-ack') === '1'; } catch { return false; } };

export default function App() {
  const init = useStore((s) => s.init);
  const backend = useStore((s) => s.backend);
  const [page, setPage] = useState<Page>(readPage);
  const [notice, setNotice] = useState(() => !seen());

  useEffect(() => { void init(); }, [init]);
  useEffect(() => {
    const f = () => { setPage(readPage()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  const closeNotice = useCallback(() => {
    try { window.sessionStorage.setItem('notice-ack', '1'); } catch { /* ignore */ }
    setNotice(false);
  }, []);

  return (
    <div className={`app pg-${page}`}>
      <DisclaimerModal open={notice} onClose={closeNotice} />
      <nav className="nav" aria-label="Main">
        <a className="brand" href="#/home"><Heartbeat size="sm" /><span>{APP_NAME}</span></a>
        <div className="links">
          {PAGES.map((p) => <a key={p.k} href={`#/${p.k}`} aria-current={page === p.k ? 'page' : undefined}>{p.t}</a>)}
        </div>
        <button type="button" className="btn ghost" onClick={() => setNotice(true)}>Notice</button>
      </nav>
      {backend === 'down' && (
        <div className="warn" role="alert">The prediction service is not running. Start it with <code>scripts/run_dev.sh</code> (or <code>scripts/run_dev.ps1</code> on Windows).</div>
      )}
      <main>
        {page === 'home' && <Home />}
        {page === 'input' && <InputPage />}
        {page === 'heart' && <Suspense fallback={<p className="note pad">Loading 3D…</p>}><HeartPage /></Suspense>}
        {page === 'report' && <ReportPage />}
        {page === 'about' && <AboutPage />}
      </main>
    </div>
  );
}
