import Logo from './Logo.jsx';

/** Bienvenida sobre el mundo 3D: logo, frase y llamada a la acción. */
export default function Welcome({ leaving, onExplore }) {
  return (
    <section className={`welcome ${leaving ? 'is-leaving' : ''}`} aria-labelledby="welcome-title">
      <h1 id="welcome-title" className="welcome__logo"><Logo /></h1>
      <p className="welcome__lead">Escucha cómo suenan las estrellas.</p>
      <p className="welcome__sub">Temperatura, paralaje y tipo espectral de estrellas reales, convertidos en sonido.</p>
      <button className="btn btn--primary welcome__cta" onClick={onExplore} autoFocus>Explorar</button>
    </section>
  );
}
