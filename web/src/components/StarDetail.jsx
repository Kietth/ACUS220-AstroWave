import { FREQ_RANGE } from '../domain/starMath.js';

const pct = (v, lo, hi) => Math.min(100, Math.max(3, ((v - lo) / (hi - lo)) * 100));

function Metric({ label, value, fill }) {
  return (
    <div className="metric">
      <div className="muted">{label}</div>
      <b>{value}</b>
      {fill !== undefined && <div className="bar"><i style={{ width: `${fill}%` }} /></div>}
    </div>
  );
}

/** En pantallas pequeñas es un panel inferior que se abre con el botón «Datos» del reproductor. */
export default function StarDetail({ star, open }) {
  const distance = star.isLocal ? 'estrella local' : `${star.distancePc.toFixed(1)} pc (${(star.distancePc * 3.2616).toFixed(0)} años luz)`;
  return (
    <aside className={`panel detail ${open ? 'is-open' : ''}`} aria-live="polite">
      <div>
        <h2 className="detail__name">{star.name}</h2>
        <span className="muted">{star.spectralType} · {distance}</span>
      </div>
      <h3 className="panel__title">Del dato al sonido</h3>
      <Metric
        label={`Temperatura ${Math.round(star.temperatureK)} K → frecuencia`}
        value={`${star.frequencyHz.toFixed(2)} Hz${star.estimated ? ' (estimada)' : ''}`}
        fill={pct(star.frequencyHz, FREQ_RANGE.min, FREQ_RANGE.max)}
      />
      <Metric label={`Clase ${star.spectralType.split(/[-+/]/)[0]} → onda`} value={star.waveform.label} />
      <Metric
        label={`Paralaje ${star.parallaxMas} mas → eco`}
        value={`${Math.round(star.wetMix * 100)} % ${star.wetMix <= 0.15 ? '(audio seco)' : '(húmedo)'}`}
        fill={pct(star.wetMix, 0.1, 0.6)}
      />
      <p className="muted">Compensación de sonoridad: ganancia {Math.round(star.gain * 100)} %. Posiciones aproximadas.</p>
    </aside>
  );
}
