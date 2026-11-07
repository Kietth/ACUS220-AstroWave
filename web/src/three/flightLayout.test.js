import { describe, expect, it } from 'vitest';
import { BODIES, DEST, T, T_SETTLE, camZAt, depthFade, edgeFade, placeBodies, placeDest, speedAt } from './flightLayout.js';

const ASPECTS = [390 / 844, 1, 16 / 9, 21 / 9];

describe('flightLayout', () => {
  it('camZAt es la integral de speedAt', () => {
    const marks = [1, 2, 3.8, 5, 6.4];
    const dt = 0.001;
    let z = 0;
    let t = 0;
    marks.forEach((mark) => {
      for (; t < mark - 1e-9; t += dt) z -= speedAt(t + dt / 2) * dt;
      expect(camZAt(mark)).toBeCloseTo(z, 0);
    });
    expect(camZAt(0)).toBeCloseTo(0, 6);
  });

  it('los cuerpos alternan izquierda y derecha (zigzag)', () => {
    BODIES.slice(1).forEach((b, i) => expect(Math.sign(b.nx)).toBe(-Math.sign(BODIES[i].nx)));
  });

  it('cada cuerpo pasa con holgura lateral suficiente en cualquier formato', () => {
    ASPECTS.forEach((a) => {
      placeBodies(a).forEach((p, i) => {
        const min = (BODIES[i].ring ? 5 : 3.6) * BODIES[i].r;
        expect(Math.abs(p.x)).toBeGreaterThanOrEqual(min - 1e-6);
      });
    });
  });

  it('todos los cuerpos quedan atrás cuando empieza la llegada', () => {
    placeBodies(16 / 9).forEach((p) => expect(camZAt(T_SETTLE + 0.5)).toBeLessThan(p.z));
  });

  it('la aparición por distancia y la salida de cuadro son suaves y acotadas', () => {
    expect(depthFade(3000)).toBe(0);
    expect(depthFade(1000)).toBe(1);
    expect(edgeFade(0.5)).toBe(1);
    expect(edgeFade(2)).toBe(0);
    expect(edgeFade(1.15)).toBeGreaterThan(0);
    expect(edgeFade(1.15)).toBeLessThan(1);
  });

  it('el horizonte llega con su borde en DEST.top y parte fuera de cuadro', () => {
    const elevation = (y, z) => -Math.atan2(-y, -z) + Math.asin(DEST.r / Math.hypot(y, z));
    ASPECTS.forEach((a) => {
      const { y, z, rise } = placeDest(a);
      const tanV = Math.tan((46 * Math.PI) / 360) * (a < 1 ? 1 / Math.max(a, 0.45) : 1);
      expect(Math.tan(elevation(y, z)) / tanV).toBeCloseTo(DEST.top, 2);
      expect(Math.tan(elevation(y - rise, z)) / tanV).toBeLessThan(-1);
    });
  });

  it('la llegada dura lo que la frenada', () => {
    expect(T.decel).toBeCloseTo(2.6);
  });
});
