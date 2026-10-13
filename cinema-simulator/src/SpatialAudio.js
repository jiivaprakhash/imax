// -----------------------------------------------------------------------------
// SpatialAudio.js
// Turns the video's stereo soundtrack into a virtual surround system.
//
//   video element
//      -> stereo input
//      -> split into Left / Right
//      -> for each virtual speaker: mix of L/R -> level -> delay -> PannerNode
//      -> master volume -> compressor -> your headphones/speakers
//
// * PannerNode puts each speaker at its real 3D position and aims it at the
//   audience (cone = directivity). The Web Audio "listener" is your camera, so
//   sound moves as you walk, sit, or turn your head.
// * DelayNode adds the extra travel time of far speakers (relative to the
//   nearest speaker, so the picture and sound stay in sync).
// * Headphones give the best result (HRTF panning is designed for them).
//
// This is a SIMULATION: it does not model room reflections or absorption.
// -----------------------------------------------------------------------------

import { SPEAKERS, AUDIO_MODEL } from './cinemaLayout.js'

const MAX_DELAY = 0.5

class SpatialAudio {
  constructor() {
    this.ctx = null
    this.nodes = [] // one entry per speaker
    this.volume = 0.8
    this.muted = false
    this.spatial = true
    this.hrtf = true
    this.surroundLevel = 1
    this.bassLevel = 1
    this._delayTimer = 0
    this._tmp = new Float32Array(256)
  }

  get ready() {
    return !!this.ctx
  }

  /** Create the audio graph. Must be called from a user gesture (click). */
  init(videoElement) {
    if (this.ctx) return
    const Ctx = window.AudioContext || window.webkitAudioContext
    const ctx = new Ctx({ latencyHint: 'playback' })
    this.ctx = ctx

    // Everything is forced to stereo so mono or 5.1 files behave predictably.
    this.input = ctx.createGain()
    this.input.channelCount = 2
    this.input.channelCountMode = 'explicit'
    this.input.channelInterpretation = 'speakers'

    try {
      // A media element can only be wrapped once, ever.
      this.mediaSource = ctx.createMediaElementSource(videoElement)
      this.mediaSource.connect(this.input)
    } catch (err) {
      console.warn('Could not attach video audio:', err)
    }

    this.splitter = ctx.createChannelSplitter(2)
    this.input.connect(this.splitter)

    this.master = ctx.createGain()
    this.master.gain.value = 0
    this.compressor = ctx.createDynamicsCompressor()
    this.compressor.threshold.value = -22
    this.compressor.knee.value = 14
    this.compressor.ratio.value = 2.2
    this.compressor.attack.value = 0.008
    this.compressor.release.value = 0.32
    this.master.connect(this.compressor)
    this.compressor.connect(ctx.destination)

    // Two parallel routes: spatial surround, or plain stereo for comparison.
    this.spatialBus = ctx.createGain()
    this.spatialBus.connect(this.master)
    this.stereoBus = ctx.createGain()
    this.stereoBus.gain.value = 0
    this.input.connect(this.stereoBus)
    this.stereoBus.connect(this.master)

    this.nodes = SPEAKERS.map((sp) => this._buildSpeaker(sp))
    this._buildHall()

    // Demo soundtrack (only audible if no video file is present).
    this.demoGain = ctx.createGain()
    this.demoGain.gain.value = 0
    this.demoGain.connect(this.input)
    const demo = ctx.createBufferSource()
    demo.buffer = createDemoBuffer(ctx)
    demo.loop = true
    demo.connect(this.demoGain)
    demo.start()

    this._applyVolume()
    this._applyRouting()
    this.setSurroundLevel(this.surroundLevel)
    this.setBassLevel(this.bassLevel)
  }

