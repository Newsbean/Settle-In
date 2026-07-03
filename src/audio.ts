// Tiny WebAudio foley kit. Distinct per-material sounds are the soul of the
// A-Little-to-the-Left feel, so each interaction gets its own synthesised timbre.
// A thin sample layer sits alongside it (added 2026-07-03): a warm BGM bed, two
// looping ambiences (indoor room tone + outdoor garden), and a few event
// one-shots (doorbell / van / box thud) loaded from mp3 assets. The synth foley
// stays the primary voice; samples only add atmosphere and the delivery cues.

interface Loop {
  gain: GainNode
  target: number
}

export class Audio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private unlocked = false

  // Sample layer
  private assetUrls: Record<string, string> = {}
  private buffers = new Map<string, AudioBuffer | null>()
  private loops = new Map<string, Loop>()
  private ambienceStarted = false
  private outdoor = false

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx
    try {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.5
      this.master.connect(this.ctx.destination)
    } catch {
      this.ctx = null
    }
    return this.ctx
  }

  // Hand the asset URL map (ASSETS from assets.ts) so the sample layer can load
  // its mp3s. Safe to call before unlock — decoding waits for the context.
  registerAssets(urls: Record<string, string>) {
    this.assetUrls = urls
  }

  unlock() {
    const ctx = this.ensure()
    if (ctx && ctx.state === 'suspended') void ctx.resume()
    this.unlocked = true
    if (!this.ambienceStarted) {
      this.ambienceStarted = true
      void this.startAmbience()
    }
  }

  // --- Sample loading + playback ---

  private async loadBuffer(key: string): Promise<AudioBuffer | null> {
    if (this.buffers.has(key)) return this.buffers.get(key)!
    const ctx = this.ensure()
    const url = this.assetUrls[key]
    if (!ctx || !url) {
      this.buffers.set(key, null)
      return null
    }
    try {
      const res = await fetch(url)
      const arr = await res.arrayBuffer()
      const buf = await ctx.decodeAudioData(arr)
      this.buffers.set(key, buf)
      return buf
    } catch {
      this.buffers.set(key, null) // fall back to synth
      return null
    }
  }

  // Fire a one-shot sample; returns false if it isn't available (caller can
  // fall back to a synth cue so no action is ever met with silence).
  private playSample(key: string, gain = 1): boolean {
    const buf = this.buffers.get(key)
    if (buf === undefined) {
      // not loaded yet — kick off a load for next time, report miss now
      void this.loadBuffer(key)
      return false
    }
    if (!buf) return false
    const ctx = this.ensure()
    if (!ctx || !this.master) return false
    const src = ctx.createBufferSource()
    src.buffer = buf
    const g = ctx.createGain()
    g.gain.value = gain
    src.connect(g)
    g.connect(this.master)
    src.start()
    return true
  }

  // Start (or restart) a seamless looping bed at a target gain, ramping up from
  // silence. Idempotent per key.
  private async startLoop(key: string, target: number) {
    if (this.loops.has(key)) return
    const buf = await this.loadBuffer(key)
    const ctx = this.ensure()
    if (!buf || !ctx || !this.master) return
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const g = ctx.createGain()
    g.gain.value = 0.0001
    src.connect(g)
    g.connect(this.master)
    src.start()
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, target), ctx.currentTime + 2.5)
    this.loops.set(key, { gain: g, target })
  }

  private async startAmbience() {
    await this.startLoop('bgm_home_loop', 0.16)
    await this.startLoop('sfx_room_tone', 0.22)
    await this.startLoop('sfx_garden_ambience', 0.0001) // silent until outdoors
  }

  // Crossfade the garden bed in/out as the player steps outside/inside. Cheap to
  // call every frame — only ramps on a state change.
  setOutdoor(outdoor: boolean) {
    if (outdoor === this.outdoor) return
    this.outdoor = outdoor
    const ctx = this.ctx
    const garden = this.loops.get('sfx_garden_ambience')
    const room = this.loops.get('sfx_room_tone')
    if (!ctx) return
    const ramp = (l: Loop | undefined, to: number) => {
      if (!l) return
      l.gain.gain.cancelScheduledValues(ctx.currentTime)
      l.gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, to), ctx.currentTime + 1.4)
    }
    ramp(garden, outdoor ? 0.3 : 0.0001)
    ramp(room, outdoor ? 0.08 : 0.22) // duck the indoor tone outside
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    opts: { slideTo?: number; delay?: number } = {},
  ) {
    const ctx = this.ensure()
    if (!ctx || !this.master) return
    const t0 = ctx.currentTime + (opts.delay ?? 0)
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + dur)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(g)
    g.connect(this.master)
    osc.start(t0)
    osc.stop(t0 + dur + 0.02)
  }

  private noise(dur: number, gain: number, hpf = 800, lpf = 6000) {
    const ctx = this.ensure()
    if (!ctx || !this.master) return
    const frames = Math.floor(ctx.sampleRate * dur)
    const buf = ctx.createBuffer(1, frames, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames)
    const src = ctx.createBufferSource()
    src.buffer = buf
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = hpf
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = lpf
    const g = ctx.createGain()
    g.gain.value = gain
    src.connect(hp)
    hp.connect(lp)
    lp.connect(g)
    g.connect(this.master)
    src.start()
  }

  // --- Named cues ---

  // Picking a piece up.
  lift() {
    this.tone(520, 0.09, 'sine', 0.14)
  }

  // A wooden book/board landing.
  woodPlace() {
    this.noise(0.06, 0.12, 400, 2600)
    this.tone(180, 0.09, 'triangle', 0.16, { slideTo: 120 })
  }

  // A ceramic mug / glass tap.
  ceramic() {
    this.tone(880, 0.14, 'sine', 0.12, { slideTo: 760 })
    this.tone(1320, 0.1, 'sine', 0.05)
  }

  // Correct snap into a slot — a bright, pleasing double tick.
  snap() {
    this.tone(660, 0.08, 'sine', 0.16)
    this.tone(990, 0.12, 'sine', 0.12, { delay: 0.04 })
  }

  // Gentle "not there" — soft low blip, never harsh.
  reject() {
    this.tone(300, 0.14, 'sine', 0.1, { slideTo: 240 })
  }

  // Bolt tightening tick.
  tick() {
    this.tone(1400, 0.03, 'square', 0.05)
  }

  // Box-cutter slicing through tape — a short papery rasp.
  slice() {
    this.noise(0.09, 0.09, 1500, 5000)
  }

  // Flaps popping open / package opened.
  pop() {
    this.tone(300, 0.12, 'sine', 0.14, { slideTo: 520 })
    this.noise(0.12, 0.06, 600, 3000)
  }

  // Rising arrangement chime — step k climbs a soft pentatonic ladder. Used
  // when a full arrangement is judged right: one note per piece, left to right.
  chime(step = 0) {
    const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5]
    this.tone(notes[Math.min(step, notes.length - 1)], 0.2, 'sine', 0.14)
  }

  // A step / sub-goal completed.
  ding() {
    this.tone(784, 0.16, 'sine', 0.16)
    this.tone(1175, 0.22, 'sine', 0.12, { delay: 0.06 })
  }

  // Whole task solved — a warm little arpeggio.
  solved() {
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((f, i) => this.tone(f, 0.5, 'sine', 0.15, { delay: i * 0.09 }))
    this.noise(0.5, 0.05, 2000, 9000)
  }

  // Front-door bell — a friendly two-tone ding-dong for deliveries. Prefers the
  // sampled chime; falls back to the synth two-tone if the mp3 isn't loaded.
  doorbell() {
    if (this.playSample('sfx_doorbell', 0.9)) return
    this.tone(659.25, 0.4, 'sine', 0.16)
    this.tone(523.25, 0.55, 'sine', 0.16, { delay: 0.28 })
  }

  // A small delivery van pulling up — plays just before a parcel lands.
  van() {
    if (this.playSample('sfx_delivery_van', 0.7)) return
    this.tone(90, 0.7, 'sawtooth', 0.06, { slideTo: 70 })
  }

  // A cardboard box set down on the floor — soft, weighty, satisfying.
  thud() {
    if (this.playSample('sfx_box_thud', 0.9)) return
    this.noise(0.1, 0.12, 120, 900)
    this.tone(110, 0.16, 'triangle', 0.18, { slideTo: 70 })
  }

  // Room warms up — a soft swell.
  warm() {
    this.tone(392, 0.9, 'sine', 0.1, { slideTo: 523.25 })
    this.tone(587.33, 0.9, 'sine', 0.07, { delay: 0.1 })
  }

  dispose() {
    void this.ctx?.close()
    this.ctx = null
  }
}
