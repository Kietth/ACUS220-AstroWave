// Mundo 3D único: viaje de introducción y mapa estelar comparten escena, cámara y renderer.
// Así saltar, terminar o explorar nunca produce un corte: todo es una sola cámara en movimiento.
//
// Estructura:
//  - flight: planetas y estrellas del viaje, en coordenadas absolutas del mundo.
//  - rig: cielo del mapa (estrellas de fondo, catálogo, anillos). Sigue a la cámara (this.anchor),
//    por eso las estrellas están presentes durante todo el viaje, como un cielo infinito.
import * as THREE from 'three';
import { LIGHT_SCALE, OUTPUT_COLOR_SPACE } from './legacyColor.js';
import { SKY_RADIUS } from '../domain/starMath.js';

const DEG = Math.PI / 180;
const DEFAULT_VIEW = { yaw: 80 * DEG, pitch: 0, fov: 60, dist: 220 };
const FLIGHT_VIEW = { yaw: 90 * DEG, pitch: 0, fov: 70, dist: 220 }; // yaw 90° = mirar hacia -Z
const LIMITS = { fov: [25, 90], dist: [60, 700] };
const STAR_ALPHA_FLIGHT = 0.6;

// Línea de tiempo del viaje (segundos reales).
const VMAX = 800; // unidades por segundo
const T = { accel: 1.6, cruise: 4.7, decel: 2.6, welcome: 6.7 };
const T_END = T.accel + T.cruise + T.decel;
const BRAKE_S = 1.2; // frenado al saltar
const speedAt = (t) => {
  if (t < T.accel) return VMAX * (t / T.accel) ** 2;
  if (t < T.accel + T.cruise) return VMAX;
  return VMAX * (1 - (t - T.accel - T.cruise) / T.decel) ** 2;
};

