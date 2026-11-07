// Funciones puras: del dato astrofísico al sonido y a la posición. Sin dependencias de React ni Three.js.

export const FREQ_RANGE = { min: 220, max: 880 };
export const SKY_RADIUS = 50;
const SPACE_SCALE = 6;
const D2R = Math.PI / 180;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Puntos de calibración (temperatura K -> Hz) tomados de la tabla de referencia del proyecto.
const FREQ_POINTS = [
  [3601.63, 247.84],
  [3902.56, 263.06],
  [5778, 430.73],
  [9458.31, 790.48],
  [9711.95, 831.2],
  [12100, 880],
];

/** Frecuencia (Hz) por interpolación lineal entre puntos de calibración. */
export function frequencyFromTemperature(tempK) {
  if (tempK <= FREQ_POINTS[0][0]) return FREQ_POINTS[0][1];
  for (let i = 1; i < FREQ_POINTS.length; i++) {
    const [t1, f1] = FREQ_POINTS[i];
    if (tempK <= t1) {
      const [t0, f0] = FREQ_POINTS[i - 1];
      return f0 + ((tempK - t0) / (t1 - t0)) * (f1 - f0);
    }
  }
  return FREQ_RANGE.max;
}

/** Mezcla húmeda del eco (0.1-0.6): menor paralaje (más lejos) = más eco. Ajuste logarítmico a la tabla. */
export function wetMixFromParallax(parallaxMas) {
  return clamp(0.5979 - 0.35 * (Math.log10(parallaxMas) - Math.log10(3.78)), 0.1, 0.6);
}

/** Compensación de sonoridad: 100 % a 220 Hz, 15 % a 880 Hz. */
export function loudnessGain(freqHz) {
  const t = (freqHz - FREQ_RANGE.min) / (FREQ_RANGE.max - FREQ_RANGE.min);
  return clamp(1 - 0.85 * t, 0.15, 1);
}

/** Forma de onda según la clase espectral (O,B / A,F / G / K,M). */
export function waveformFromSpectralType(spectralType) {
  const cls = spectralType.trim()[0].toUpperCase();
  if ('OB'.includes(cls)) return { oscillator: 'sawtooth', label: 'Dientes de sierra' };
  if ('AF'.includes(cls)) return { oscillator: 'square', label: 'Cuadrada' };
  if (cls === 'G') return { oscillator: 'triangle', label: 'Triangular' };
  return { oscillator: 'sine', label: 'Sinusoidal' };
}

export function colorFromTemperature(tempK) {
  if (tempK < 3800) return '#ff8a6a';
  if (tempK < 5000) return '#ffb070';
  if (tempK < 6500) return '#ffd27a';
  if (tempK < 8500) return '#f6f2ff';
  if (tempK < 11000) return '#e4ecff';
  return '#9bb0ff';
}

/** Vector unitario (RA/Dec en grados). Eje Y hacia arriba, como en Three.js. */
export function directionFromRaDec(raDeg, decDeg) {
  const ra = raDeg * D2R;
  const dec = decDeg * D2R;
  return [Math.cos(dec) * Math.cos(ra), Math.sin(dec), -Math.cos(dec) * Math.sin(ra)];
}

/** Agrega al registro crudo todo lo derivado que necesita la interfaz. */
export function enrichStar(raw) {
  const frequencyHz = frequencyFromTemperature(raw.temperatureK);
  const distancePc = raw.isLocal ? 0 : 1000 / raw.parallaxMas;
  const dir = directionFromRaDec(raw.raDeg, raw.decDeg);
  // La distancia se comprime (raíz cuadrada) para que Sirius y Rigel convivan en pantalla.
  const spaceRadius = SPACE_SCALE * Math.sqrt(distancePc);
  return {
    ...raw,
    frequencyHz,
    wetMix: wetMixFromParallax(raw.parallaxMas),
    gain: loudnessGain(frequencyHz),
    waveform: waveformFromSpectralType(raw.spectralType),
    distancePc,
    color: colorFromTemperature(raw.temperatureK),
    skyPos: dir.map((c) => c * SKY_RADIUS),
    spacePos: dir.map((c) => c * spaceRadius),
  };
}