  _buildSpeaker(sp) {
    const ctx = this.ctx

    // Mix L/R into this speaker's own feed.
    const bus = ctx.createGain()
    bus.gain.value = sp.trim
    for (const [channel, weight] of sp.feed) {
      const g = ctx.createGain()
      g.gain.value = weight
      this.splitter.connect(g, channel === 'L' ? 0 : 1)
      g.connect(bus)
    }

    // The subwoofer only reproduces low frequencies.
    let out = bus
    if (sp.group === 'bass') {
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 120
      lp.Q.value = 0.7
      bus.connect(lp)
      out = lp
    }

    // Level meter for the UI.
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    out.connect(analyser)

    const delay = ctx.createDelay(MAX_DELAY)
    out.connect(delay)

    const panner = ctx.createPanner()
    panner.panningModel = this.hrtf ? 'HRTF' : 'equalpower'
    panner.distanceModel = 'inverse'
    panner.refDistance = AUDIO_MODEL.refDistance
    panner.rolloffFactor = AUDIO_MODEL.rolloffFactor
    panner.maxDistance = 10000
    panner.coneInnerAngle = AUDIO_MODEL.coneInner
    panner.coneOuterAngle = AUDIO_MODEL.coneOuter
    panner.coneOuterGain = AUDIO_MODEL.coneOuterGain
    setPannerPosition(panner, sp.pos)
    setPannerOrientation(panner, sp.facing)

    delay.connect(panner)
    panner.connect(this.spatialBus)

    return { sp, bus, analyser, delay, panner }
  }

  async resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume()
      } catch (err) {
        console.warn('AudioContext resume failed', err)
      }
    }
  }

  // ---- Per-frame updates (called from the Player) ---------------------------

  /** Move the "ears" to the camera. Call every frame. */
  updateListener(position, forward, up, dt) {
    if (!this.ctx) return
    const l = this.ctx.listener
    if (l.positionX) {
      l.positionX.value = position.x
      l.positionY.value = position.y
      l.positionZ.value = position.z
      l.forwardX.value = forward.x
      l.forwardY.value = forward.y
      l.forwardZ.value = forward.z
      l.upX.value = up.x
      l.upY.value = up.y
      l.upZ.value = up.z
    } else {
      // Older Safari
      l.setPosition(position.x, position.y, position.z)
      l.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z)
    }

    // Travel-time delays only need refreshing ~10 times a second.
    this._delayTimer += dt
    if (this._delayTimer > 0.1) {
      this._delayTimer = 0
      this._updateDelays(position)
    }
  }

  _updateDelays(position) {
    const now = this.ctx.currentTime
    const distances = this.nodes.map((n) =>
      Math.hypot(n.sp.pos[0] - position.x, n.sp.pos[1] - position.y, n.sp.pos[2] - position.z),
    )
    const nearest = Math.min(...distances)
    this.nodes.forEach((n, i) => {
      const seconds = Math.min(MAX_DELAY, (distances[i] - nearest) / AUDIO_MODEL.speedOfSound)
      n.delay.delayTime.setTargetAtTime(seconds, now, 0.05)
    })
  }

  /** Current loudness (0..1) of each speaker, for the UI meters. */
  getActivity() {
    const out = {}
    for (const n of this.nodes) {
      n.analyser.getFloatTimeDomainData(this._tmp)
      let sum = 0
      for (let i = 0; i < this._tmp.length; i++) sum += this._tmp[i] * this._tmp[i]
      out[n.sp.id] = Math.min(1, Math.sqrt(sum / this._tmp.length) * 4)
    }
    return out
  }

  // ---- Settings --------------------------------------------------------------

  setVolume(volume, muted) {
    this.volume = volume
    this.muted = muted
    this._applyVolume()
  }

  _applyVolume() {
    if (!this.ctx) return
    const target = this.muted ? 0 : this.volume * 0.9
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.03)
  }

  setSpatial(on) {
    this.spatial = on
    this._applyRouting()
  }

  _applyRouting() {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    this.spatialBus.gain.setTargetAtTime(this.spatial ? 1 : 0, t, 0.05)
    this.stereoBus.gain.setTargetAtTime(this.spatial ? 0 : 0.7, t, 0.05)
  }

  setHrtf(on) {
    this.hrtf = on
    for (const n of this.nodes) n.panner.panningModel = on ? 'HRTF' : 'equalpower'
  }

  setSurroundLevel(k) {
    this.surroundLevel = k
    if (!this.ctx) return
    for (const n of this.nodes) {
      if (n.sp.group === 'side' || n.sp.group === 'rear') n.bus.gain.setTargetAtTime(n.sp.trim * k, this.ctx.currentTime, 0.05)
    }
  }

  setBassLevel(k) {
    this.bassLevel = k
    if (!this.ctx) return
    for (const n of this.nodes) {
      if (n.sp.group === 'bass') n.bus.gain.setTargetAtTime(n.sp.trim * k, this.ctx.currentTime, 0.05)
    }
  }

  /** Turn the built-in demo soundtrack on/off (used when no video file exists). */
  setDemoActive(on) {
    if (!this.ctx) return
    this.demoGain.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.03)
  }
}

