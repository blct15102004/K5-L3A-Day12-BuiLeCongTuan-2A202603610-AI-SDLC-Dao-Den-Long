// Procedural Web Audio API synthesizer + Night BGM (zero external assets)
export class SoundEffects {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.volume = 0.7;
    this.bgmTimer = null;
    this.bgmStep = 0;
  }

  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  tone(type, f1, f2, duration, gainLevel, delay = 0) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f1, now);
    if (f2 !== f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f2), now + duration);
    gain.gain.setValueAtTime(gainLevel, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  startBgm() {
    this.init();
    if (this.bgmTimer) return;
    // Gentle pentatonic night ambience loop (C4, D4, E4, G4, A4, C5)
    const notes = [261.63, 329.63, 392.0, 440.0, 392.0, 329.63, 293.66, 261.63];
    this.bgmTimer = setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const f = notes[this.bgmStep % notes.length];
      this.bgmStep++;
      this.tone('sine', f, f * 1.005, 1.3, 0.045);
    }, 1100);
  }

  stopBgm() {
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  playMotePickup() {
    this.tone('sine', 587.33, 880, 0.18, 0.14);
  }

  playCharmPickup() {
    this.tone('triangle', 523.25, 783.99, 0.2, 0.16, 0);
    this.tone('triangle', 783.99, 1046.5, 0.25, 0.16, 0.08);
  }

  playDeposit() {
    this.tone('sine', 440, 660, 0.15, 0.12);
  }

  playLanternLit() {
    [220, 330, 440, 554.37].forEach((freq, i) => {
      this.tone('triangle', freq, freq, 1.5, 0.18 / (i + 1));
    });
  }

  playPulse() {
    this.tone('sine', 440, 140, 0.35, 0.22);
    this.tone('triangle', 660, 220, 0.35, 0.1, 0.02);
  }

  playPlayerHit() {
    this.tone('sawtooth', 130, 42, 0.28, 0.24);
  }

  playJump() {
    this.tone('sine', 240, 420, 0.14, 0.12);
  }

  playDash() {
    this.tone('triangle', 520, 180, 0.16, 0.15);
  }

  playShadeSpawn() {
    this.tone('sawtooth', 95, 70, 0.4, 0.09);
  }

  playCountdownTick() {
    this.tone('square', 880, 880, 0.06, 0.07);
  }

  playWindWarning() {
    this.tone('sine', 300, 460, 0.6, 0.09);
  }

  playLanternOut() {
    this.tone('sine', 330, 140, 0.45, 0.14);
  }

  playWin() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
      this.tone('triangle', f, f, 0.45, 0.16, idx * 0.11);
    });
  }

  playLose() {
    [330, 293.66, 246.94, 196].forEach((f, idx) => {
      this.tone('sine', f, f * 0.96, 0.4, 0.16, idx * 0.15);
    });
  }
}
