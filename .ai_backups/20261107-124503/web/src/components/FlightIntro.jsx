import { useEffect, useRef, useState } from 'react';
import { FlightScene } from '../three/FlightScene.js';

/** Viaje por el espacio. Se puede saltar con el botón o con Esc. Al terminar avisa con onDone. */
export default function FlightIntro({ onDone }) {
  const hostRef = useRef(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const [leaving, setLeaving] = useState(false);

  // Cada montaje crea su propio <canvas>: así un contexto WebGL destruido nunca se reutiliza
  // (React StrictMode monta, desmonta y vuelve a montar en desarrollo).
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.className = 'flight__canvas';
    canvas.setAttribute('aria-hidden', 'true');
    hostRef.current.prepend(canvas);
    const scene = new FlightScene({ canvas, onEnd: () => setLeaving(true) });
    return () => {
      scene.dispose();
      canvas.remove();
    };
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
    <div ref={hostRef} className={`flight ${leaving ? 'is-leaving' : ''}`}>
      <button className="btn flight__skip" onClick={() => setLeaving(true)}>Saltar intro</button>
    </div>
  );
}
