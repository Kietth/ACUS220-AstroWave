import { useEffect, useRef } from 'react';
import { SkyScene } from '../three/SkyScene.js';

/** Puente React <-> motor 3D. El motor se crea una vez; las props solo disparan métodos. */
export default function StarCanvas({ stars, mode, selectedId, onSelect }) {
  const canvasRef = useRef(null);
  const labelsRef = useRef(null);
  const sceneRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const scene = new SkyScene({
      canvas: canvasRef.current,
      labelLayer: labelsRef.current,
      stars,
      onSelect: (id) => onSelectRef.current(id),
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    });
    sceneRef.current = scene;
    return () => scene.dispose();
  }, [stars]);

  useEffect(() => sceneRef.current?.setMode(mode), [mode]);
  useEffect(() => sceneRef.current?.setSelected(selectedId), [selectedId]);

  return (
    <div className="map">
      <canvas ref={canvasRef} className="map__canvas" aria-label="Mapa estelar interactivo" />
      <div ref={labelsRef} className="map__labels" aria-hidden="true" />
      <div className="zoom">
        <button className="btn btn--icon" aria-label="Acercar" onClick={() => sceneRef.current?.zoom(0.85)}>+</button>
        <button className="btn btn--icon" aria-label="Alejar" onClick={() => sceneRef.current?.zoom(1.18)}>−</button>
        <button className="btn btn--icon" aria-label="Restablecer vista" onClick={() => sceneRef.current?.resetView()}>⌂</button>
      </div>
      <p className="hint">Arrastra para orbitar · rueda para zoom · clic en una estrella para escucharla</p>
    </div>
  );
}
