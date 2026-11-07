import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { World } from '../three/World.js';

/**
 * Puente React <-> motor 3D. El mundo ocupa toda la pantalla, detrás de la interfaz.
 * `intro` ('flight' | 'idle') solo se lee al montar. Las demás props disparan métodos del motor.
 */
const StarCanvas = forwardRef(function StarCanvas({ stars, intro, mode, selectedId, onSelect, onSettle, interactive }, ref) {
  const hostRef = useRef(null);
  const labelsRef = useRef(null);
  const worldRef = useRef(null);
  const callbacks = useRef({ onSelect, onSettle });
  callbacks.current = { onSelect, onSettle };

  useImperativeHandle(ref, () => ({
    explore: (onArrive) => worldRef.current?.explore(onArrive),
    skip: () => worldRef.current?.skipFlight(),
    zoom: (factor) => worldRef.current?.zoom(factor),
    resetView: () => worldRef.current?.resetView(),
  }), []);

  // Cada montaje crea su propio <canvas>: un contexto WebGL destruido nunca se reutiliza (StrictMode).
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-label', 'Mapa estelar interactivo');
    hostRef.current.prepend(canvas);
    const world = new World({
      canvas,
      labelLayer: labelsRef.current,
      stars,
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      onSelect: (id) => callbacks.current.onSelect(id),
      onSettle: () => callbacks.current.onSettle(),
    });
    world.start(intro);
    worldRef.current = world;
    return () => {
      world.dispose();
      canvas.remove();
      worldRef.current = null;
    };
  }, [stars, intro]);

  useEffect(() => {
    if (interactive) worldRef.current?.setMode(mode);
  }, [mode, interactive]);
  useEffect(() => {
    worldRef.current?.setInteractive(interactive);
  }, [interactive]);
  useEffect(() => {
    worldRef.current?.setSelected(selectedId);
  }, [selectedId]);

  return (
    <div ref={hostRef} className="map">
      <div ref={labelsRef} className="map__labels" aria-hidden="true" />
    </div>
  );
});

export default StarCanvas;
