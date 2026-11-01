// Web Audio API based harmonic chime sound synthesizer
class SoundManager {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private buzzerTimerId: NodeJS.Timeout | null = null;
  private buzzerIntervalId: NodeJS.Timeout | null = null;
  private isBuzzerRunning: boolean = false;
  private isKeepAliveRunning: boolean = false;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && !this.masterGain) {
      try {
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.setValueAtTime(1, this.audioCtx.currentTime);
        this.masterGain.connect(this.audioCtx.destination);
      } catch {
        // ignore
      }
    }
    return this.audioCtx;
  }

  // Keep AudioContext in 'running' state by playing a silent loop
  public startKeepAlive(): void {
    if (this.isKeepAliveRunning) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const silentGain = ctx.createGain();
      silentGain.gain.value = 0;
      source.connect(silentGain);
      silentGain.connect(ctx.destination);
      source.start(0);
      this.isKeepAliveRunning = true;
    } catch {
      // ignore
    }
  }

  // Pre-emptively unlock AudioContext on first user interaction (Mobile Autoplay Policy)
  public unlockAudio(): void {
    try {
      const ctx = this.getAudioContext();
      if (ctx) {
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        if (this.masterGain) {
          this.masterGain.gain.setValueAtTime(1, ctx.currentTime);
        }
        this.startKeepAlive();
      }
    } catch {
      // ignore
    }
  }

  // Play crisp 2-tone chime ("Ding-Dong")
  public async playChime(): Promise<void> {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }

      // Do NOT queue oscillators if the browser still suspended audio (no user interaction yet)
      // This prevents the "ding-dong fires only when pressing dismiss" bug!
      if (ctx.state !== 'running') {
        return;
      }

      if (this.masterGain) {
        this.masterGain.gain.setValueAtTime(1, ctx.currentTime);
      }

      const dest = this.masterGain || ctx.destination;
      const now = ctx.currentTime;

      // Note 1: E5 (659.25 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);

      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.4, now + 0.05);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc1.connect(gain1);
      gain1.connect(dest);

      osc1.start(now);
      osc1.stop(now + 0.6);

      // Note 2: C5 (523.25 Hz) with 0.22s delay
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(523.25, now + 0.22);

      gain2.gain.setValueAtTime(0, now + 0.22);
      gain2.gain.linearRampToValueAtTime(0.45, now + 0.27);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

      osc2.connect(gain2);
      gain2.connect(dest);

      osc2.start(now + 0.22);
      osc2.stop(now + 0.9);
    } catch (e) {
      console.warn('AudioContext playback error:', e);
    }
  }

  // Play short subtle click sound
  public playClick(): void {
    try {
      const ctx = this.getAudioContext();
      if (!ctx || ctx.state !== 'running') return;
      const dest = this.masterGain || ctx.destination;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.08);
    } catch {
      // ignore
    }
  }

  // 1-minute safety buzzer alarm loop (harmonic chime + vibration)
  public startBuzzerLoop(onTimeout?: () => void): () => void {
    if (this.isBuzzerRunning) return this.stopBuzzerLoop.bind(this);
    this.isBuzzerRunning = true;

    // Ensure audio context is running & master gain is unmuted
    this.unlockAudio();

    // Immediately trigger chime and vibration
    this.playChime();
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate([400, 200, 400]); } catch {}
    }

    // Interval every 2.2 seconds
    this.buzzerIntervalId = setInterval(() => {
      if (!this.isBuzzerRunning) return;
      this.playChime();
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate([400, 200, 400]); } catch {}
      }
    }, 2200);

    // Auto-timeout after 60 seconds (1 minute)
    this.buzzerTimerId = setTimeout(() => {
      this.stopBuzzerLoop();
      if (onTimeout) onTimeout();
    }, 60000);

    return this.stopBuzzerLoop.bind(this);
  }

  // Stop buzzer alarm loop immediately
  public stopBuzzerLoop(): void {
    if (!this.isBuzzerRunning) return;
    this.isBuzzerRunning = false;

    // Immediately mute master gain so NO delayed chime can sound on button click
    if (this.masterGain && this.audioCtx) {
      try {
        this.masterGain.gain.cancelScheduledValues(this.audioCtx.currentTime);
        this.masterGain.gain.setValueAtTime(0, this.audioCtx.currentTime);
      } catch {
        // ignore
      }
    }

    if (this.buzzerTimerId) {
      clearTimeout(this.buzzerTimerId);
      this.buzzerTimerId = null;
    }
    if (this.buzzerIntervalId) {
      clearInterval(this.buzzerIntervalId);
      this.buzzerIntervalId = null;
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(0); } catch {}
    }
  }

  public isBuzzerActive(): boolean {
    return this.isBuzzerRunning;
  }
}

export const soundManager = new SoundManager();
