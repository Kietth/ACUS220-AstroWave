import * as THREE from 'three';
import { clamp01 } from '../motion.js';

// Estelas de velocidad: partículas fijas en el mundo que la cámara va "devorando".
// El largo del trazo es proporcional a la velocidad, así que al frenar las estelas
// se encogen hasta volver a ser puntos: el espectador "cae" desde el vuelo hacia
// el cielo quieto sin que nada desaparezca de golpe.

const COUNT = 720;
const NEAR = 140; // distancia mínima a la cámara antes de reciclar la partícula
const FAR = 2600; // profundidad máxima de aparición
const FADE_NEAR = 260;
const FADE_FAR = 900;
const TRAIL_MAX = 46; // largo máximo del trazo (unidades de mundo) a velocidad máxima
const PALETTE = [
  [0.72, 0.84, 1.0],
  [0.9, 0.96, 1.0],
  [0.5, 0.92, 0.86], // guiño al teal de la marca
  [1.0, 0.88, 0.7], // guiño a las estrellas cálidas del vuelo
];

const smooth = (v) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};

export class WarpField {
  constructor() {
    this.pos = new Float32Array(COUNT * 3);
    this.base = new Float32Array(COUNT * 3);
    this.positions = new Float32Array(COUNT * 6);
    this.colors = new Float32Array(COUNT * 6);

    for (let i = 0; i < COUNT; i += 1) {
      const c = PALETTE[Math.floor(Math.random() ** 1.6 * PALETTE.length)];
      const b = 0.55 + 0.45 * Math.random();
      this.base.set([c[0] * b, c[1] * b, c[2] * b], i * 3);
    }

    const geometry = new THREE.BufferGeometry();
    this.positionAttr = new THREE.BufferAttribute(this.positions, 3);
    this.colorAttr = new THREE.BufferAttribute(this.colors, 3);
    geometry.setAttribute('position', this.positionAttr);
    geometry.setAttribute('color', this.colorAttr);

    this.material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.object = new THREE.LineSegments(geometry, this.material);
    this.object.frustumCulled = false;
    this.object.visible = false;
  }

  place(i, z) {
    const r = 70 + 430 * Math.random() ** 0.8;
    const a = Math.random() * Math.PI * 2;
    this.pos[i * 3] = Math.cos(a) * r;
    this.pos[i * 3 + 1] = Math.sin(a) * r;
    this.pos[i * 3 + 2] = z;
  }

  reset(camZ) {
    for (let i = 0; i < COUNT; i += 1) this.place(i, camZ - NEAR - Math.random() * FAR);
  }

  update(speedFrac, camZ) {
    const strength = clamp01(speedFrac * 1.5) * 0.9;
    this.material.opacity = strength;
    const on = strength > 0.01;
    this.object.visible = on;
    if (!on) return;

    const trail = TRAIL_MAX * speedFrac;
    for (let i = 0; i < COUNT; i += 1) {
      let z = this.pos[i * 3 + 2];
      let d = camZ - z;
      if (d < NEAR) {
        z = camZ - FAR - Math.random() * 400;
        this.place(i, z);
        d = camZ - z;
      }
      const x = this.pos[i * 3];
      const y = this.pos[i * 3 + 1];
      const fade = smooth((d - NEAR) / FADE_NEAR) * (1 - smooth((d - FADE_FAR) / (FAR - FADE_FAR)));
      const j = i * 6;
      this.positions[j] = x;
      this.positions[j + 1] = y;
      this.positions[j + 2] = z;
      this.positions[j + 3] = x;
      this.positions[j + 4] = y;
      this.positions[j + 5] = z - trail;
      this.colors[j] = this.base[i * 3] * fade;
      this.colors[j + 1] = this.base[i * 3 + 1] * fade;
      this.colors[j + 2] = this.base[i * 3 + 2] * fade;
      this.colors[j + 3] = 0;
      this.colors[j + 4] = 0;
      this.colors[j + 5] = 0;
    }
    this.positionAttr.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
  }
}
