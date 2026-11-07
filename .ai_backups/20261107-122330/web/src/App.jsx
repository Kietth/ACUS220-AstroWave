import { useCallback, useMemo, useState } from 'react';
import catalog from './data/stars.json';
import { enrichStar } from './domain/starMath.js';
import { useStarPlayer } from './hooks/useStarPlayer.js';
import EntryOverlay from './components/EntryOverlay.jsx';
import Header from './components/Header.jsx';
import StarCanvas from './components/StarCanvas.jsx';
import StarCatalog from './components/StarCatalog.jsx';
import StarDetail from './components/StarDetail.jsx';
import PlayerBar from './components/PlayerBar.jsx';

export default function App() {
  const stars = useMemo(() => catalog.map(enrichStar), []);
  const [entered, setEntered] = useState(false);
  const [mode, setMode] = useState('sky');
  const [selectedId, setSelectedId] = useState(stars[0].id);
  const player = useStarPlayer();
  const { play, stop, unlock, setMuted } = player;

  const selected = stars.find((s) => s.id === selectedId);

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

  const enter = async (withAudio) => {
    setMuted(!withAudio);
    if (withAudio) await unlock(); // el clic del usuario habilita el audio
    setEntered(true);
  };

  return (
    <div className="app">
      {!entered && <EntryOverlay onEnter={enter} />}
      <Header mode={mode} onModeChange={setMode} muted={player.muted} onToggleMuted={player.toggleMuted} />
      <main className="stage">
        <StarCanvas stars={stars} mode={mode} selectedId={selectedId} onSelect={select} />
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
    </div>
  );
}
