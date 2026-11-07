// Composición del vuelo de intro. Módulo puro (sin three.js): tiempos, cámara y colocación de cuerpos.
//
// Idea: cada cuerpo se define por el INSTANTE en que es "protagonista" (t) y por DÓNDE debe estar
// en pantalla en ese instante (nx, ny en coordenadas normalizadas -1..1). A partir de ahí se calcula
// su posición en el mundo según el aspecto de la pantalla, de modo que la composición se mantiene
// en cualquier formato (móvil vertical, 16:9, ultra-ancho).

export const DEG = Math.PI / 180;

// ── Tiempos (se conservan: 6,4 s en total) ──────────────────────────────────────────────────────
export const VMAX = 800;
export const T = { accel: 1.4, cruise: 2.4, decel: 2.6 };
export const T_SETTLE = T.accel + T.cruise;
export const T_END = T_SETTLE + T.decel;

export const speedAt = (t) => {
  if (t < T.accel) return VMAX * (t / T.accel) ** 2;
  if (t < T_SETTLE) return VMAX;
  return VMAX * (1 - (t - T_SETTLE) / T.decel) ** 2;
};

// Posición z de la cámara (integral exacta de speedAt).
export const camZAt = (t) => {
  let d = (VMAX * Math.min(t, T.accel) ** 3) / (3 * T.accel ** 2);
  if (t > T.accel) d += VMAX * Math.min(t - T.accel, T.cruise);
  if (t > T_SETTLE) {
    const u = Math.min(t - T_SETTLE, T.decel) / T.decel;
    d += ((VMAX * T.decel) / 3) * (1 - (1 - u) ** 3);
  }
  return -d;
};

// ── Cámara ──────────────────────────────────────────────────────────────────────────────────────
// FOV vertical de vuelo. 46° (antes 70° + 9° de "kick"): con 70° las esferas se deformaban en
// elipses en los bordes (se veía en el sol enorme del vídeo). Por debajo de ~55° la distorsión es mínima.
export const FLIGHT_FOV = 46;
export const FOV_KICK = 4;

// Distancia (en unidades del mundo) a la que un cuerpo está exactamente en su punto (nx, ny).
export const D_REF = 520;

// Límites de formato para los que se calcula la composición: de móvil muy estrecho a ultra-ancho 2,2:1.
// Fuera de ese rango se usa el límite (los cuerpos no se alejan más hacia los extremos).
const ASPECT_MIN = 0.45;
const ASPECT_MAX = 2.2;

export function frustum(aspect, fov = FLIGHT_FOV) {
  const a = Math.min(Math.max(aspect, ASPECT_MIN), ASPECT_MAX);
  const half = Math.tan((fov * DEG) / 2);
  // La cámara trata `fov` como horizontal cuando la pantalla es vertical (ver World.updateCamera).
  return a >= 1 ? { tanH: half * a, tanV: half } : { tanH: half, tanV: half / a };
}

// ── Cuerpos de paso: un zigzag Z a través de los puntos de fuerza de la regla de tercios ─────────
// nx/ny = posición objetivo en pantalla cuando el cuerpo es protagonista (los tercios están en ±0,33).
// Alternan izquierda/derecha y arriba/abajo para que el ojo "zigzaguee" sin que nada tape a nada,
// y desde lejos todos convergen hacia el punto de fuga: líneas de guía que llevan al centro.
export const BODIES = [
  { kind: 'planet', t: 0.6, nx: -0.42, ny: 0.18, r: 50, cols: ['#c9774a', '#a85a35', '#e0a070'], bands: 14, lean: 0.28, tilt: 0.22 },
  { kind: 'star', t: 1.3, nx: 0.46, ny: -0.16, r: 58, color: 0xffd27a },
  { kind: 'planet', t: 2.0, nx: -0.5, ny: -0.2, r: 44, cols: ['#d9c08a', '#bfa06a', '#efe0b8', '#a88a55'], bands: 22, ring: true, lean: 0.55, tilt: 0.3 },
  { kind: 'star', t: 2.6, nx: 0.44, ny: 0.22, r: 54, color: 0xa8c8ff },
  { kind: 'star', t: 3.1, nx: -0.4, ny: 0.02, r: 62, color: 0xff5a2a },
];