const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));
const wrapAngle = (a) => ((((a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

// ---- Objetos del viaje ----
const planet = (z, x, y, r, cols, bands, ring) => ({ kind: 'planet', z, x, y, r, cols, bands, ring });
const star = (z, x, y, r, color) => ({ kind: 'star', z, x, y, r, color });
const DEFS = [
  planet(-450, -75, 15, 30, ['#c9774a', '#a85a35', '#e0a070'], 14),
  star(-800, 120, -20, 45, 0xffd27a),
  planet(-1100, 105, -30, 50, ['#d9c08a', '#bfa06a', '#efe0b8', '#a88a55'], 22, true),
  star(-1500, -130, 40, 70, 0xa8c8ff),
  star(-1950, 95, 55, 40, 0xff9a45),
  star(-2350, -100, -45, 85, 0xff5a2a),
  planet(-2750, 90, 25, 28, ['#8a8a8a', '#6d6d6d', '#aaaaaa'], 10),
  star(-3150, -120, 10, 55, 0xfff4e0),
  planet(-3500, -100, -10, 65, ['#7ac2b0', '#4f9a8c', '#a8e0d0', '#2f7468'], 18),
  star(-3900, 130, -35, 95, 0xffc060),
  planet(-4250, 115, 15, 60, ['#b5543c', '#8a3a2a', '#d98a5a', '#e8b080'], 16, true),
  star(-4600, -90, 20, 40, 0xff8a50),
];

const SURFACE_VS = 'varying vec3 vN;varying vec3 vP;void main(){vN=normalize(normalMatrix*normal);vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
const SURFACE_FS = `precision highp float;varying vec3 vN;varying vec3 vP;uniform vec3 col;uniform float time;uniform float uAlpha;
float h(vec3 p){p=fract(p*0.3183099+.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float n(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.0-2.0*f);
return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);}
void main(){
 vec3 q=normalize(vP)*3.0;
 float g=n(q*2.0+time*.15)*.5+n(q*5.0-time*.2)*.3+n(q*11.0+time*.3)*.2;
 float d=clamp(dot(normalize(vN),vec3(0,0,1)),0.0,1.0);
 float limb=pow(d,.45);
 vec3 c=mix(col*.55,col*1.35+vec3(.25),g);
 c*=mix(.35,1.25,limb);
 c+=col*pow(1.0-d,3.0)*.25;
 gl_FragColor=vec4(c,uAlpha);}`;

// ---- Catálogo (puntos que se mezclan entre esfera celeste y vecindad 3D) ----
const CATALOG_VS = `
attribute vec3 aSky; attribute vec3 aSpace; attribute vec3 aColor; attribute float aSize;
uniform float uMix; uniform float uPx; varying vec3 vColor;
void main(){
  vColor = aColor;
  vec3 p = mix(aSky, aSpace, uMix);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = aSize * uPx;
}`;
const CATALOG_FS = `
varying vec3 vColor; uniform float uAlpha;
void main(){
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  float a = smoothstep(1.0, 0.0, d);
  gl_FragColor = vec4(vColor * (0.4 + 0.9 * a * a), a * uAlpha);
}`;

// ---- Estrellas de fondo ----
const BACKDROP_VS = `
attribute float aSize; attribute float aBright; uniform float uPx; varying float vB;
void main(){ vB = aBright; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uPx; }`;
const BACKDROP_FS = `
varying float vB; uniform float uAlpha;
void main(){
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  float a = smoothstep(1.0, 0.0, d);
  gl_FragColor = vec4(vec3(0.78, 0.84, 1.0) * vB, a * uAlpha * vB);
}`;

function planetTexture(cols, bands, seed) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');
  let s = seed;
  const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < bands; i++) {
    g.fillStyle = cols[Math.floor(rnd() * cols.length)];
    g.fillRect(0, (i * 256) / bands, 512, 256 / bands + 1);
  }
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(${rnd() > 0.5 ? '255,255,255' : '0,0,0'},${rnd() * 0.12})`;
    g.beginPath();
    g.ellipse(rnd() * 512, rnd() * 256, rnd() * 50 + 6, rnd() * 8 + 2, 0, 0, 7);
    g.fill();
  }
  return new THREE.CanvasTexture(c);
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25, 'rgba(255,255,255,.45)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export class World {
  constructor({ canvas, labelLayer, stars, onSelect, onSettle, reducedMotion = false }) {
    Object.assign(this, { canvas, labelLayer, stars, onSelect, onSettle, reducedMotion });
    this.view = { ...FLIGHT_VIEW };
    this.mix = 0;
    this.starAlpha = STAR_ALPHA_FLIGHT;
    this.flightAlpha = 1;
    this.appliedFlightAlpha = -1;
    this.drift = false;
    this.exploring = false;
    this.interactive = false;
    this.tweens = [];
    this.goto = null;
    this.selectedId = null;
    this.hoveredId = null;
    this.drag = null;
    this.pointers = new Map();
    this.pinch = null;
    this.anchor = new THREE.Vector3();
    this.time = 0;
    this.fl = { state: 'done', t: 0, v: 0, v0: 0, s: 0, settled: true };
    this.tmpA = new THREE.Vector3();
    this.tmpB = new THREE.Vector3();

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = OUTPUT_COLOR_SPACE;
    this.renderer.setClearColor(0x000000, 1);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.5, 6000);
    this.rig = new THREE.Group();
    this.scene.add(this.rig);
    this.scene.add(new THREE.AmbientLight(0x303850, 0.6 * LIGHT_SCALE));
    const sun = new THREE.DirectionalLight(0xfff0dd, 1.6 * LIGHT_SCALE);
    sun.position.set(1, 0.6, 0.8);
    this.scene.add(sun);

    this.buildFlight();
    this.buildBackdrop();
    this.buildStars();
    this.equator = this.buildRing(SKY_RADIUS, 0x3a3f66);
    this.rings = [5, 25, 100, 250].map((pc) => this.buildRing(6 * Math.sqrt(pc), 0x2a2e4d));
    this.buildLabels();
    this.bindEvents();
    this.resize();
    this.lastT = performance.now();
    this.tick = this.tick.bind(this);
    this.raf = requestAnimationFrame(this.tick);
  }

  // ================= API pública =================

  /** 'flight' = viaje completo; 'idle' = directo a la bienvenida (visitante que repite o sin animaciones). */
  start(intro) {
    if (intro === 'flight' && !this.reducedMotion) {
      this.fl = { state: 'running', t: 0, v: 0, v0: 0, s: 0, settled: false };
      return;
    }
    this.flightAlpha = 0;
    this.starAlpha = 0;
    this.tween(this, 'starAlpha', STAR_ALPHA_FLIGHT, 1400);
    this.drift = !this.reducedMotion;
  }

  /** Frena suavemente en lugar de cortar. Es idempotente. */
  skipFlight() {
    const F = this.fl;
    if (F.state !== 'running') return;
    F.state = 'braking';
    F.v0 = F.v;
    F.s = 0;
    this.settle();
    this.tween(this, 'flightAlpha', 0, BRAKE_S * 1000);
  }

  /** La cámara se acomoda a la vista del mapa y el catálogo pasa a brillo completo. */
  explore(onArrive) {
    this.skipFlight();
    this.exploring = true;
    this.drift = false;
    this.goto = null;
    const ms = 1900;
    const v = DEFAULT_VIEW;
    this.tween(this.view, 'yaw', this.view.yaw + wrapAngle(v.yaw - this.view.yaw), ms);
    this.tween(this.view, 'pitch', v.pitch, ms);
    this.tween(this.view, 'fov', v.fov, ms);
    this.tween(this.view, 'dist', v.dist, ms);
    this.tween(this, 'starAlpha', 1, 1500, { delay: 350, onDone: onArrive });
  }

  setMode(mode, ms = 1400) {
    this.tween(this, 'mix', mode === 'space' ? 1 : 0, ms);
  }

  setInteractive(value) {
    this.interactive = value;
    this.canvas.style.cursor = value ? 'grab' : 'default';
    if (!value) {
      this.drag = null;
      this.pointers.clear();
      this.hoveredId = null;
    }
  }

  setSelected(id) {
    this.selectedId = id;
    const star = this.stars.find((s) => s.id === id);
    if (star && this.interactive && this.mix === 0) {
      const [x, y, z] = star.skyPos;
      this.goto = { yaw: Math.atan2(-z, x), pitch: Math.asin(y / SKY_RADIUS) };
    }
  }

  zoom(factor) {
    if (this.mix > 0.5) this.view.dist = clamp(this.view.dist * factor, LIMITS.dist);
    else this.view.fov = clamp(this.view.fov * factor, LIMITS.fov);
  }

  resetView() {
    Object.assign(this.view, DEFAULT_VIEW);
    this.goto = null;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.abort.abort();
    this.resizeObserver.disconnect();
    this.scene.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) {
        o.material.map?.dispose();
        o.material.dispose();
      }
    });
    this.glow.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.labelLayer.replaceChildren();
  }

  // ================= Animaciones por tiempo =================
  tween(obj, key, to, ms, { delay = 0, onDone } = {}) {
    this.tweens = this.tweens.filter((t) => !(t.obj === obj && t.key === key));
    if (this.reducedMotion || ms <= 0) {
      obj[key] = to;
      onDone?.();
      return;
    }
    this.tweens.push({ obj, key, from: obj[key], to, t0: performance.now() + delay, ms, onDone });
  }

  runTweens(now) {
    const done = [];
    for (const t of this.tweens) {
      if (now < t.t0) continue;
      const k = Math.min(1, (now - t.t0) / t.ms);
      t.obj[t.key] = t.from + (t.to - t.from) * easeInOut(k);
      if (k >= 1) done.push(t);
    }
    if (done.length) {
      this.tweens = this.tweens.filter((t) => !done.includes(t));
      done.forEach((t) => t.onDone?.());
    }
  }

  // ================= Viaje =================
  settle() {
    if (this.fl.settled) return;
    this.fl.settled = true;
    this.onSettle?.();
  }

  finishFlight() {
    const F = this.fl;
    F.state = 'done';
    F.v = 0;
    this.settle();
    this.drift = !this.reducedMotion && !this.exploring;
    this.tween(this, 'flightAlpha', 0, 500); // ya quedó atrás: se desvanece sin que se note
  }

  stepFlight(dt) {
    const F = this.fl;
    if (F.state === 'running') {
      F.t += dt;
      F.v = speedAt(F.t);
      if (!F.settled && F.t >= T.welcome) this.settle(); // la bienvenida entra mientras aún frena
      if (F.t >= T_END) this.finishFlight();
    } else if (F.state === 'braking') {
      F.s += dt / BRAKE_S;
      F.v = F.v0 * (1 - Math.min(F.s, 1)) ** 2;
      if (F.s >= 1) this.finishFlight();
    } else {
      return;
    }
    this.anchor.z -= F.v * dt;
    this.anchor.x = Math.sin(this.time * 1.2) * 1.2;
    this.anchor.y = Math.cos(this.time * 0.9) * 0.8;
  }

  applyFlightAlpha(a) {
    for (const { mat, base, uniform } of this.fade) {
      if (uniform) mat.uniforms.uAlpha.value = a;
      else mat.opacity = base * a;
    }
    this.flight.visible = a > 0.003;
    this.appliedFlightAlpha = a;
  }

  // ================= Construcción =================
  buildFlight() {
    this.flight = new THREE.Group();
    this.scene.add(this.flight);
    this.fade = [];
    this.spinners = [];
    this.starMats = [];
    this.glow = glowTexture();
    const track = (mat, base = 1) => {
      mat.transparent = true;
      mat.opacity = base;
      this.fade.push({ mat, base });
      return mat;
    };
    DEFS.forEach((d, i) => {
      let mesh;
      if (d.kind === 'planet') {
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(d.r, 48, 32),
          track(new THREE.MeshStandardMaterial({ map: planetTexture(d.cols, d.bands, i * 77 + 13), roughness: 0.9 })),
        );
        this.spinners.push({ mesh, speed: 0.05 + i * 0.01 });
        if (d.ring) {
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(d.r * 1.4, d.r * 2.2, 64),
            track(new THREE.MeshBasicMaterial({ color: 0xc8b48c, side: THREE.DoubleSide }), 0.55),
          );
          ring.rotation.x = Math.PI / 2.4;
          mesh.add(ring);
        }
      } else {
        const mat = new THREE.ShaderMaterial({
          vertexShader: SURFACE_VS,
          fragmentShader: SURFACE_FS,
          transparent: true,
          uniforms: { col: { value: new THREE.Color(d.color) }, time: { value: 0 }, uAlpha: { value: 1 } },
        });
        this.starMats.push(mat);
        this.fade.push({ mat, uniform: true });
        mesh = new THREE.Mesh(new THREE.SphereGeometry(d.r, 64, 48), mat);
        [[3.4, 0.9], [7, 0.5], [15, 0.22]].forEach(([scale, opacity]) => {
          const sprite = new THREE.Sprite(
            track(new THREE.SpriteMaterial({ map: this.glow, color: d.color, blending: THREE.AdditiveBlending, depthWrite: false }), opacity),
          );
          sprite.scale.setScalar(d.r * scale);
          mesh.add(sprite);
        });
      }
      mesh.position.set(d.x, d.y, d.z);
      this.flight.add(mesh);
    });
  }

  buildBackdrop() {
    const n = 2600;
    const pos = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const bright = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1;
      const phi = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      pos.set([r * Math.cos(phi) * 1200, u * 1200, r * Math.sin(phi) * 1200], i * 3);
      const k = Math.random();
      size[i] = 1.4 + k * k * 2.4;
      bright[i] = 0.35 + 0.65 * Math.random() ** 1.5;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aBright', new THREE.BufferAttribute(bright, 1));
    this.backdropUniforms = { uAlpha: { value: 1 }, uPx: { value: this.renderer.getPixelRatio() } };
    const points = new THREE.Points(
      geo,
      new THREE.ShaderMaterial({
        uniforms: this.backdropUniforms,
        vertexShader: BACKDROP_VS,
        fragmentShader: BACKDROP_FS,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    points.frustumCulled = false;
    this.rig.add(points);
  }

  buildStars() {
    const n = this.stars.length;
    const sky = new Float32Array(n * 3);
    const space = new Float32Array(n * 3);
    const color = new Float32Array(n * 3);
    this.stars.forEach((s, i) => {
      sky.set(s.skyPos, i * 3);
      space.set(s.spacePos, i * 3);
      new THREE.Color(s.color).toArray(color, i * 3);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(sky, 3));
    geo.setAttribute('aSky', new THREE.BufferAttribute(sky, 3));
    geo.setAttribute('aSpace', new THREE.BufferAttribute(space, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(n).fill(15), 1));
    this.uniforms = { uMix: { value: 0 }, uAlpha: { value: 1 }, uPx: { value: this.renderer.getPixelRatio() } };
    const points = new THREE.Points(
      geo,
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: CATALOG_VS,
        fragmentShader: CATALOG_FS,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    points.frustumCulled = false; // la posición real cambia en el shader
    this.rig.add(points);
  }

  buildRing(radius, color) {
    const pts = Array.from({ length: 128 }, (_, i) => {
      const a = (i / 128) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius);
    });
    const line = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0 }),
    );
    this.rig.add(line);
    return line;
  }

  buildLabels() {
    this.labels = new Map(
      this.stars.map((s) => {
        const el = document.createElement('div');
        el.className = 'star-label';
        el.textContent = s.name;
        this.labelLayer.appendChild(el);
        return [s.id, el];
      }),
    );
    this.ring = document.createElement('div');
    this.ring.className = 'star-ring';
    this.labelLayer.appendChild(this.ring);
  }

  // ================= Entrada del usuario =================
  pinchDistance() {
    const [a, b] = [...this.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  bindEvents() {
    this.abort = new AbortController();
    const opts = { signal: this.abort.signal };
    const c = this.canvas;

    c.addEventListener('pointerdown', (e) => {
      if (this.fl.state === 'running') return this.skipFlight(); // un clic en cualquier parte salta el viaje
      if (!this.interactive) return undefined;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 1) {
        this.drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY };
      } else {
        this.drag = null;
        this.pinch = this.pinchDistance();
      }
      c.setPointerCapture(e.pointerId);
      this.goto = null;
      return undefined;
    }, opts);

    c.addEventListener('pointermove', (e) => {
      if (!this.interactive) return;
      if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) {
        const d = this.pinchDistance();
        if (this.pinch) this.zoom(this.pinch / d);
        this.pinch = d;
      } else if (this.drag) {
        this.view.yaw += (e.clientX - this.drag.x) * 0.005;
        this.view.pitch = Math.max(-1.5, Math.min(1.5, this.view.pitch + (e.clientY - this.drag.y) * 0.005));
        this.drag.x = e.clientX;
        this.drag.y = e.clientY;
      } else if (e.pointerType === 'mouse') {
        this.hoveredId = this.nearest(e, 26)?.id ?? null;
        c.style.cursor = this.hoveredId ? 'pointer' : 'grab';
      }
    }, opts);

    const release = (e) => {
      const drag = this.drag;
      this.pointers.delete(e.pointerId);
      this.pinch = null;
      this.drag = null;
      if (e.type === 'pointerup' && drag && this.pointers.size === 0 && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 6) {
        const star = this.nearest(e, e.pointerType === 'touch' ? 40 : 26);
        if (star) this.onSelect(star.id);
      }
    };
    c.addEventListener('pointerup', release, opts);
    c.addEventListener('pointercancel', release, opts);

    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (this.interactive) this.zoom(Math.exp(e.deltaY * 0.001));
    }, { ...opts, passive: false });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(c.parentElement);
  }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.canvas.parentElement;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ================= Proyección y selección (O(n): para >10 000 estrellas usar índice espacial) =================
  project(star) {
    const p = this.tmpA.fromArray(star.skyPos).lerp(this.tmpB.fromArray(star.spacePos), this.mix).add(this.anchor).project(this.camera);
    return { x: ((p.x + 1) / 2) * this.canvas.clientWidth, y: ((1 - p.y) / 2) * this.canvas.clientHeight, visible: p.z < 1 };
  }

  nearest(event, radius) {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    let best = null;
    let bestDist = radius;
    for (const s of this.stars) {
      const q = this.project(s);
      const d = q.visible ? Math.hypot(q.x - x, q.y - y) : Infinity;
      if (d < bestDist) {
        bestDist = d;
        best = s;
      }
    }
    return best;
  }

  // ================= Bucle =================
  updateCamera() {
    const { yaw, pitch, fov, dist } = this.view;
    const f = new THREE.Vector3(Math.cos(pitch) * Math.cos(yaw), Math.sin(pitch), -Math.cos(pitch) * Math.sin(yaw));
    const pos = f.clone().multiplyScalar(-dist * this.mix).add(this.anchor);
    this.camera.position.copy(pos);
    this.camera.lookAt(pos.clone().addScaledVector(f, SKY_RADIUS * (1 - this.mix) + dist * this.mix));
    // En pantallas verticales el campo visual horizontal se conserva (no se recorta el cielo).
    const base = (fov * (1 - this.mix) + 55 * this.mix) * DEG;
    const a = this.camera.aspect;
    this.camera.fov = ((a < 1 ? 2 * Math.atan(Math.tan(base / 2) / a) : base) / DEG);
    this.camera.updateProjectionMatrix();
  }

  updateLabels() {
    const show = this.interactive && this.starAlpha > 0.9;
    this.labelLayer.classList.toggle('is-on', show);
    if (!show) return;
    const { clientWidth: w, clientHeight: h } = this.canvas;
    for (const s of this.stars) {
      const el = this.labels.get(s.id);
      const q = this.project(s);
      const onScreen = q.visible && q.x > 0 && q.y > 0 && q.x < w && q.y < h;
      el.style.display = onScreen ? 'block' : 'none';
      if (!onScreen) continue;
      el.style.transform = `translate(${q.x + 14}px, ${q.y - 8}px)`;
      el.classList.toggle('is-selected', s.id === this.selectedId);
      el.textContent = s.id === this.hoveredId ? `${s.name} · ${s.spectralType.split('-')[0]} · ${Math.round(s.frequencyHz)} Hz` : s.name;
      if (s.id === this.selectedId) this.ring.style.transform = `translate(${q.x}px, ${q.y}px)`;
    }
    const sel = this.stars.find((s) => s.id === this.selectedId);
    this.ring.style.display = sel && this.project(sel).visible ? 'block' : 'none';
  }

  tick() {
    this.raf = requestAnimationFrame(this.tick);
    const now = performance.now();
    const dt = Math.min((now - this.lastT) / 1000, 0.05);
    this.lastT = now;
    this.time += dt;
    this.runTweens(now);
    this.stepFlight(dt);
    if (this.drift && !this.exploring && !this.drag) this.view.yaw += dt * 0.02;

    if (this.flightAlpha !== this.appliedFlightAlpha) this.applyFlightAlpha(this.flightAlpha);
    if (this.flight.visible) {
      this.spinners.forEach((s) => (s.mesh.rotation.y += dt * 2 * s.speed));
      this.starMats.forEach((m) => (m.uniforms.time.value = this.time * 2));
    }
    this.uniforms.uMix.value = this.mix;
    this.uniforms.uAlpha.value = this.starAlpha;

    if (this.goto) {
      const dy = wrapAngle(this.goto.yaw - this.view.yaw);
      this.view.yaw += dy * 0.1;
      this.view.pitch += (this.goto.pitch - this.view.pitch) * 0.1;
      if (Math.abs(dy) < 0.002) this.goto = null;
    }
    this.rig.position.copy(this.anchor);
    this.updateCamera();
    this.equator.material.opacity = 0.5 * (1 - this.mix) * Math.max(0, this.starAlpha - STAR_ALPHA_FLIGHT) / (1 - STAR_ALPHA_FLIGHT);
    this.rings.forEach((r) => (r.material.opacity = 0.7 * this.mix * Math.max(0, this.starAlpha - STAR_ALPHA_FLIGHT) / (1 - STAR_ALPHA_FLIGHT)));
    this.renderer.render(this.scene, this.camera);
    this.updateLabels();
  }
}
