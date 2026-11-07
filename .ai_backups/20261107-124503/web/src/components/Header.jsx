import { BRAND } from '../brand.js';

const MODES = [
  { id: 'sky', label: 'Cielo' },
  { id: 'space', label: 'Vecindad 3D' },
];

export default function Header({ mode, onModeChange, muted, onToggleMuted }) {
  return (
    <header className="topbar">
      <img className="brand" src={BRAND.logo} alt="AstroWave" height="28" />
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
