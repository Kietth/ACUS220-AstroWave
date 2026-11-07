// Lenguaje de movimiento único para JS y CSS (ver también tokens.css).
// Las curvas son las de Material 3: "enter" para lo que llega, "exit" para lo que se va.

export const clamp01 = (v) => Math.min(1, Math.max(0, v));

// Resuelve una cubic-bezier(x1, y1, x2, y2) igual que lo hace CSS.
export function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t) => (3 * ax * t + 2 * bx) * t + cx;

  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i += 1) {
      const err = sampleX(t) - x;
      if (Math.abs(err) < 1e-5) return sampleY(t);
      const d = slopeX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 32; i += 1) {
      const err = sampleX(t) - x;
      if (Math.abs(err) < 1e-5) break;
      if (err > 0) hi = t;
      else lo = t;
      t = (lo + hi) / 2;
    }
    return sampleY(t);
  };
}

export const EASE = {
  linear: (k) => k,
  standard: cubicBezier(0.2, 0, 0, 1),
  enter: cubicBezier(0.05, 0.7, 0.1, 1),
  exit: cubicBezier(0.3, 0, 0.8, 0.15),
  inOut: cubicBezier(0.65, 0, 0.35, 1),
};
