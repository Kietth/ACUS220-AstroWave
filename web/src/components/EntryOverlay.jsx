export default function EntryOverlay({ onEnter }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="entry-title">
      <div className="overlay__body">
        <span className="muted">Universidad Austral de Chile · ACUS220</span>
        <h1 id="entry-title" className="overlay__title">Astro<br />Wave</h1>
        <p className="overlay__lead">
          Elige una estrella y escucha cómo suena su temperatura, su tipo espectral y su distancia.
          El audio solo comienza con tu clic.
        </p>
        <div className="row">
          <button className="btn btn--primary" onClick={() => onEnter(true)} autoFocus>Entrar y activar audio</button>
          <button className="btn" onClick={() => onEnter(false)}>Entrar en silencio</button>
        </div>
      </div>
    </div>
  );
}
