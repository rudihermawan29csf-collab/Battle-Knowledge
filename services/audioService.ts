import { GameScreen } from '../types';

class AudioService {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  
  private isPlaying: boolean = false;
  private currentScreen: GameScreen | null = null;
  private nextNoteTime: number = 0;
  private current16thNote: number = 0;
  private timerID: number | null = null;
  private tempo: number = 100;
  private lookahead: number = 25.0; 
  private scheduleAheadTime: number = 0.1;

  constructor() {
    // AudioContext tidak lagi dibuat di constructor untuk mencegah crash saat load
  }

  private initCtx() {
    if (!this.ctx) {
      try {
        // @ts-ignore
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContextClass();
      } catch (e) {
        console.error("Web Audio API not supported");
      }
    }
  }

  resume() {
    this.initCtx();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playClick() {
    this.resume();
    if (!this.ctx || this.isMuted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(3000, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1000, this.ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  playType() {
    this.resume();
    if (!this.ctx || this.isMuted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.02, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.03);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.03);
  }

  playGunshot() {
    this.resume();
    if (!this.ctx || this.isMuted) return;
    const bufferSize = this.ctx.sampleRate * 0.3; 
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.2);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noiseGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
    noise.start();
  }

  playWin() {
    this.resume();
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.50, 1318.51].forEach((freq, i) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.type = 'square';
        osc.frequency.value = freq;
        const start = now + i * 0.08;
        gain.gain.setValueAtTime(0.05, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
        osc.start(start);
        osc.stop(start + 0.3);
    });
  }

  playTheme(screen: GameScreen) {
    if (this.currentScreen === screen && this.isPlaying) return;
    this.currentScreen = screen;
    
    // Resume hanya jika ctx sudah pernah dibuat
    if (this.ctx) {
      this.resume();
    }

    switch(screen) {
        case GameScreen.TITLE:
        case GameScreen.LOGIN:
            this.tempo = 60;
            break;
        case GameScreen.INSTRUCTIONS:
        case GameScreen.CHAR_SELECT:
        case GameScreen.MAP:
            this.tempo = 105;
            break;
        case GameScreen.GAMEPLAY:
            this.tempo = 128;
            break;
        case GameScreen.RESULT:
            this.tempo = 90;
            break;
        default:
            this.tempo = 100;
    }

    if (!this.isPlaying && this.ctx) {
        this.isPlaying = true;
        this.nextNoteTime = this.ctx.currentTime;
        this.current16thNote = 0;
        this.scheduler();
    }
  }

  stopBGM() {
    this.isPlaying = false;
    if (this.timerID) {
        window.clearTimeout(this.timerID);
        this.timerID = null;
    }
  }

  private nextNote() {
    const secondsPerBeat = 60.0 / this.tempo;
    this.nextNoteTime += 0.25 * secondsPerBeat;
    this.current16thNote++;
    if (this.current16thNote === 16) {
        this.current16thNote = 0;
    }
  }

  private scheduler() {
    if (!this.ctx || !this.isPlaying) return;
    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
        this.scheduleNote(this.current16thNote, this.nextNoteTime);
        this.nextNote();
    }
    this.timerID = window.setTimeout(this.scheduler.bind(this), this.lookahead);
  }

  private scheduleNote(beatNumber: number, time: number) {
      if (!this.currentScreen || !this.ctx) return;

      switch (this.currentScreen) {
          case GameScreen.TITLE:
          case GameScreen.LOGIN:
              this.scheduleSuspense(beatNumber, time);
              break;
          case GameScreen.INSTRUCTIONS:
          case GameScreen.CHAR_SELECT:
          case GameScreen.MAP:
              this.scheduleLobby(beatNumber, time);
              break;
          case GameScreen.GAMEPLAY:
              this.scheduleBattle(beatNumber, time);
              break;
          case GameScreen.RESULT:
              this.scheduleVictory(beatNumber, time);
              break;
      }
  }

  private scheduleSuspense(beat: number, time: number) {
      if (beat === 0 || beat === 3) this.playKick(time, 0.3, 60);
      if (beat === 0) this.playBass(time, 0.1, 40, 0.5);
  }

  private scheduleLobby(beat: number, time: number) {
      if (beat === 0 || beat === 10) this.playKick(time, 0.4, 100);
      if (beat === 4 || beat === 12) this.playSnare(time, 0.15);
      if (beat % 2 === 0) this.playHiHat(time, 0.05);
      if (beat === 14) this.playTone(time, 880, 'sine', 0.05);
  }

  private scheduleBattle(beat: number, time: number) {
      if (beat % 4 === 0) this.playKick(time, 0.5, 120);
      if (beat % 4 === 2) this.playHiHat(time, 0.1);
      const bassNote = beat < 8 ? 55 : 65;
      this.playBass(time, 0.08, bassNote, 0.15, 'sawtooth');
      if (beat === 4 || beat === 12) this.playSnare(time, 0.2);
  }

  private scheduleVictory(beat: number, time: number) {
     if (beat === 0) this.playKick(time, 0.3, 80);
     if (beat === 8) this.playSnare(time, 0.1);
     if (beat % 4 === 0) {
         const notes = [261.63, 329.63, 392.00, 523.25];
         const noteIndex = (beat / 4) % 4;
         this.playTone(time, notes[noteIndex], 'triangle', 0.1, 0.4);
     }
  }

  private playKick(time: number, vol: number, freq: number) {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.frequency.setValueAtTime(freq, time);
      osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
      gain.gain.setValueAtTime(vol, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);
      osc.start(time);
      osc.stop(time + 0.5);
  }

  private playSnare(time: number, vol: number) {
      if (!this.ctx) return;
      const bufferSize = this.ctx.sampleRate * 0.1;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) { data[i] = Math.random() * 2 - 1; }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 1500;
      const gain = this.ctx.createGain();
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      gain.gain.setValueAtTime(vol, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
      noise.start(time);
      noise.stop(time + 0.1);
  }

  private playHiHat(time: number, vol: number) {
      if (!this.ctx) return;
      const bufferSize = this.ctx.sampleRate * 0.05;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) { data[i] = Math.random() * 2 - 1; }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 6000;
      const gain = this.ctx.createGain();
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      gain.gain.setValueAtTime(vol, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
      noise.start(time);
      noise.stop(time + 0.05);
  }

  private playBass(time: number, vol: number, freq: number, duration: number, type: OscillatorType = 'sine') {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, time);
      gain.gain.setValueAtTime(vol, time);
      gain.gain.linearRampToValueAtTime(0, time + duration);
      osc.start(time);
      osc.stop(time + duration);
  }

  private playTone(time: number, freq: number, type: OscillatorType, vol: number, duration: number = 0.1) {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, time);
      gain.gain.setValueAtTime(vol, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
      osc.start(time);
      osc.stop(time + duration);
  }
}

export const audioService = new AudioService();