// Aparición por distancia: los cuerpos lejanos no existen hasta que están "cerca" (como la bruma
// atmosférica). Sin esto, por perspectiva, todos se amontonan en el punto de fuga al inicio del vuelo.
export const FADE_FAR = 2300;
export const FADE_NEAR = 1500;
export const depthFade = (dist) => {
  const k = Math.min(1, Math.max(0, (FADE_FAR - dist) / (FADE_FAR - FADE_NEAR)));
  return k * k * (3 - 2 * k);
};

// Salida de cuadro: un cuerpo que ya está saliendo por el lateral se disuelve (|ndcX| de 1,0 a 1,35).
// Evita que una esfera enorme se deforme y se corte contra el borde (el "sol" del vídeo original).
export const edgeFade = (ndcX) => {
  const k = Math.min(1, Math.max(0, (Math.abs(ndcX) - 1.0) / 0.35));
  return 1 - k * k * (3 - 2 * k);
};

// Holgura mínima respecto al eje de vuelo, relativa al radio: limita cuánto se "abalanza" un cuerpo
// al pasar (con r/x = 0,28 nunca ocupa más de ~1/4 de la altura al salir de cuadro).
const clearanceOf = (d) => (d.ring ? 5 : 3.6) * d.r;

export function placeBodies(aspect) {
  const { tanH, tanV } = frustum(aspect);
  return BODIES.map((d) => {
    const side = d.nx < 0 ? -1 : 1;
    return {
      x: side * Math.max(Math.abs(d.nx) * tanH * D_REF, clearanceOf(d)),
      y: d.ny * tanV * D_REF,
      z: camZAt(d.t) - D_REF,
    };
  });
}

// ── Destino: el horizonte de un planeta que sube desde abajo durante la frenada ──────────────────
// Va pegado a la cámara (no al mundo): así su posición final no depende de dónde termine el vuelo,
// tampoco si el usuario salta la intro.
export const DEST = {
  r: 2400, // radio: tan grande que se lee como horizonte, no como una bola
  c: 2800, // distancia cámara → centro
  top: -0.4, // borde superior del casquete en pantalla (NDC). 30 % de la altura queda ocupada.
  color: 0x1a8f88,
};
// Fracción de la altura de pantalla que ocupa el horizonte (la usa el CSS: --horizon).
export const HORIZON_FRACTION = (1 + DEST.top) / 2;

// Elevación (rad, negativa = bajo el eje) del borde superior de la esfera cuyo centro está en (y, z).
const limbElevation = (y, z) => -Math.atan2(-y, -z) + Math.asin(DEST.r / Math.hypot(y, z));

export function placeDest(aspect) {
  const { tanV } = frustum(aspect);
  const elevation = Math.atan(DEST.top * tanV); // dirección (negativa) del borde superior
  const beta = Math.asin(DEST.r / DEST.c); // radio angular de la esfera
  const alpha = beta - elevation; // ángulo bajo el eje al que está el centro
  const y = -DEST.c * Math.sin(alpha);
  const z = -DEST.c * Math.cos(alpha);

  // Cuánto hay que bajarlo para que, al empezar, el borde quede fuera de cuadro (con margen para el
  // "kick" de FOV). Se calcula por formato: en vertical el horizonte está mucho más cerca de la cámara.
  const hidden = -Math.atan(tanV * 1.45);
  let lo = 0;
  let hi = 20000;
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    if (limbElevation(y - mid, z) > hidden) lo = mid;
    else hi = mid;
  }
  return { y, z, rise: hi, exit: hi * 0.8 };
}
