// audio.js - Moroccan Dama Web Audio Synthesizer

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  // Initialize the audio context on user interaction
  init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      this.ctx = new AudioContextClass();
    }
  }

  // Toggle mute state
  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx && this.ctx.state === 'suspended' && !this.muted) {
      this.ctx.resume();
    }
    return this.muted;
  }

  isMuted() {
    return this.muted;
  }

  // Create a gain node with a specific envelope
  createGainNode(startVal, endVal, duration, delay = 0) {
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(startVal, this.ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(endVal, this.ctx.currentTime + delay + duration);
    return gain;
  }

  // Play a soft wooden slide/friction sound for moves
  playMove() {
    this.init();
    if (this.muted || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const osc = this.ctx.createOscillator();
    const gainNode = this.createGainNode(0.3, 0.001, 0.15);
    
    // Low, woody tone
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.15);

    // Bandpass filter to make it sound more like wood scraping
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(200, this.ctx.currentTime);
    filter.Q.setValueAtTime(2.0, this.ctx.currentTime);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  // Play a sharp hollow wooden knock for captures
  playCapture() {
    this.init();
    if (this.muted || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    // Sound consists of two elements: a fast pitch-dropped triangle wave and a brief pop of filtered noise
    const osc = this.ctx.createOscillator();
    const gainOsc = this.createGainNode(0.5, 0.001, 0.12);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(350, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.12);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, this.ctx.currentTime);
    filter.Q.setValueAtTime(4.0, this.ctx.currentTime);

    osc.connect(filter);
    filter.connect(gainOsc);
    gainOsc.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);

    // Filtered noise pop
    const bufferSize = this.ctx.sampleRate * 0.05; // 50ms
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(600, this.ctx.currentTime);
    noiseFilter.Q.setValueAtTime(3.0, this.ctx.currentTime);

    const gainNoise = this.createGainNode(0.4, 0.001, 0.04);

    noise.connect(noiseFilter);
    noiseFilter.connect(gainNoise);
    gainNoise.connect(this.ctx.destination);

    noise.start();
    noise.stop(this.ctx.currentTime + 0.05);
  }

  // Play a blowing wind/whoosh sound for Nfekh (huffing)
  playNfekh() {
    this.init();
    if (this.muted || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const duration = 0.6;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = buffer;

    // Sweeping bandpass filter
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(1.5, this.ctx.currentTime);
    filter.frequency.setValueAtTime(1200, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + duration);

    // Envelope
    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.001, this.ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.4, this.ctx.currentTime + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    noiseSource.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    noiseSource.start();
    noiseSource.stop(this.ctx.currentTime + duration);
  }

  // Play a brassy bell chime for King promotion
  playPromotion() {
    this.init();
    if (this.muted || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;
    const duration = 1.2;

    // Chime chords: 4 frequencies for metallic richness
    const frequencies = [329.63, 440.00, 554.37, 659.25]; // E4, A4, C#5, E5 (A major chime)
    
    frequencies.forEach((freq, index) => {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      
      osc.type = index % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      
      // Detune slightly for lush brassy chorus
      osc.detune.setValueAtTime((index - 1.5) * 6, now);

      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.15, now + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration - (index * 0.1));

      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    });
  }

  // Play ascending arpeggio for victory
  playWin() {
    this.init();
    if (this.muted || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;
    const notes = [220.00, 277.18, 329.63, 440.00, 554.37, 659.25, 880.00]; // A major scale arpeggio
    
    notes.forEach((freq, idx) => {
      const delay = idx * 0.12;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + delay);

      gain.gain.setValueAtTime(0, now + delay);
      gain.gain.linearRampToValueAtTime(0.15, now + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + delay);
      osc.stop(now + delay + 0.45);
    });
  }

  // Play descending chord progression for defeat
  playLose() {
    this.init();
    if (this.muted || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;
    const chords = [
      [220.00, 261.63, 329.63], // Am
      [196.00, 233.08, 293.66], // Gm
      [164.81, 196.00, 246.94]  // Em
    ];

    chords.forEach((chord, chordIdx) => {
      const chordDelay = chordIdx * 0.4;
      chord.forEach((freq) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + chordDelay);

        // Low pass filter to make sawtooth smooth
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, now + chordDelay);

        gain.gain.setValueAtTime(0, now + chordDelay);
        gain.gain.linearRampToValueAtTime(0.08, now + chordDelay + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + chordDelay + 0.38);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + chordDelay);
        osc.stop(now + chordDelay + 0.4);
      });
    });
  }
}

export const audio = new AudioEngine();
