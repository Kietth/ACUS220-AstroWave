const MODES = [
  { id: 'sky', label: 'Cielo' },
  { id: 'space', label: 'Vecindad 3D' },
];

export default function Header({ mode, onModeChange, muted, onToggleMuted }) {
  return (
    <header className="topbar">
      <span className="logo">Astro<i>Wave</i></span>
      <div className="seg" role="group" aria-label="Modo de vista">
        {MODES.map((m) => (
          <button key={m.id} className={mode === m.id ? 'is-on' : ''} aria-pressed={mode === m.id} onClick={() => onModeChange(m.id)}>
            {m.label}
          </button>
        ))}
      </div>
      <span className="spacer" />
      <button className="btn" aria-pressed={!muted} onClick={onToggleMuted}>
        Sonido: {muted ? 'silencio' : 'activado'}
      </button>
    </header>
  );
}
