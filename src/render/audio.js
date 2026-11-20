// Procedural Web Audio API synthesizer, Atmospheric Night BGM, Spatial Proximity Monsters & Wind Audio (zero external assets)
export class SoundEffects {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.reverbSend = null;
    this.volume = 0.7;
    this.bgmTimer = null;
    this.bgmStep = 0;

    this.lastPickupMs = 0;
    this.pickupCombo = 0;

    // Proximity Monster Audio Nodes
    this.proxGain = null;
    this.proxOsc = null;
    this.proxPanner = null;
    this.lastCreatureSoundMs = 0;
    this.lastProxUpdateMs = 0;

    // Continuous Wind Audio Nodes (Night 3 breeze/gusts)
    this.windGain = null;
    this.windFilter = null;
    this.windSource = null;
    this.lastWindMode = -1;
  }

  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);

      // Warm twilight echo/reverb bus
      const delay = this.ctx.createDelay(1.0);
      delay.delayTime.value = 0.31;
      const damp = this.ctx.createBiquadFilter();
      damp.type = 'lowpass';
      damp.frequency.value = 1750;
      const fb = this.ctx.createGain();
      fb.gain.value = 0.34;
      const wet = this.ctx.createGain();
      wet.gain.value = 0.28;
      this.reverbSend = this.ctx.createGain();
      this.reverbSend.gain.value = 0.45;
      this.reverbSend.connect(delay);
      delay.connect(damp);
      damp.connect(fb);
      fb.connect(delay);
      damp.connect(wet);
      wet.connect(this.masterGain);

      this.initAmbientNodes();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      const p = this.ctx.resume();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
  }

  initAmbientNodes() {
    if (!this.ctx || !this.masterGain) return;
    // Spatial monster shadow aura hum (ramped silently until player nears a monster)
    this.proxOsc = this.ctx.createOscillator();
    this.proxOsc.type = 'sawtooth';
    this.proxOsc.frequency.value = 62;
    const proxFilter = this.ctx.createBiquadFilter();
    proxFilter.type = 'lowpass';
    proxFilter.frequency.value = 210;
    this.proxGain = this.ctx.createGain();
    this.proxGain.gain.value = 0;
    this.proxOsc.connect(proxFilter);
    proxFilter.connect(this.proxGain);
    if (typeof this.ctx.createStereoPanner === 'function') {
      this.proxPanner = this.ctx.createStereoPanner();
      this.proxGain.connect(this.proxPanner);
      this.proxPanner.connect(this.masterGain);
    } else {
      this.proxGain.connect(this.masterGain);
    }
    this.proxOsc.start();

    // Looped filtered white-noise buffer for expressive wind gusts
    const bufLen = this.ctx.sampleRate * 2;
    const noiseBuf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    this.windSource = this.ctx.createBufferSource();
    this.windSource.buffer = noiseBuf;
    this.windSource.loop = true;
    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 380;
    this.windFilter.Q.value = 1.6;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0;
    this.windSource.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.masterGain);
    this.windSource.start();
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  tone(type, f1, f2, duration, gainLevel, delay = 0, sendReverb = false) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f1, now);
    if (f2 !== f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f2), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainLevel, now + Math.min(0.018, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    if (sendReverb && this.reverbSend) gain.connect(this.reverbSend);
    osc.onended = () => {
      try { osc.disconnect(); gain.disconnect(); } catch {}
    };
    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  pluckedTone(freq, duration, gainLevel, delay = 0, pan = 0, sendReverb = true) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const over = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    over.type = 'sine';
    over.frequency.setValueAtTime(freq * 2.0, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(5200, freq * 5.0), now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(400, freq * 1.6), now + duration * 0.8);

    const overGain = this.ctx.createGain();
    overGain.gain.value = 0.28;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainLevel, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);

    osc.connect(filter);
    over.connect(overGain);
    overGain.connect(filter);
    filter.connect(gain);

    let panNode = null;
    if (pan !== 0 && typeof this.ctx.createStereoPanner === 'function') {
      panNode = this.ctx.createStereoPanner();
      panNode.pan.value = Math.max(-1, Math.min(1, pan));
      gain.connect(panNode);
      panNode.connect(this.masterGain);
    } else {
      gain.connect(this.masterGain);
    }
    if (sendReverb && this.reverbSend) gain.connect(this.reverbSend);

    osc.onended = () => {
      try {
        osc.disconnect();
        over.disconnect();
        overGain.disconnect();
        filter.disconnect();
        gain.disconnect();
        if (panNode) panNode.disconnect();
      } catch {}
    };
    osc.start(now);
    over.start(now);
    osc.stop(now + duration + 0.04);
    over.stop(now + duration + 0.04);
  }

  padChord(freqs, duration, gainLevel) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 680;
    const master = this.ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.linearRampToValueAtTime(gainLevel, now + duration * 0.28);
    master.gain.exponentialRampToValueAtTime(0.0008, now + duration);
    filter.connect(master);
    master.connect(this.masterGain);
    if (this.reverbSend) master.connect(this.reverbSend);

    let doneCount = 0;
    for (const f of freqs) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);
      osc.connect(filter);
      osc.onended = () => {
        try { osc.disconnect(); } catch {}
        doneCount += 1;
        if (doneCount >= freqs.length) {
          try { filter.disconnect(); master.disconnect(); } catch {}
        }
      };
      osc.start(now);
      osc.stop(now + duration + 0.05);
    }
  }

  startBgm() {
    this.init();
    if (this.bgmTimer) return;
    // Lush Genshin-inspired Moonlit Pentatonic Progression (Bm9 - Gmaj7 - Dmaj9 - A6)
    const chords = [
      [123.47, 185.00, 220.00, 293.66], // Bm7
      [98.00,  146.83, 196.00, 246.94], // Gmaj7
      [146.83, 220.00, 277.18, 329.63], // Dmaj9
      [110.00, 164.81, 220.00, 277.18]  // A6
    ];
    const arpPattern = [
      293.66, 369.99, 440.00, 587.33, 493.88, 440.00, 369.99, 329.63,
      246.94, 329.63, 392.00, 493.88, 587.33, 493.88, 392.00, 329.63,
      293.66, 369.99, 440.00, 659.25, 587.33, 554.37, 440.00, 369.99,
      277.18, 329.63, 440.00, 554.37, 659.25, 554.37, 440.00, 329.63
    ];
    const fluteMelody = [
      587.33, 0, 659.25, 739.99, 0, 880.00, 0, 739.99,
      659.25, 0, 587.33, 493.88, 0, 587.33, 0, 0,
      739.99, 0, 880.00, 987.77, 0, 880.00, 739.99, 659.25,
      554.37, 0, 587.33, 659.25, 0, 554.37, 0, 0
    ];

    this.bgmTimer = setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const step = this.bgmStep % 32;
      this.bgmStep++;

      if (step % 8 === 0) {
        const chord = chords[Math.floor(step / 8) % chords.length];
        this.padChord(chord, 3.5, 0.036);
      }

      const arpNote = arpPattern[step];
      if (arpNote > 0) {
        this.pluckedTone(arpNote, 1.35, 0.030, 0, Math.sin(step * 0.7) * 0.25, true);
      }

      const melNote = fluteMelody[step];
      if (melNote > 0) {
        this.tone('sine', melNote * 0.996, melNote, 1.15, 0.034, 0.02, true);
      }

      if (step % 16 === 6) {
        this.pluckedTone(1174.66, 0.9, 0.015, 0.14, 0.35, true);
      }
    }, 420);
  }

  stopAmbientLoops() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.proxGain) this.proxGain.gain.setTargetAtTime(0, now, 0.06);
    if (this.windGain && this.lastWindMode !== 0) {
      this.windGain.gain.setTargetAtTime(0, now, 0.08);
      this.lastWindMode = 0;
    }
  }

  stopBgm() {
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
    this.stopAmbientLoops();
  }

  playMotePickup() {
    const nowMs = performance.now();
    if (nowMs - this.lastPickupMs < 2400) {
      this.pickupCombo = Math.min(7, this.pickupCombo + 1);
    } else {
      this.pickupCombo = 0;
    }
    this.lastPickupMs = nowMs;

    const scale = [587.33, 659.25, 739.99, 880.00, 987.77, 1174.66, 1318.51, 1479.98];
    const base = scale[this.pickupCombo];
    this.pluckedTone(base, 0.42, 0.13, 0, 0, true);
    this.tone('sine', base * 1.5, base * 2.0, 0.28, 0.06, 0.035, true);
  }

  playSkillCardPickup() {
    [587.33, 739.99, 880.00, 1108.73, 1479.98].forEach((f, i) => {
      this.pluckedTone(f, 0.55, 0.12, i * 0.05, (i - 2) * 0.2, true);
    });
  }

  playSkillCast(skillId) {
    if (!this.ctx || !this.masterGain) return;
    if (skillId === 'sakura') {
      [783.99, 987.77, 1174.66, 1567.98].forEach((f, i) => {
        this.pluckedTone(f, 0.48, 0.12, i * 0.03, 0, true);
      });
    } else if (skillId === 'thunder') {
      this.tone('sawtooth', 880, 160, 0.26, 0.16, 0, true);
      this.tone('triangle', 1320, 320, 0.22, 0.11, 0.03, true);
    } else if (skillId === 'phoenix') {
      this.tone('triangle', 320, 920, 0.34, 0.16, 0, true);
      this.tone('sine', 640, 1280, 0.30, 0.09, 0.05, true);
    } else {
      this.pluckedTone(1046.5, 0.5, 0.14, 0, 0, true);
      this.pluckedTone(1567.98, 0.45, 0.11, 0.04, 0, true);
    }
  }

  playMonsterDeath(skillId) {
    if (!this.ctx || !this.masterGain) return;
    this.tone('sawtooth', 260, 58, 0.36, 0.18, 0, true);
    this.pluckedTone(587.33, 0.65, 0.14, 0.05, 0, true);
    this.pluckedTone(880.00, 0.72, 0.12, 0.11, 0, true);
    if (skillId === 'thunder') {
      this.tone('square', 1174.66, 220, 0.20, 0.07, 0.02, true);
    }
  }

  updateMonsterProximityAudio(dist, pan, archetype, nowMs) {
    if (!this.ctx || !this.proxGain || !this.proxOsc) return;
    if (nowMs - this.lastProxUpdateMs < 95) return;
    this.lastProxUpdateMs = nowMs;
    const now = this.ctx.currentTime;
    if (dist === null || dist >= 18.0) {
      this.proxGain.gain.setTargetAtTime(0, now, 0.12);
      return;
    }

    const strength = Math.pow(Math.max(0, 1 - dist / 18.0), 1.8);
    this.proxGain.gain.setTargetAtTime(strength * 0.075, now, 0.1);
    if (this.proxPanner) {
      this.proxPanner.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), now, 0.08);
    }
    const pulseHz = 54 + archetype * 10 + Math.sin(nowMs * 0.005) * 6;
    this.proxOsc.frequency.setTargetAtTime(pulseHz, now, 0.08);

    const cooldown = dist < 8.0 ? 2100 : 3400;
    if (dist < 16.0 && nowMs - this.lastCreatureSoundMs > cooldown) {
      this.lastCreatureSoundMs = nowMs;
      const g = Math.max(0.03, strength * 0.16);
      if (archetype === 0) {
        // Wolf low growl / spectral howl
        this.tone('sawtooth', 145, 76, 0.55, g * 0.9, 0, true);
        this.tone('triangle', 290, 210, 0.45, g * 0.45, 0.05, true);
      } else if (archetype === 1) {
        // Wisp hollow phantom moan
        this.tone('sine', 420, 250, 0.75, g * 0.85, 0, true);
        this.tone('sine', 635, 520, 0.55, g * 0.35, 0.08, true);
      } else if (archetype === 2) {
        // Kitsune eerie fox trill
        this.tone('triangle', 520, 340, 0.28, g * 0.8, 0, true);
        this.tone('triangle', 680, 410, 0.30, g * 0.65, 0.14, true);
      } else if (archetype === 3) {
        // Crow sharp caw
        this.tone('sawtooth', 540, 240, 0.22, g * 0.7, 0, true);
        this.tone('sawtooth', 490, 220, 0.20, g * 0.55, 0.20, true);
      } else {
        // Wind Spirit Moth flutter chime
        this.pluckedTone(783.99, 0.38, g * 0.75, 0, pan, true);
        this.pluckedTone(1046.5, 0.35, g * 0.55, 0.07, pan, true);
      }
    }
  }

  updateWindAudio(active, warning) {
    if (!this.ctx || !this.windGain || !this.windFilter) return;
    const mode = active ? 2 : warning ? 1 : 0;
    if (mode === this.lastWindMode) return;
    this.lastWindMode = mode;
    const now = this.ctx.currentTime;
    if (active) {
      this.windGain.gain.setTargetAtTime(0.085, now, 0.18);
      this.windFilter.frequency.setTargetAtTime(680, now, 0.25);
    } else if (warning) {
      this.windGain.gain.setTargetAtTime(0.032, now, 0.25);
      this.windFilter.frequency.setTargetAtTime(410, now, 0.25);
    } else {
      this.windGain.gain.setTargetAtTime(0, now, 0.22);
    }
  }

  playCharmPickup() {
    this.pluckedTone(523.25, 0.32, 0.15, 0, 0, true);
    this.pluckedTone(783.99, 0.38, 0.15, 0.07, 0, true);
    this.pluckedTone(1046.5, 0.45, 0.12, 0.14, 0, true);
  }

  playDeposit() {
    this.pluckedTone(440, 0.24, 0.12, 0, 0, true);
  }

  playLanternLit() {
    [293.66, 440, 554.37, 739.99].forEach((freq, i) => {
      this.tone('triangle', freq, freq, 1.5, 0.15 / (i + 1), i * 0.04, true);
    });
  }

  playPulse() {
    this.tone('sine', 440, 140, 0.35, 0.20, 0, true);
    this.tone('triangle', 660, 220, 0.35, 0.10, 0.02, true);
  }

  playPlayerHit() {
    this.tone('sawtooth', 130, 42, 0.28, 0.22);
  }

  playJump() {
    this.tone('sine', 240, 420, 0.14, 0.11);
  }

  playDash() {
    this.tone('triangle', 520, 180, 0.16, 0.14);
  }

  playShadeSpawn() {
    this.tone('sawtooth', 95, 70, 0.4, 0.08, 0, true);
  }

  playCountdownTick() {
    this.tone('square', 880, 880, 0.06, 0.06);
  }

  playWindWarning() {
    this.tone('sine', 300, 460, 0.6, 0.09, 0, true);
  }

  playLanternOut() {
    this.tone('sine', 330, 140, 0.45, 0.13, 0, true);
  }

  playWin() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
      this.pluckedTone(f, 0.7, 0.15, idx * 0.11, 0, true);
    });
  }

  playLose() {
    [330, 293.66, 246.94, 196].forEach((f, idx) => {
      this.tone('sine', f, f * 0.96, 0.4, 0.15, idx * 0.15, true);
    });
  }
}
