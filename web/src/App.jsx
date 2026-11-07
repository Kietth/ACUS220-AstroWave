import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import catalog from './data/stars.json';
import { enrichStar } from './domain/starMath.js';
import { useStarPlayer } from './hooks/useStarPlayer.js';
import { EASE, clamp01 } from './motion.js';
import Welcome from './components/Welcome.jsx';
import Header from './components/Header.jsx';
import StarCanvas from './components/StarCanvas.jsx';
import StarCatalog from './components/StarCatalog.jsx';
import StarDetail from './components/StarDetail.jsx';
import PlayerBar from './components/PlayerBar.jsx';



const SEEN_KEY = 'astrowave:intro-seen';





const REVEAL = { glow: [0, 0.8], logo: [0.08, 0.55], lead: [0.32, 0.78], sub: [0.46, 0.9], cta: [0.6, 1] };
const ARM_AT = 0.72;
const reveal = (p, [from, to]) => EASE.standard(clamp01((p - from) / (to - from)));
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function introAlreadySeen() {
  if (new URLSearchParams(window.location.search).has('intro')) return false;
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export default function App() {
  const stars = useMemo(() => catalog.map(enrichStar), []);
  const [intro] = useState(() => (prefersReducedMotion() || introAlreadySeen() ? 'idle' : 'flight'));
  const [phase, setPhase] = useState(intro === 'flight' ? 'flight' : 'welcome');
  const [mode, setMode] = useState('sky');
  const [selectedId, setSelectedId] = useState(stars[0].id);
  const [detailOpen, setDetailOpen] = useState(false);
  const mapRef = useRef(null);
  const arriveRef = useRef(null);
  const armedRef = useRef(false);
  const [armed, setArmed] = useState(false);
  const [docked, setDocked] = useState(false);
  const player = useStarPlayer();
  const { play, stop, unlock } = player;

  const selected = stars.find((s) => s.id === selectedId);


  const applyArrive = useCallback((p) => {
    const el = arriveRef.current;
    if (!el) return;
    Object.entries(REVEAL).forEach(([name, range]) => {
      el.style.setProperty(`--a-${name}`, reveal(p, range).toFixed(4));
    });
    if (!armedRef.current && p >= ARM_AT) {
      armedRef.current = true;
      setArmed(true);
    }
  }, []);

  const onDock = useCallback(() => setDocked(true), []);


  useEffect(() => {
    if (phase !== 'welcome') return undefined;
    const id = window.setTimeout(() => applyArrive(1), 4500);
    return () => window.clearTimeout(id);
  }, [phase, applyArrive]);


  const settle = useCallback(() => {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {

    }
    setPhase((p) => (p === 'flight' ? 'welcome' : p));
  }, []);


  // Sin botón visible: la intro dura 6,4 s y solo se ve la primera vez. Aun así sigue siendo
  // interrumpible (clic/toque en cualquier parte, Esc, Espacio o Enter) para no bloquear a nadie.
  useEffect(() => {
    if (phase !== 'flight') return undefined;
    const onKey = (e) => {
      if (['Escape', ' ', 'Enter'].includes(e.key)) {
        e.preventDefault();
        mapRef.current?.skip();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase]);

  const explore = () => {
    if (phase !== 'welcome') return;
    unlock().catch(() => {});
    applyArrive(1);
    setPhase('entering');
    mapRef.current?.explore(() => setPhase('ready'));
  };

  const select = useCallback(
    (id) => {
      setSelectedId(id);
      play(stars.find((s) => s.id === id));
    },
    [play, stars],
  );

  const step = (delta) => {
    const i = stars.findIndex((s) => s.id === selectedId);
    select(stars[(i + delta + stars.length) % stars.length].id);
  };

  return (
    <div className="app" data-phase={phase}>
      <StarCanvas
        ref={mapRef}
        stars={stars}
        intro={intro}
        mode={mode}
        selectedId={selectedId}
        onSelect={select}
        onSettle={settle}
        onArrive={applyArrive}
        interactive={phase === 'ready'}
      />

      <div className="ui">
        <Header
          mode={mode}
          onModeChange={setMode}
          muted={player.muted}
          onToggleMuted={player.toggleMuted}
          logoPending={phase !== 'ready' && !docked}
        />
        <div className="ui__mid">
          <StarCatalog stars={stars} selectedId={selectedId} onSelect={select} />
          <StarDetail star={selected} open={detailOpen} />
          <div className="zoom">
            <button className="btn btn--icon" aria-label="Acercar" onClick={() => mapRef.current?.zoom(0.85)}>+</button>
            <button className="btn btn--icon" aria-label="Alejar" onClick={() => mapRef.current?.zoom(1.18)}>−</button>
            <button className="btn btn--icon" aria-label="Restablecer vista" onClick={() => mapRef.current?.resetView()}>⌂</button>
          </div>
          <p className="hint">Arrastra para orbitar · rueda para zoom · clic en una estrella para escucharla</p>
        </div>
        <PlayerBar
          star={selected}
          playing={player.playingId === selectedId}
          engine={player.engine}
          volume={player.volume}
          onVolume={player.setVolume}
          onToggle={() => (player.playingId ? stop() : play(selected))}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
          detailOpen={detailOpen}
          onToggleDetail={() => setDetailOpen((o) => !o)}
        />
      </div>

      <div ref={arriveRef} className="arrive">
        {(phase === 'welcome' || phase === 'entering') && (
          <Welcome leaving={phase === 'entering'} armed={armed} onExplore={explore} onDock={onDock} />
        )}
      </div>
    </div>
  );
}
