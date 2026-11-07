import { useEffect, useRef, useState } from 'react';
import { FlightScene } from '../three/FlightScene.js';

/** Viaje por el espacio. Se puede saltar con el botón o con Esc. Al terminar avisa con onDone. */
export default function FlightIntro({ onDone }) {
  const canvasRef = useRef(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const scene = new FlightScene({ canvas: canvasRef.current, onEnd: () => setLeaving(true) });
    return () => scene.dispose();
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setLeaving(true);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Fundido a negro antes de entregar el control (evita un corte brusco al saltar).
  useEffect(() => {
    if (!leaving) return undefined;
    const id = setTimeout(() => onDoneRef.current(), 600);
    return () => clearTimeout(id);
  }, [leaving]);

  return (
    <div className={`flight ${leaving ? 'is-leaving' : ''}`}>
      <canvas ref={canvasRef} className="flight__canvas" aria-hidden="true" />
      <button className="btn flight__skip" onClick={() => setLeaving(true)}>Saltar intro</button>
    </div>
  );
}
