import { BRAND } from '../brand.js';

/** Símbolo + texto en Sora. Escala con el font-size del contenedor (el tamaño se controla por CSS). */
export default function Logo({ className = '' }) {
  return (
    <span className={`logo ${className}`} role="img" aria-label="AstroWave">
      <img className="logo__mark" src={BRAND.symbol} alt="" />
      <span className="logo__word" aria-hidden="true">Astro<b>Wave</b></span>
    </span>
  );
}
