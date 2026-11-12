// src/lib/audio.js - Web Audio API Synthesizer

class SoundEffects {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq, type = 'sine', duration = 0.15, gainVal = 0.1) {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      // Audio safety fallback
    }
  }

  flip() {
    this.playTone(480, 'triangle', 0.08, 0.08);
  }

  match() {
    this.playTone(523.25, 'sine', 0.15, 0.12);
    setTimeout(() => this.playTone(659.25, 'sine', 0.2, 0.12), 90);
    setTimeout(() => this.playTone(783.99, 'sine', 0.3, 0.15), 180);
  }

  wrong() {
    this.playTone(220, 'sawtooth', 0.2, 0.08);
    setTimeout(() => this.playTone(180, 'sawtooth', 0.25, 0.08), 100);
  }

  win() {
    const melody = [523.25, 659.25, 783.99, 1046.50];
    melody.forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 'triangle', 0.3, 0.15), idx * 120);
    });
  }
}

export const sounds = new SoundEffects();

