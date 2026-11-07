import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioEngine } from '../audio/AudioEngine.js';

/** Conecta el AudioEngine con el estado de React (reproducción, silencio, volumen). */
export function useStarPlayer() {
  const engineRef = useRef(null);
  if (!engineRef.current) engineRef.current = new AudioEngine();
  const engine = engineRef.current;

  const [playingId, setPlayingId] = useState(null);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.6);

  useEffect(() => engine.setVolume(volume), [engine, volume]);
  useEffect(() => () => engine.dispose(), [engine]);

  const unlock = useCallback(() => engine.unlock(), [engine]);

  const play = useCallback(
    async (star) => {
      if (muted) return;
      await engine.unlock();
      engine.play(star, { onEnded: () => setPlayingId(null) });
      setPlayingId(star.id);
    },
    [engine, muted],
  );

  const stop = useCallback(() => {
    engine.stop();
    setPlayingId(null);
  }, [engine]);

  const toggleMuted = useCallback(() => {
    setMuted((m) => !m);
    stop();
  }, [stop]);

  return { engine, playingId, muted, setMuted, volume, setVolume, unlock, play, stop, toggleMuted };
}
