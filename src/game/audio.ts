export class AudioBus {
  private ctx: AudioContext | null = null
  private muted = false

  ensure() {
    if (!this.ctx) {
      this.ctx = new AudioContext()
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume()
    }
  }

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType,
    gain = 0.08,
    slideTo?: number,
  ) {
    if (this.muted || !this.ctx) return
    const t0 = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    if (slideTo != null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + duration)
    }
    g.gain.setValueAtTime(gain, t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
    osc.connect(g)
    g.connect(this.ctx.destination)
    osc.start(t0)
    osc.stop(t0 + duration)
  }

  shoot() {
    this.tone(420, 0.08, 'square', 0.05, 120)
  }

  hit() {
    this.tone(880, 0.05, 'triangle', 0.04)
  }

  explode() {
    this.tone(90, 0.35, 'sawtooth', 0.1, 30)
  }

  hurt() {
    this.tone(140, 0.2, 'sawtooth', 0.08, 60)
  }

  powerup() {
    this.tone(520, 0.12, 'sine', 0.06, 980)
  }

  boss() {
    this.tone(80, 0.5, 'square', 0.12, 40)
  }

  reload() {
    this.tone(220, 0.1, 'triangle', 0.04, 360)
  }
}
