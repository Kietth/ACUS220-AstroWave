export default function StarCatalog({ stars, selectedId, onSelect }) {
  return (
    <nav className="panel catalog" aria-label="Catálogo de estrellas">
      <h2 className="panel__title">Catálogo · {stars.length} estrellas</h2>
      {stars.map((s) => (
        <button key={s.id} className={`catalog__item ${s.id === selectedId ? 'is-on' : ''}`} aria-pressed={s.id === selectedId} onClick={() => onSelect(s.id)}>
          <span className="dot" style={{ background: s.color }} aria-hidden="true" />
          <span className="catalog__name">
            <b>{s.name}</b>
            <span className="muted mono">{s.spectralType.split('-')[0]}</span>
          </span>
          <span className="muted mono">{Math.round(s.frequencyHz)} Hz</span>
        </button>
      ))}
    </nav>
  );
}
