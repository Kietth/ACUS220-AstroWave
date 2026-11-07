import { useEffect, useRef } from 'react';

export default function PlayerBar({ star, playing, engine, volume, onVolume, onToggle, onPrev, onNext }) {
  const scopeRef = useRef(null);
  const timeRef = useRef(null);

  // Osciloscopio y tiempo: se dibujan fuera del ciclo de React para no re-renderizar a 60 fps.
  useEffect(() => {
    const canvas = scopeRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.clientWidth * 2;
    canvas.height = canvas.clientHeight * 2;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!playing) return undefined;
    let raf;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const data = new Uint8Array(engine.analyser.fftSize);
      engine.analyser.getByteTimeDomainData(data);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#3dd6c6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < data.length; i += 2) {
        const x = (i / data.length) * canvas.width;
        const y = (data[i] / 255) * canvas.height;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
      timeRef.current.textContent = `${engine.elapsedS.toFixed(1)} / 4.0 s`;
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [playing, engine]);

  return (
    <footer className="player">
      <button className="btn btn--icon" aria-label="Anterior" onClick={onPrev}>‹</button>
      <button className="btn btn--primary btn--round" aria-label={playing ? 'Detener' : 'Reproducir'} onClick={onToggle}>
        {playing ? 'II' : '▶'}
      </button>
      <button className="btn btn--icon" aria-label="Siguiente" onClick={onNext}>›</button>
      <div className="player__info">
        <b>{star.name}</b>
        <span className="muted mono">{star.waveform.label} · {Math.round(star.frequencyHz)} Hz</span>
      </div>
      <canvas ref={scopeRef} className="player__scope" aria-hidden="true" />
      <span ref={timeRef} className="muted mono hide-sm">0.0 / 4.0 s</span>
      <label className="muted hide-sm">
        Volumen{' '}
        <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => onVolume(Number(e.target.value))} />
      </label>
    </footer>
  );
}
