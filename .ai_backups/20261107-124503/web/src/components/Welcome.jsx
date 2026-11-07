import { BRAND } from '../brand.js';

/** Pantalla de bienvenida sobre el mapa: logo, frase y llamada a la acción. */
export default function Welcome({ leaving, onExplore }) {
  return (
    <section className={`welcome ${leaving ? 'is-leaving' : ''}`} aria-labelledby="welcome-lead">
      <h1 className="welcome__logo">
        <img src={BRAND.logo} alt="AstroWave" width="560" />
      </h1>
      <p id="welcome-lead" className="welcome__lead">Escucha cómo suenan las estrellas.</p>
      <p className="welcome__sub">Temperatura, paralaje y tipo espectral de estrellas reales, convertidos en sonido.</p>
      <button className="btn btn--primary welcome__cta" onClick={onExplore} autoFocus>Explorar</button>
    </section>
  );
}
