import type { WeaponId } from './weapons'

/** Layered Web Audio SFX — punchier than single oscillators. */
export class AudioBus {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private muted = false
  private noise: AudioBuffer | null = null

  ensure() {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.85
      this.master.connect(this.ctx.destination)
      this.noise = this.makeNoise(1)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  private makeNoise(seconds: number) {
    const ctx = this.ctx!
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    return buffer
  }

  private out() {
    return this.master ?? this.ctx!.destination
  }

  private envGain(peak: number, attack: number, decay: number) {
    const g = this.ctx!.createGain()
    const t0 = this.ctx!.currentTime
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay)
    g.connect(this.out())
    return { g, t0, stop: t0 + attack + decay + 0.02 }
  }

  private osc(
    type: OscillatorType,
    freq: number,
    peak: number,
    attack: number,
    decay: number,
    slideTo?: number,
  ) {
    if (this.muted || !this.ctx) return
    const { g, t0, stop } = this.envGain(peak, attack, decay)
    const o = this.ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(freq, t0)
    if (slideTo != null) {
      o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + attack + decay)
    }
    o.connect(g)
    o.start(t0)
    o.stop(stop)
  }

  private noiseBurst(peak: number, attack: number, decay: number, filterFreq: number, q = 1) {
    if (this.muted || !this.ctx || !this.noise) return
    const { g, t0, stop } = this.envGain(peak, attack, decay)
    const src = this.ctx.createBufferSource()
    src.buffer = this.noise
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = filterFreq
    filter.Q.value = q
    src.connect(filter)
    filter.connect(g)
    src.start(t0)
    src.stop(stop)
  }

  private click(freq: number, peak = 0.08) {
    this.osc('square', freq, peak, 0.002, 0.04, freq * 0.5)
  }

  shoot(weapon: WeaponId = 'rifle') {
    this.ensure()
    if (weapon === 'smg') {
      this.noiseBurst(0.22, 0.001, 0.05, 1800, 0.7)
      this.osc('square', 520, 0.06, 0.001, 0.05, 180)
      this.osc('sawtooth', 140, 0.04, 0.001, 0.06, 60)
    } else if (weapon === 'shotgun') {
      this.noiseBurst(0.45, 0.002, 0.28, 900, 0.5)
      this.noiseBurst(0.25, 0.001, 0.18, 2200, 0.8)
      this.osc('sawtooth', 90, 0.16, 0.002, 0.35, 35)
      this.osc('triangle', 220, 0.05, 0.001, 0.12, 60)
    } else if (weapon === 'rail') {
      this.osc('sine', 880, 0.08, 0.01, 0.12, 220)
      this.osc('sawtooth', 160, 0.1, 0.005, 0.2, 40)
      this.noiseBurst(0.18, 0.01, 0.15, 3200, 2)
      this.click(1200, 0.05)
    } else {
      // pulse rifle
      this.noiseBurst(0.28, 0.001, 0.1, 1400, 0.8)
      this.osc('square', 380, 0.07, 0.001, 0.09, 110)
      this.osc('sawtooth', 120, 0.08, 0.001, 0.14, 45)
      this.click(900, 0.04)
    }
  }

  hit() {
    this.ensure()
    this.noiseBurst(0.12, 0.001, 0.05, 2400, 1.2)
    this.osc('triangle', 980, 0.05, 0.001, 0.06, 400)
    this.click(1400, 0.03)
  }

  explode() {
    this.ensure()
    this.noiseBurst(0.5, 0.002, 0.45, 400, 0.4)
    this.noiseBurst(0.25, 0.01, 0.35, 900, 0.6)
    this.osc('sawtooth', 70, 0.2, 0.005, 0.5, 22)
    this.osc('square', 45, 0.12, 0.01, 0.4, 20)
  }

  hurt() {
    this.ensure()
    this.noiseBurst(0.2, 0.001, 0.2, 500, 0.5)
    this.osc('sawtooth', 160, 0.1, 0.002, 0.25, 50)
    this.osc('sine', 90, 0.08, 0.01, 0.3, 40)
  }

  powerup() {
    this.ensure()
    this.osc('sine', 440, 0.06, 0.01, 0.1, 660)
    this.osc('triangle', 660, 0.05, 0.05, 0.12, 990)
    this.osc('sine', 880, 0.04, 0.1, 0.15, 1320)
  }

  boss() {
    this.ensure()
    this.osc('sawtooth', 55, 0.18, 0.02, 0.7, 28)
    this.osc('square', 40, 0.12, 0.05, 0.6, 25)
    this.noiseBurst(0.2, 0.05, 0.5, 200, 0.3)
  }

  reload() {
    this.ensure()
    this.click(320, 0.05)
    window.setTimeout(() => {
      this.click(520, 0.04)
      this.noiseBurst(0.08, 0.001, 0.06, 1800, 1)
    }, 90)
    window.setTimeout(() => this.click(280, 0.06), 220)
  }

  switchWeapon() {
    this.ensure()
    this.click(600, 0.04)
    this.noiseBurst(0.06, 0.001, 0.04, 1200, 1)
  }

  adsIn() {
    this.ensure()
    this.osc('sine', 180, 0.03, 0.01, 0.08, 320)
  }
}
