// All sound is synthesized with WebAudio — no audio files.
// Engine hum, siren, pickup chime, gunshot, footsteps-free ambience and a
// looping bassline (a simple step sequencer over a low square/saw voice).
export function createAudio() {
  let ctx = null, master = null, engineOsc = null, engineGain = null;
  let sirenOsc = null, sirenGain = null, sirenLfo = null;
  let musicTimer = null, muted = false, musicOn = true;
  const bassNotes = [55, 0, 55, 65.41, 55, 0, 49, 58.27, 55, 0, 55, 65.41, 73.42, 65.41, 58.27, 49];
  let step = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ctx.destination);
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 50;
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 320;
      engineOsc.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator(); sirenOsc.type = 'sine'; sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
      sirenLfo = ctx.createOscillator(); sirenLfo.type = 'square'; sirenLfo.frequency.value = 0.6;
      const lfoGain = ctx.createGain(); lfoGain.gain.value = 220;
      sirenLfo.connect(lfoGain); lfoGain.connect(sirenOsc.frequency);
      sirenOsc.connect(sirenGain); sirenGain.connect(master);
      sirenOsc.start(); sirenLfo.start();
    } catch { return false; }
    return true;
  }
  function resume() { if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {}); }
  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol || 0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noiseBurst(dur, vol) {
    if (!ensure()) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = vol || 0.3;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800;
    src.connect(f); f.connect(g); g.connect(master); src.start();
  }
  function startMusic() {
    if (musicTimer || !musicOn) return;
    musicTimer = window.setInterval(() => {
      if (!ctx || muted) { step = (step + 1) % bassNotes.length; return; }
      const n = bassNotes[step % bassNotes.length]; step += 1;
      if (n) blip(n, 0.22, 'triangle', 0.16);
      if (step % 4 === 1) blip(220, 0.08, 'sine', 0.05);
    }, 240);
  }
  function stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } }
  return {
    unlock() { resume(); startMusic(); },
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.5; },
    isMuted() { return muted; },
    setEngine(speed01, on) {
      if (!ctx || !engineOsc) return;
      engineOsc.frequency.value = 45 + speed01 * 130;
      engineGain.gain.value = on ? 0.03 + speed01 * 0.05 : 0;
    },
    setSiren(on) { if (sirenGain) sirenGain.gain.value = on ? 0.045 : 0; },
    chime() { blip(880, 0.12, 'sine', 0.22); window.setTimeout(() => blip(1318, 0.2, 'sine', 0.2), 110); },
    gunshot() { noiseBurst(0.12, 0.35); blip(160, 0.1, 'square', 0.18, 60); },
    punch() { noiseBurst(0.07, 0.2); },
    crash() { noiseBurst(0.25, 0.3); blip(90, 0.25, 'sine', 0.25, 40); },
    busted() { blip(440, 0.3, 'sawtooth', 0.2, 220); window.setTimeout(() => blip(330, 0.4, 'sawtooth', 0.2, 165), 280); },
    missionDone() { [523, 659, 784, 1046].forEach((f, i) => window.setTimeout(() => blip(f, 0.18, 'sine', 0.2), i * 110)); },
    stopMusic, startMusic,
  };
}
