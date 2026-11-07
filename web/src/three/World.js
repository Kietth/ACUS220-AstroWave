import * as THREE from 'three';
import { LIGHT_SCALE, OUTPUT_COLOR_SPACE } from './legacyColor.js';
import { SKY_RADIUS } from '../domain/starMath.js';
import { EASE, clamp01 } from '../motion.js';
import { WarpField } from './warp.js';
import { BODIES, DEG, DEST, FLIGHT_FOV, FOV_KICK, T, T_END, T_SETTLE, VMAX, depthFade, edgeFade, placeBodies, placeDest, speedAt } from './flightLayout.js';

const DEFAULT_VIEW = { yaw: 80 * DEG, pitch: 0, fov: 60, dist: 220 };
const FLIGHT_VIEW = { yaw: 90 * DEG, pitch: 0, fov: FLIGHT_FOV, dist: 220 };
const LIMITS = { fov: [25, 90], dist: [60, 700] };
const STAR_ALPHA_FLIGHT = 0.6;
const BRAKE_S = 1.5;

const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));
const wrapAngle = (a) => ((((a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;


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

// Planeta de destino (horizonte). Ruido 3D sobre la dirección de la superficie: sin costuras ni
// pinzamiento en los polos aunque la esfera sea enorme y se vea de cerca.
const DEST_VS = `varying vec3 vN; varying vec3 vP; varying vec3 vPos;
void main(){ vN = normalize(normalMatrix * normal); vP = position; vPos = (modelViewMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * vec4(vPos, 1.0); }`;
const DEST_FS = `precision highp float; varying vec3 vN; varying vec3 vP; varying vec3 vPos;
uniform vec3 col; uniform float time; uniform float uAlpha;
float h(vec3 p){p=fract(p*0.3183099+.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float n(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.0-2.0*f);
return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);}
void main(){
  vec3 d = normalize(vP);
  float g = n(d*2.2 + vec3(time*.02,0.,0.))*.55 + n(d*5.5 - vec3(0.,time*.015,0.))*.3 + n(d*13.0)*.15;
  float band = sin(d.y*7.0 + g*3.2)*.5 + .5;
  vec3 base = col * (.35 + .65*mix(g, band, .3));
  vec3 N = normalize(vN);
  float lit = smoothstep(-0.15, 0.9, dot(N, normalize(vec3(.25,.85,.45))));
  vec3 c = base * (.10 + .85*lit);
  float rim = pow(1.0 - clamp(dot(N, normalize(-vPos)), 0.0, 1.0), 4.0);
  c += col * rim * (.15 + .85*lit) * 2.2;
  gl_FragColor = vec4(c, uAlpha);
}`;
// Atmósfera: cáscara algo mayor, vista por dentro; brilla justo en el borde y se apaga hacia fuera.
const ATMO_VS = `varying vec3 vN; varying vec3 vPos;
void main(){ vN = normalize(normalMatrix * normal); vPos = (modelViewMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * vec4(vPos, 1.0); }`;
const ATMO_FS = `precision highp float; varying vec3 vN; varying vec3 vPos; uniform vec3 col; uniform float uAlpha;
void main(){
  float s = clamp(-dot(normalize(vN), normalize(-vPos)), 0.0, 1.0);
  float i = clamp(pow(s, 2.5) * 4.0, 0.0, 1.0);
  gl_FragColor = vec4(col, i * uAlpha);
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
  constructor({ canvas, labelLayer, stars, onSelect, onSettle, onArrive, reducedMotion = false }) {
    Object.assign(this, { canvas, labelLayer, stars, onSelect, onSettle, onArrive, reducedMotion });
    this.view = { ...FLIGHT_VIEW };
    this.mix = 0;
    this.starAlpha = STAR_ALPHA_FLIGHT;
    this.flightAlpha = 1;
    this.destAlpha = 1;
    this.destSink = 0;
    this.appliedDestAlpha = -1;
    this.sway = 0;
    this.swayK = 0;
    this.destBase = placeDest(16 / 9);

    this.arrive = 0;
    this.arriveApplied = -1;
    this.speedFrac = 0;
    this.kick = 0;
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

    this.renderer.setClearColor(0x05060f, 1);
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




  start(intro) {
    if (intro === 'flight' && !this.reducedMotion) {
      this.fl = { state: 'running', t: 0, v: 0, v0: 0, s: 0, settled: false };
      this.arrive = 0;
      return;
    }
    this.flightAlpha = 0;
    this.starAlpha = 0;
    this.arrive = 0;
    this.tween(this, 'starAlpha', STAR_ALPHA_FLIGHT, 1400, { ease: EASE.enter });
    this.tween(this, 'arrive', 1, 1700, { ease: EASE.linear });
    this.drift = !this.reducedMotion;
  }


  skipFlight() {
    const F = this.fl;
    if (F.state !== 'running') return;
    F.state = 'braking';
    F.v0 = F.v;
    F.s = 0;
    this.settle();
    this.tween(this, 'flightAlpha', 0, BRAKE_S * 1000, { ease: EASE.exit });
  }


  explore(onDone) {
    this.skipFlight();
    this.exploring = true;
    this.drift = false;
    this.goto = null;
    this.tween(this, 'arrive', 1, 0);
    const ms = 2000;
    const v = DEFAULT_VIEW;
    this.tween(this.view, 'yaw', this.view.yaw + wrapAngle(v.yaw - this.view.yaw), ms);
    this.tween(this.view, 'pitch', v.pitch, ms);
    this.tween(this.view, 'fov', v.fov, ms);
    this.tween(this.view, 'dist', v.dist, ms);
    this.tween(this, 'destSink', 1, 1600, { ease: EASE.inOut });
    this.tween(this, 'destAlpha', 0, 1300, { ease: EASE.inOut });
    this.tween(this, 'starAlpha', 1, 1500, { delay: 350, ease: EASE.enter, onDone });
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


  tween(obj, key, to, ms, { delay = 0, ease = EASE.inOut, onDone } = {}) {
    this.tweens = this.tweens.filter((t) => !(t.obj === obj && t.key === key));
    if (this.reducedMotion || ms <= 0) {
      obj[key] = to;
      onDone?.();
      return;
    }
    this.tweens.push({ obj, key, from: obj[key], to, t0: performance.now() + delay, ms, ease, onDone });
  }

  runTweens(now) {
    const done = [];
    for (const t of this.tweens) {
      if (now < t.t0) continue;
      const k = Math.min(1, (now - t.t0) / t.ms);
      t.obj[t.key] = t.from + (t.to - t.from) * t.ease(k);
      if (k >= 1) done.push(t);
    }
    if (done.length) {
      this.tweens = this.tweens.filter((t) => !done.includes(t));
      done.forEach((t) => t.onDone?.());
    }
  }


  settle() {
    if (this.fl.settled) return;
    this.fl.settled = true;
    this.onSettle?.();
  }

  finishFlight() {
    const F = this.fl;
    F.state = 'done';
    F.v = 0;
    this.arrive = 1;
    this.settle();
    this.drift = !this.reducedMotion && !this.exploring;
    this.tween(this, 'flightAlpha', 0, 500, { ease: EASE.exit });
  }

  stepFlight(dt) {
    const F = this.fl;
    if (F.state === 'running') {
      F.t += dt;
      F.v = speedAt(F.t);
      this.arrive = clamp01((F.t - T_SETTLE) / T.decel);
      if (!F.settled && F.t >= T_SETTLE) this.settle();
      if (F.t >= T_END) this.finishFlight();
    } else if (F.state === 'braking') {
      F.s += dt / BRAKE_S;
      F.v = F.v0 * (1 - Math.min(F.s, 1)) ** 2;
      this.arrive = Math.max(this.arrive, Math.min(F.s, 1));
      if (F.s >= 1) this.finishFlight();
    } else {
      return;
    }
    this.speedFrac = Math.min(1, F.v / VMAX);
    this.anchor.z -= F.v * dt;
    this.anchor.x = Math.sin(this.time * 1.2) * 1.2;
    this.anchor.y = Math.cos(this.time * 0.9) * 0.8;
  }

  // Opacidad de cada cuerpo de paso = desvanecimiento global × aparición por distancia × salida de cuadro.
  updateBodies() {
    const camZ = this.anchor.z;
    const tanH = Math.tan((this.camera.fov * DEG) / 2) * this.camera.aspect;
    let any = false;
    this.bodies.forEach((b) => {
      const dz = camZ - b.group.position.z;
      let a = 0;
      if (dz > 1) a = this.flightAlpha * depthFade(dz) * edgeFade((b.group.position.x - this.anchor.x) / (dz * tanH));
      if (Math.abs(a - b.alpha) >= 0.002 || b.alpha === -1) {
        b.alpha = a;
        b.group.visible = a > 0.003;
        for (const { mat, base, uniform } of b.fade) {
          if (uniform) mat.uniforms.uAlpha.value = a;
          else mat.opacity = base * a;
        }
      }
      any = any || b.group.visible;
    });
    return any;
  }

  applyDestAlpha(a) {
    for (const m of this.destMats) m.uniforms.uAlpha.value = a;
    this.dest.visible = a > 0.003;
    this.appliedDestAlpha = a;
  }

  buildFlight() {
    this.flight = new THREE.Group();
    this.scene.add(this.flight);
    this.spinners = [];
    this.starMats = [];
    this.glow = glowTexture();
    this.warp = new WarpField();
    this.warp.reset(0);
    this.scene.add(this.warp.object);

    this.bodies = BODIES.map((d, i) => {
      const fade = [];
      const track = (mat, base = 1) => {
        mat.transparent = true;
        mat.opacity = base;
        fade.push({ mat, base });
        return mat;
      };
      const group = new THREE.Group();
      if (d.kind === 'planet') {
        // El eje del planeta va inclinado hacia la cámara: así el anillo se abre (antes se veía de canto).
        group.rotation.set(d.lean, 0, d.tilt);
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(d.r, 48, 32),
          track(new THREE.MeshStandardMaterial({ map: planetTexture(d.cols, d.bands, i * 77 + 13), roughness: 0.9 })),
        );
        this.spinners.push({ mesh, speed: 0.05 + i * 0.01 });
        group.add(mesh);
        if (d.ring) {
          [[1.45, 1.85, 0.7, 0xc8b48c], [1.95, 2.3, 0.4, 0xe0d0aa]].forEach(([from, to, opacity, color]) => {
            const ring = new THREE.Mesh(
              new THREE.RingGeometry(d.r * from, d.r * to, 96),
              track(new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, depthWrite: false }), opacity),
            );
            ring.rotation.x = Math.PI / 2;
            group.add(ring);
          });
        }
      } else {
        const mat = new THREE.ShaderMaterial({
          vertexShader: SURFACE_VS,
          fragmentShader: SURFACE_FS,
          transparent: true,
          uniforms: { col: { value: new THREE.Color(d.color) }, time: { value: 0 }, uAlpha: { value: 1 } },
        });
        this.starMats.push(mat);
        fade.push({ mat, uniform: true });
        group.add(new THREE.Mesh(new THREE.SphereGeometry(d.r, 64, 48), mat));
        // Halos más contenidos que antes (3,4/7/15 × r): a corta distancia teñían toda la pantalla.
        [[2.6, 0.75], [5.2, 0.3], [9, 0.12]].forEach(([scale, opacity]) => {
          const sprite = new THREE.Sprite(
            track(new THREE.SpriteMaterial({ map: this.glow, color: d.color, blending: THREE.AdditiveBlending, depthWrite: false }), opacity),
          );
          sprite.scale.setScalar(d.r * scale);
          group.add(sprite);
        });
      }
      group.visible = false;
      this.flight.add(group);
      return { group, fade, alpha: -1 };
    });
    this.buildDest();
  }

  // Horizonte de destino: un planeta enorme que sube desde abajo mientras la nave frena.
  buildDest() {
    this.dest = new THREE.Group();
    this.scene.add(this.dest);
    const color = new THREE.Color(DEST.color);
    const surface = new THREE.ShaderMaterial({
      vertexShader: DEST_VS,
      fragmentShader: DEST_FS,
      transparent: true,
      uniforms: { col: { value: color }, time: { value: 0 }, uAlpha: { value: 1 } },
    });
    const atmosphere = new THREE.ShaderMaterial({
      vertexShader: ATMO_VS,
      fragmentShader: ATMO_FS,
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      uniforms: { col: { value: new THREE.Color(0x2dd4bf) }, uAlpha: { value: 1 } },
    });
    this.destSurface = surface;
    this.destMats = [surface, atmosphere];
    this.dest.add(new THREE.Mesh(new THREE.SphereGeometry(DEST.r, 160, 96), surface));
    this.dest.add(new THREE.Mesh(new THREE.SphereGeometry(DEST.r * 1.12, 128, 64), atmosphere));
  }

  // Coloca cuerpos y horizonte según el formato actual (se repite al redimensionar).
  layoutFlight() {
    placeBodies(this.camera.aspect).forEach((p, i) => this.bodies[i].group.position.set(p.x, p.y, p.z));
    this.destBase = placeDest(this.camera.aspect);
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
    points.frustumCulled = false;
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


  pinchDistance() {
    const [a, b] = [...this.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  bindEvents() {
    this.abort = new AbortController();
    const opts = { signal: this.abort.signal };
    const c = this.canvas;

    c.addEventListener('pointerdown', (e) => {
      if (this.fl.state === 'running') return this.skipFlight();
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
    this.layoutFlight();
  }


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


  updateCamera() {
    const { pitch, fov, dist } = this.view;
    const yaw = this.view.yaw + this.sway;
    const f = new THREE.Vector3(Math.cos(pitch) * Math.cos(yaw), Math.sin(pitch), -Math.cos(pitch) * Math.sin(yaw));
    const pos = f.clone().multiplyScalar(-dist * this.mix).add(this.anchor);
    this.camera.position.copy(pos);
    this.camera.lookAt(pos.clone().addScaledVector(f, SKY_RADIUS * (1 - this.mix) + dist * this.mix));

    const base = (fov * (1 - this.mix) + 55 * this.mix + this.kick * (1 - this.mix)) * DEG;
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
    this.kick += (FOV_KICK * this.speedFrac - this.kick) * Math.min(1, dt * 4);
    this.warp.update(this.speedFrac, this.anchor.z);
    if (this.arrive !== this.arriveApplied) {
      this.arriveApplied = this.arrive;
      this.onArrive?.(this.arrive);
    }
    // Balanceo suave y acotado (±2,3°) en lugar de girar sin parar: el horizonte no se va de cuadro
    // si la persona deja la bienvenida abierta.
    const swayTarget = this.drift && !this.exploring && !this.drag ? 1 : 0;
    this.swayK += (swayTarget - this.swayK) * Math.min(1, dt * 2.5);
    this.sway = Math.sin(this.time * 0.22) * 0.04 * this.swayK;

    const bodiesOn = this.updateBodies();
    if (bodiesOn) {
      this.spinners.forEach((s) => (s.mesh.rotation.y += dt * 2 * s.speed));
      this.starMats.forEach((m) => (m.uniforms.time.value = this.time * 2));
    }
    if (this.destAlpha !== this.appliedDestAlpha) this.applyDestAlpha(this.destAlpha);
    if (this.dest.visible) {
      // El horizonte va pegado a la cámara. Sube con la misma curva cúbica con la que frena la nave.
      const { y, z, rise, exit } = this.destBase;
      const lift = (1 - this.arrive) ** 3 * rise + this.destSink * exit;
      this.dest.position.set(this.anchor.x, this.anchor.y + y - lift, this.anchor.z + z);
      this.destSurface.uniforms.time.value = this.time;
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
