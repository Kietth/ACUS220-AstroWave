// Síntesis en el navegador (Web Audio). Misma cadena que generar_audio.py:
// onda base -> eco 300 ms ponderado por paralaje -> fundidos de 200 ms -> 4 s.

const DURATION_S = 4;
const FADE_S = 0.2;
const ECHO_DELAY_S = 0.3;
const ECHO_FEEDBACK = 0.4;
const HEADROOM = 0.35;

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.analyser = null;
    this.current = null;
    this.volume = 0.6;
  }

  /** Debe llamarse dentro de un gesto del usuario (política de autoplay). */
  async unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.master.connect(this.analyser).connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  /** Segundos transcurridos del clip actual (0 si no suena). */
  get elapsedS() {
    return this.current ? Math.max(0, this.ctx.currentTime - this.current.startedAt) : 0;
  }

  play(star, { onEnded } = {}) {
    if (!this.ctx) return;
    this.stop();
    const { ctx } = this;
    const t0 = ctx.currentTime + 0.03;
    const osc = ctx.createOscillator();
    osc.type = star.waveform.oscillator;
    osc.frequency.value = star.frequencyHz;

    const dry = ctx.createGain();
    const wet = ctx.createGain();
    const delay = ctx.createDelay(1);
    const feedback = ctx.createGain();
    const mix = ctx.createGain();
    const envelope = ctx.createGain();
    dry.gain.value = 1 - star.wetMix;
    wet.gain.value = star.wetMix;
    delay.delayTime.value = ECHO_DELAY_S;
    feedback.gain.value = ECHO_FEEDBACK;
    mix.gain.value = HEADROOM * star.gain;

    osc.connect(dry).connect(mix);
    osc.connect(delay);
    delay.connect(wet).connect(mix);
    delay.connect(feedback).connect(delay);
    mix.connect(envelope).connect(this.master);

    envelope.gain.setValueAtTime(0, t0);
    envelope.gain.linearRampToValueAtTime(1, t0 + FADE_S);
    envelope.gain.setValueAtTime(1, t0 + DURATION_S - FADE_S);
    envelope.gain.linearRampToValueAtTime(0, t0 + DURATION_S);

    const voice = { osc, envelope, startedAt: t0 };
    osc.onended = () => {
      envelope.disconnect();
      if (this.current === voice) {
        this.current = null;
        onEnded?.();
      }
    };
    this.current = voice;
    osc.start(t0);
    osc.stop(t0 + DURATION_S + 0.05);
  }

  stop() {
    const voice = this.current;
    if (!voice) return;
    this.current = null; // evita que el onended viejo dispare callbacks
    const t = this.ctx.currentTime;
    voice.envelope.gain.cancelScheduledValues(t);
    voice.envelope.gain.setTargetAtTime(0, t, 0.02);
    voice.osc.stop(t + 0.15);
  }

  setVolume(value) {
    this.volume = value;
    if (this.master) this.master.gain.value = value;
  }

  dispose() {
    this.stop();
    this.ctx?.close();
    this.ctx = this.master = this.analyser = null;
  }
}
