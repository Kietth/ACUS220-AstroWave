import { useEffect, useRef, useState } from 'react';
import Logo from './Logo.jsx';

const DOCK_MS = 820;
const DOCK_EASE = 'cubic-bezier(0.2, 0, 0, 1)';

// Al pulsar "Explorar" el logo NO desaparece: viaja hasta su lugar en la barra superior
// (transición de elemento compartido). Es el mismo objeto antes y después, solo cambia de lugar.
export default function Welcome({ leaving, armed, onExplore, onDock }) {
  const logoRef = useRef(null);
  const ctaRef = useRef(null);
  const [docked, setDocked] = useState(false);

  useEffect(() => {
    if (armed && !leaving) ctaRef.current?.focus({ preventScroll: true });
  }, [armed, leaving]);

  useEffect(() => {
    if (!leaving) return undefined;
    const host = logoRef.current;
    const target = document.querySelector('.topbar__logo');
    const word = target?.querySelector('.logo__word');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const compact = !word || getComputedStyle(word).display === 'none';
    const done = () => {
      setDocked(true);
      onDock?.();
    };

    if (!host || !target || reduced || typeof host.animate !== 'function') {
      const id = window.setTimeout(done, 0);
      return () => window.clearTimeout(id);
    }

    // Pantallas muy angostas: la barra solo muestra el símbolo, así que se desvanece en su sitio.
    if (compact) {
      const fade = host.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: DOCK_EASE, fill: 'forwards' });
      fade.finished.then(done, () => {});
      return () => fade.cancel();
    }

    const hostBox = host.getBoundingClientRect();
    const from = host.querySelector('.logo').getBoundingClientRect();
    const to = target.getBoundingClientRect();
    host.style.transformOrigin = `${from.left - hostBox.left}px ${from.top - hostBox.top}px`;
    const move = host.animate(
      [
        { transform: 'none' },
        { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width})` },
      ],
      { duration: DOCK_MS, easing: DOCK_EASE, fill: 'forwards' },
    );
    move.finished.then(done, () => {});
    return () => move.cancel();
  }, [leaving, onDock]);

  return (
    <section className={`welcome ${leaving ? 'is-leaving' : ''}`} aria-labelledby="welcome-title">
      <h1 id="welcome-title" ref={logoRef} className={`welcome__logo ${docked ? 'is-docked' : ''}`}><Logo /></h1>
      <p className="welcome__lead">Escucha cómo suenan las estrellas.</p>
      <p className="welcome__sub">Temperatura, paralaje y tipo espectral de estrellas reales, convertidos en sonido.</p>
      <button ref={ctaRef} className="btn btn--primary welcome__cta" onClick={onExplore} disabled={!armed || leaving}>Explorar</button>
    </section>
  );
}
