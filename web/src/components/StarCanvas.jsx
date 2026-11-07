import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { World } from '../three/World.js';





const StarCanvas = forwardRef(function StarCanvas({ stars, intro, mode, selectedId, onSelect, onSettle, onArrive, interactive }, ref) {
  const hostRef = useRef(null);
  const labelsRef = useRef(null);
  const worldRef = useRef(null);
  const callbacks = useRef({ onSelect, onSettle, onArrive });
  callbacks.current = { onSelect, onSettle, onArrive };

  useImperativeHandle(ref, () => ({
    explore: (onArrive) => worldRef.current?.explore(onArrive),
    skip: () => worldRef.current?.skipFlight(),
    zoom: (factor) => worldRef.current?.zoom(factor),
    resetView: () => worldRef.current?.resetView(),
  }), []);


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
      onArrive: (p) => callbacks.current.onArrive?.(p),
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
