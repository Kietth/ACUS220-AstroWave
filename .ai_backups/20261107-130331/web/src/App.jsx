import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import catalog from './data/stars.json';
import { enrichStar } from './domain/starMath.js';
import { useStarPlayer } from './hooks/useStarPlayer.js';
import Welcome from './components/Welcome.jsx';
import Header from './components/Header.jsx';
import StarCanvas from './components/StarCanvas.jsx';
import StarCatalog from './components/StarCatalog.jsx';
import StarDetail from './components/StarDetail.jsx';
import PlayerBar from './components/PlayerBar.jsx';

// Fases: flight (viaje) -> welcome (logo + Explorar; entra mientras el viaje aún frena)
//        -> entering (la cámara se acomoda al mapa) -> ready (interfaz completa)
const SEEN_KEY = 'astrowave:intro-seen';
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function introAlreadySeen() {
  if (new URLSearchParams(window.location.search).has('intro')) return false; // ?intro fuerza el viaje
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
  const player = useStarPlayer();
  const { play, stop, unlock } = player;

  const selected = stars.find((s) => s.id === selectedId);

  // El motor avisa cuando la bienvenida debe entrar (a los ~6.7 s o al saltar).
  const settle = useCallback(() => {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* sin almacenamiento: la intro se repetirá, no es grave */
    }
    setPhase((p) => (p === 'flight' ? 'welcome' : p));
  }, []);

  // Teclado: Esc, Espacio o Enter saltan el viaje.
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
    unlock().catch(() => {}); // el clic del usuario habilita el audio
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
        interactive={phase === 'ready'}
      />

      <div className="ui">
        <Header mode={mode} onModeChange={setMode} muted={player.muted} onToggleMuted={player.toggleMuted} />
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

      {phase === 'flight' && (
        <button className="btn skip" onClick={() => mapRef.current?.skip()}>Saltar intro</button>
      )}
      {(phase === 'welcome' || phase === 'entering') && <Welcome leaving={phase === 'entering'} onExplore={explore} />}
    </div>
  );
}
