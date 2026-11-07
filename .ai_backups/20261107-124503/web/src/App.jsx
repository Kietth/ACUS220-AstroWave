import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import catalog from './data/stars.json';
import { enrichStar } from './domain/starMath.js';
import { useStarPlayer } from './hooks/useStarPlayer.js';
import FlightIntro from './components/FlightIntro.jsx';
import Welcome from './components/Welcome.jsx';
import Header from './components/Header.jsx';
import StarCanvas from './components/StarCanvas.jsx';
import StarCatalog from './components/StarCatalog.jsx';
import StarDetail from './components/StarDetail.jsx';
import PlayerBar from './components/PlayerBar.jsx';

// Fases: flight (video) -> reveal (aparecen las estrellas) -> welcome (logo + Explorar)
//        -> entering (viaje al mapa) -> ready (interfaz completa)
const SEEN_KEY = 'astrowave:intro-seen';
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function introAlreadySeen() {
  if (new URLSearchParams(window.location.search).has('intro')) return false; // ?intro fuerza el vuelo
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export default function App() {
  const stars = useMemo(() => catalog.map(enrichStar), []);
  const [phase, setPhase] = useState(() => (prefersReducedMotion() || introAlreadySeen() ? 'reveal' : 'flight'));
  const [mode, setMode] = useState('sky');
  const [selectedId, setSelectedId] = useState(stars[0].id);
  const mapRef = useRef(null);
  const player = useStarPlayer();
  const { play, stop, unlock } = player;

  const selected = stars.find((s) => s.id === selectedId);

  const endFlight = useCallback(() => {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* sin almacenamiento: la intro se repetirá, no es grave */
    }
    setPhase('reveal');
  }, []);

  // Revelación: el fondo sale del negro y poco después entra la bienvenida (se solapan a propósito).
  useEffect(() => {
    if (phase !== 'reveal') return undefined;
    mapRef.current?.revealBackdrop();
    const id = setTimeout(() => setPhase('welcome'), prefersReducedMotion() ? 0 : 1400);
    return () => clearTimeout(id);
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
      {phase === 'flight' && <FlightIntro onDone={endFlight} />}
      <Header mode={mode} onModeChange={setMode} muted={player.muted} onToggleMuted={player.toggleMuted} />
      <main className="stage">
        <StarCanvas ref={mapRef} stars={stars} mode={mode} selectedId={selectedId} onSelect={select} interactive={phase === 'ready'} />
        <StarCatalog stars={stars} selectedId={selectedId} onSelect={select} />
        <StarDetail star={selected} />
      </main>
      <PlayerBar
        star={selected}
        playing={player.playingId === selectedId}
        engine={player.engine}
        volume={player.volume}
        onVolume={player.setVolume}
        onToggle={() => (player.playingId ? stop() : play(selected))}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
      />
      {(phase === 'welcome' || phase === 'entering') && <Welcome leaving={phase === 'entering'} onExplore={explore} />}
    </div>
  );
}
