import { describe, expect, it } from 'vitest';
import { frequencyFromTemperature, loudnessGain, waveformFromSpectralType, wetMixFromParallax } from './starMath.js';

describe('mapeo físico-acústico', () => {
  it('reproduce las frecuencias de la tabla de referencia', () => {
    expect(frequencyFromTemperature(5778)).toBeCloseTo(430.73, 2);
    expect(frequencyFromTemperature(12100)).toBeCloseTo(880, 2);
    expect(frequencyFromTemperature(20000)).toBe(880);
  });
  it('reproduce el eco de la tabla', () => {
    expect(wetMixFromParallax(48.94)).toBeCloseTo(0.2086, 3);
    expect(wetMixFromParallax(3.78)).toBeCloseTo(0.5979, 3);
    expect(wetMixFromParallax(8794.15)).toBe(0.1);
  });
  it('compensa la sonoridad entre 220 y 880 Hz', () => {
    expect(loudnessGain(220)).toBe(1);
    expect(loudnessGain(880)).toBeCloseTo(0.15, 5);
  });
  it('asigna la onda según la clase espectral', () => {
    expect(waveformFromSpectralType('B8Ia').oscillator).toBe('sawtooth');
    expect(waveformFromSpectralType('A0V').oscillator).toBe('square');
    expect(waveformFromSpectralType('G2V').oscillator).toBe('triangle');
    expect(waveformFromSpectralType('M1Ib').oscillator).toBe('sine');
  });
});
