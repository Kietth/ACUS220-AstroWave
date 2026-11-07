// Viaje por el espacio de la introducción (portado de space_video.html).
// Escena autónoma con su propio renderer: se destruye al terminar para liberar la GPU.
import * as THREE from 'three';
import { LIGHT_SCALE, OUTPUT_COLOR_SPACE } from './legacyColor.js';

const VMAX = 400;
const END_T = 22; // "tiempo de película" (2x el real): ~11 s. Las escenas vacías finales se recortan.
const speedAt = (t) => {
  if (t < 4) return VMAX * (t / 4) ** 2;
  if (t < 14) return VMAX;
  if (t < 20) return VMAX * (1 - (t - 14) / 6) ** 2;
  return 0;
};

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

const STAR_VS = 'varying vec3 vN;varying vec3 vP;void main(){vN=normalize(normalMatrix*normal);vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
const STAR_FS = `precision highp float;varying vec3 vN;varying vec3 vP;uniform vec3 col;uniform float time;
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
 gl_FragColor=vec4(c,1.0);}`;

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

export class FlightScene {
  constructor({ canvas, onEnd }) {
    this.onEnd = onEnd;
    this.t = 0;
    this.camZ = 0;
    this.ended = false;
    this.disposed = false;
    this.starMaterials = [];

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = OUTPUT_COLOR_SPACE;
    this.renderer.setClearColor(0x000000, 1);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.5, 4000);

    this.scene.add(new THREE.AmbientLight(0x303850, 0.6 * LIGHT_SCALE));
    const sun = new THREE.DirectionalLight(0xfff0dd, 1.6 * LIGHT_SCALE);
    sun.position.set(1, 0.6, 0.8);
    this.scene.add(sun);

    this.glow = glowTexture();
    this.objects = DEFS.map((d, i) => this.buildObject(d, i));

    this.abort = new AbortController();
    window.addEventListener('resize', () => this.resize(), { signal: this.abort.signal });
    this.resize();
    this.last = performance.now();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  buildObject(d, i) {
    let mesh;
    if (d.kind === 'planet') {
      mesh = new THREE.Mesh(
        new THREE.SphereGeometry(d.r, 48, 32),
        new THREE.MeshStandardMaterial({ map: planetTexture(d.cols, d.bands, i * 77 + 13), roughness: 0.9 }),
      );
      if (d.ring) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(d.r * 1.4, d.r * 2.2, 64),
          new THREE.MeshBasicMaterial({ color: 0xc8b48c, side: THREE.DoubleSide, transparent: true, opacity: 0.55 }),
        );
        ring.rotation.x = Math.PI / 2.4;
        mesh.add(ring);
      }
    } else {
      const material = new THREE.ShaderMaterial({
        vertexShader: STAR_VS,
        fragmentShader: STAR_FS,
        uniforms: { col: { value: new THREE.Color(d.color) }, time: { value: 0 } },
      });
      this.starMaterials.push(material);
      mesh = new THREE.Mesh(new THREE.SphereGeometry(d.r, 64, 48), material);
      [[3.4, 0.9], [7, 0.5], [15, 0.22]].forEach(([scale, opacity]) => {
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: this.glow, color: d.color, blending: THREE.AdditiveBlending, transparent: true, opacity, depthWrite: false }),
        );
        sprite.scale.setScalar(d.r * scale);
        mesh.add(sprite);
      });
    }
    mesh.position.set(d.x, d.y, d.z);
    this.scene.add(mesh);
    return mesh;
  }

  resize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  loop(now) {
    this.raf = requestAnimationFrame(this.loop);
    // El tiempo se acumula: si la pestaña se oculta, el vuelo se pausa en vez de saltarse.
    const dt = Math.min((now - this.last) / 1000, 0.05) * 2;
    this.last = now;
    this.t += dt;
    const t = this.t;
    const v = speedAt(t);
    this.camZ -= v * dt;

    const cam = this.camera;
    cam.position.set(Math.sin(t * 0.6) * 1.2, Math.cos(t * 0.45) * 0.8, this.camZ);
    cam.rotation.z = Math.sin(t * 0.3) * 0.02 * (v / VMAX);
    cam.lookAt(cam.position.x * 0.5, cam.position.y * 0.5, this.camZ - 100);

    this.objects.forEach((o, i) => {
      if (DEFS[i].kind === 'planet') o.rotation.y += dt * (0.05 + i * 0.01);
    });
    this.starMaterials.forEach((m) => (m.uniforms.time.value = t));
    this.renderer.render(this.scene, cam);

    if (t >= END_T && !this.ended) {
      this.ended = true;
      this.onEnd?.();
    }
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.abort.abort();
    this.scene.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) {
        o.material.map?.dispose();
        o.material.dispose();
      }
    });
    this.glow.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss(); // libera el contexto WebGL de inmediato
  }
}
