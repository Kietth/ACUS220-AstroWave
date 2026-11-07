import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { SkyScene } from '../three/SkyScene.js';

/**
 * Puente React <-> motor 3D. El motor se crea una vez (siempre en la pose de introducción);
 * las props solo disparan métodos. `interactive` habilita el mapa cuando termina la entrada.
 */
const StarCanvas = forwardRef(function StarCanvas({ stars, mode, selectedId, onSelect, interactive }, ref) {
  const canvasRef = useRef(null);
  const labelsRef = useRef(null);
  const sceneRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useImperativeHandle(ref, () => ({
    revealBackdrop: (ms) => sceneRef.current?.revealBackdrop(ms),
    explore: (onArrive) => sceneRef.current?.explore(onArrive),
  }), []);

  useEffect(() => {
    const scene = new SkyScene({
      canvas: canvasRef.current,
      labelLayer: labelsRef.current,
      stars,
      onSelect: (id) => onSelectRef.current(id),
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    });
    scene.enterIntroPose();
    sceneRef.current = scene;
    return () => scene.dispose();
  }, [stars]);

  // El modo solo se aplica cuando el mapa es interactivo: durante la intro manda la coreografía.
  useEffect(() => {
    if (interactive) sceneRef.current?.setMode(mode);
  }, [mode, interactive]);
  useEffect(() => {
    sceneRef.current?.setInteractive(interactive);
  }, [interactive]);
  useEffect(() => {
    sceneRef.current?.setSelected(selectedId);
  }, [selectedId]);

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
});

export default StarCanvas;