// ---- Helpers ------------------------------------------------------------------

function setPannerPosition(p, [x, y, z]) {
  if (p.positionX) {
    p.positionX.value = x
    p.positionY.value = y
    p.positionZ.value = z
  } else p.setPosition(x, y, z)
}

function setPannerOrientation(p, [x, y, z]) {
  if (p.orientationX) {
    p.orientationX.value = x
    p.orientationY.value = y
    p.orientationZ.value = z
  } else p.setOrientation(x, y, z)
}

/**
 * Builds an 8-second looping stereo test track: kick (centre), hi-hats that
 * alternate left/right, an arpeggio that sweeps left -> right, and a wide pad
 * (different in each ear, so the "surround" speakers have something to play).
 * All frequencies fit a whole number of cycles in 8 s so the loop is click-free.
 */
function createDemoBuffer(ctx) {
  const sr = ctx.sampleRate
  const seconds = 8
  const n = sr * seconds
  const buffer = ctx.createBuffer(2, n, sr)
  const L = buffer.getChannelData(0)
  const R = buffer.getChannelData(1)

  const beat = 0.5 // 120 BPM
  const step = beat / 2
  const notes = [220, 261.63, 329.63, 392, 329.63, 261.63, 293.66, 246.94]
  const TWO_PI = Math.PI * 2

  for (let i = 0; i < n; i++) {
    const t = i / sr

    // Kick drum: sine that sweeps from ~120 Hz down to 45 Hz.
    const bt = t % beat
    const kick = Math.sin(TWO_PI * (45 * bt + 2.5 * (1 - Math.exp(-30 * bt)))) * Math.exp(-bt * 9) * 0.9

    // Hi-hat on the off-beat, alternating sides.
    const hb = (t + beat / 2) % beat
    const hatSide = Math.floor((t + beat / 2) / beat) % 2
    const hat = (Math.random() * 2 - 1) * Math.exp(-hb * 60) * 0.22

    // Arpeggio that pans slowly across the loop.
    const idx = Math.floor(t / step) % notes.length
    const st = t % step
    const f = notes[idx]
    const arp = (Math.sin(TWO_PI * f * st) + 0.3 * Math.sin(TWO_PI * f * 2 * st)) * Math.exp(-st * 8) * 0.22
    const pan = 0.5 + 0.5 * Math.sin((t / seconds) * TWO_PI)

    // Wide pad: slightly different tones in each ear.
    const trem = 0.7 + 0.3 * Math.sin((t / seconds) * TWO_PI)
    const padL = (Math.sin(TWO_PI * 110 * t) + Math.sin(TWO_PI * 165 * t) + Math.sin(TWO_PI * 220 * t)) * 0.035 * trem
    const padR = (Math.sin(TWO_PI * 110.5 * t) + Math.sin(TWO_PI * 165.5 * t) + Math.sin(TWO_PI * 220.5 * t)) * 0.035 * trem

    L[i] = Math.tanh(kick + hat * (hatSide === 0 ? 1 : 0.25) + arp * (1 - pan) * 1.4 + padL)
    R[i] = Math.tanh(kick + hat * (hatSide === 1 ? 1 : 0.25) + arp * pan * 1.4 + padR)
  }
  return buffer
}

export const audio = new SpatialAudio()
