// Motor 3D del mapa, independiente de React. Modos: 'sky' (esfera celeste) y 'space' (vecindad 3D).
// Transición: cada estrella interpola entre su posición en la esfera y su posición espacial en el shader.
// Además expone la coreografía de entrada: enterIntroPose() -> revealBackdrop() -> explore().
import * as THREE from 'three';
import { OUTPUT_COLOR_SPACE } from './legacyColor.js';
import { SKY_RADIUS } from '../domain/starMath.js';

const DEFAULT_VIEW = { yaw: (80 * Math.PI) / 180, pitch: 0, fov: 60, dist: 220 };
const INTRO_VIEW = { yaw: 1.2, pitch: 0.45, fov: 60, dist: 520 };
const LIMITS = { fov: [25, 90], dist: [60, 700] };
const PICK_RADIUS_PX = 26;
const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));
const wrapAngle = (a) => ((((a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

const VERTEX = `
attribute vec3 aSky; attribute vec3 aSpace; attribute vec3 aColor; attribute float aSize;
uniform float uMix; uniform float uPx; varying vec3 vColor;
void main(){
  vColor = aColor;
  vec3 p = mix(aSky, aSpace, uMix);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = aSize * uPx;
}`;
const FRAGMENT = `
varying vec3 vColor; uniform float uAlpha;
void main(){
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  float a = smoothstep(1.0, 0.0, d);
  gl_FragColor = vec4(vColor * (0.4 + 0.9 * a * a), a * uAlpha);
}`;

export class SkyScene {
  constructor({ canvas, labelLayer, stars, onSelect, reducedMotion = false }) {
    Object.assign(this, { canvas, labelLayer, stars, onSelect, reducedMotion });
    this.view = { ...DEFAULT_VIEW };
    this.mix = 0;
    this.mixTarget = 0;
    this.starAlpha = 1;
    this.backdropAlpha = 1;
    this.drift = false;
    this.interactive = true;
    this.tweens = [];
    this.goto = null;
    this.selectedId = null;
    this.hoveredId = null;
    this.drag = null;
    this.tmpA = new THREE.Vector3();
    this.tmpB = new THREE.Vector3();

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = OUTPUT_COLOR_SPACE;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 4000);

    this.buildStars();
    this.buildBackdrop();
    this.equator = this.buildRing(SKY_RADIUS, 0x3a3f66);
    this.rings = [5, 25, 100, 250].map((pc) => this.buildRing(6 * Math.sqrt(pc), 0x2a2e4d));
    this.buildLabels();
    this.bindEvents();
    this.resize();
    this.lastT = performance.now();
    this.tick = this.tick.bind(this);
    this.raf = requestAnimationFrame(this.tick);
  }

  // ---- API pública ----
  setMode(mode, ms = 1400) {
    this.mixTarget = mode === 'space' ? 1 : 0;
    this.tween(this, 'mix', this.mixTarget, ms);
  }

  setSelected(id) {
    this.selectedId = id;
    const star = this.stars.find((s) => s.id === id);
    if (star && this.mixTarget === 0 && this.interactive) {
      const [x, y, z] = star.skyPos;
      this.goto = { yaw: Math.atan2(-z, x), pitch: Math.asin(y / SKY_RADIUS) };
    }
  }

  zoom(factor) {
    if (this.mixTarget) this.view.dist = clamp(this.view.dist * factor, LIMITS.dist);
    else this.view.fov = clamp(this.view.fov * factor, LIMITS.fov);
  }

  resetView() {
    Object.assign(this.view, DEFAULT_VIEW);
    this.goto = null;
  }

  setInteractive(value) {
    this.interactive = value;
    this.canvas.style.pointerEvents = value ? 'auto' : 'none';
    if (!value) {
      this.drag = null;
      this.hoveredId = null;
    }
  }

  /** Pose inicial: vista lejana, sin estrellas del catálogo, fondo invisible y giro lento. */
  enterIntroPose() {
    this.tweens = [];
    this.mixTarget = 1;
    this.mix = 1;
    Object.assign(this.view, INTRO_VIEW);
    this.starAlpha = 0;
    this.backdropAlpha = 0;
    this.drift = !this.reducedMotion;
    this.goto = null;
    this.setInteractive(false);
  }

  /** Del negro a los puntos blancos del fondo. */
  revealBackdrop(ms = 2200) {
    this.tween(this, 'backdropAlpha', 1, ms);
  }

  /** El plano se acerca hasta la vista del mapa y aparecen las estrellas del catálogo. */
  explore(onArrive) {
    const ms = 2600;
    const v = DEFAULT_VIEW;
    this.drift = false;
    this.goto = null;
    this.setMode('sky', ms);
    this.tween(this.view, 'yaw', this.view.yaw + wrapAngle(v.yaw - this.view.yaw), ms);
    this.tween(this.view, 'pitch', v.pitch, ms);
    this.tween(this.view, 'fov', v.fov, ms);
    this.tween(this.view, 'dist', v.dist, ms);
    this.tween(this, 'starAlpha', 1, 1600, { delay: 1000, onDone: onArrive });
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.abort.abort();
    this.resizeObserver.disconnect();
    this.scene.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.labelLayer.replaceChildren();
  }

  // ---- Animaciones por tiempo ----
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
    const finished = [];
    for (const t of this.tweens) {
      if (now < t.t0) continue;
      const k = Math.min(1, (now - t.t0) / t.ms);
      t.obj[t.key] = t.from + (t.to - t.from) * easeInOut(k);
      if (k >= 1) finished.push(t);
    }
    if (finished.length) {
      this.tweens = this.tweens.filter((t) => !finished.includes(t));
      finished.forEach((t) => t.onDone?.());
    }
  }

  // ---- Construcción ----
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
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    points.frustumCulled = false; // la posición real cambia en el shader
    this.scene.add(points);
  }

  buildBackdrop() {
    const count = 1800;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = Math.random() * 2 - 1;
      const phi = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      pos.set([r * Math.cos(phi) * 1200, u * 1200, r * Math.sin(phi) * 1200], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.backdropMaterial = new THREE.PointsMaterial({ size: 1.2, sizeAttenuation: false, color: 0x8890aa, transparent: true });
    this.scene.add(new THREE.Points(geo, this.backdropMaterial));
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
    this.scene.add(line);
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

  bindEvents() {
    this.abort = new AbortController();
    const opts = { signal: this.abort.signal };
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      this.drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY };
      c.setPointerCapture(e.pointerId);
      this.goto = null;
    }, opts);
    c.addEventListener('pointermove', (e) => {
      if (this.drag) {
        this.view.yaw += (e.clientX - this.drag.x) * 0.005;
        this.view.pitch = Math.max(-1.5, Math.min(1.5, this.view.pitch + (e.clientY - this.drag.y) * 0.005));
        this.drag.x = e.clientX;
        this.drag.y = e.clientY;
      } else {
        this.hoveredId = this.nearest(e, PICK_RADIUS_PX)?.id ?? null;
        c.style.cursor = this.hoveredId ? 'pointer' : 'grab';
      }
    }, opts);
    c.addEventListener('pointerup', (e) => {
      const moved = this.drag && Math.hypot(e.clientX - this.drag.x0, e.clientY - this.drag.y0);
      this.drag = null;
      if (moved !== null && moved < 5) {
        const star = this.nearest(e, PICK_RADIUS_PX);
        if (star) this.onSelect(star.id);
      }
    }, opts);
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoom(Math.exp(e.deltaY * 0.001));
    }, { ...opts, passive: false });
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(c.parentElement);
  }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.canvas.parentElement;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---- Proyección y selección (O(n): para >10 000 estrellas pasar a índice espacial) ----
  project(star) {
    const p = this.tmpA.fromArray(star.skyPos).lerp(this.tmpB.fromArray(star.spacePos), this.mix).project(this.camera);
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

  // ---- Bucle ----
  updateCamera() {
    const { yaw, pitch, fov, dist } = this.view;
    const f = new THREE.Vector3(Math.cos(pitch) * Math.cos(yaw), Math.sin(pitch), -Math.cos(pitch) * Math.sin(yaw));
    const pos = f.clone().multiplyScalar(-dist * this.mix);
    this.camera.position.copy(pos);
    this.camera.lookAt(pos.clone().add(f.multiplyScalar(SKY_RADIUS * (1 - this.mix) + dist * this.mix)));
    this.camera.fov = fov * (1 - this.mix) + 55 * this.mix;
    this.camera.updateProjectionMatrix();
  }

  updateLabels() {
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

  tick(now) {
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min((now - this.lastT) / 1000, 0.05);
    this.lastT = now;
    this.runTweens(performance.now());
    if (this.drift && !this.drag) this.view.yaw += dt * 0.03;

    this.uniforms.uMix.value = this.mix;
    this.uniforms.uAlpha.value = this.starAlpha;
    this.backdropMaterial.opacity = this.backdropAlpha;

    if (this.goto) {
      const dy = wrapAngle(this.goto.yaw - this.view.yaw);
      this.view.yaw += dy * 0.1;
      this.view.pitch += (this.goto.pitch - this.view.pitch) * 0.1;
      if (Math.abs(dy) < 0.002) this.goto = null;
    }
    this.updateCamera();
    this.equator.material.opacity = 0.5 * (1 - this.mix) * this.starAlpha;
    this.rings.forEach((r) => (r.material.opacity = 0.7 * this.mix * this.starAlpha));
    this.renderer.render(this.scene, this.camera);
    this.updateLabels();
  }
}
