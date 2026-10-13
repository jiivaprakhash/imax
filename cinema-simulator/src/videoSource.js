// -----------------------------------------------------------------------------
// videoSource.js
// Owns the single <video> element used for the cinema screen AND its audio.
// Also provides a built-in "demo screen" (an animated canvas) that is shown if
// public/videos/cinema-loop.mp4 is missing, so the app is always usable.
// -----------------------------------------------------------------------------

import * as THREE from 'three'
import { useStore } from './store.js'

export const VIDEO_URL = `${import.meta.env.BASE_URL}videos/cinema-loop.mp4`

export const video = document.createElement('video')
video.src = VIDEO_URL
video.loop = true // loop forever
video.playsInline = true
video.preload = 'auto'
video.crossOrigin = 'anonymous'
// NOTE: we do NOT use video.muted. Sound goes through the Web Audio graph
// (see SpatialAudio.js), and muting is done there.

video.addEventListener('loadeddata', () => useStore.getState().setVideoStatus('ready'))
video.addEventListener('error', () => {
  useStore.getState().setVideoStatus('missing')
})

/** Average colour of the screen. The lighting reads this so the room glows with the film. */
export const screenGlow = { r: 0.3, g: 0.3, b: 0.35, level: 0.2 }

// ---- Demo screen ------------------------------------------------------------

export function createDemoScreen() {
  const canvas = document.createElement('canvas')
  canvas.width = 960
  canvas.height = 540
  const ctx = canvas.getContext('2d')
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return { canvas, ctx, texture }
}

export function drawDemoFrame({ ctx, canvas }, t, playing) {
  const w = canvas.width
  const h = canvas.height
  const grad = ctx.createLinearGradient(0, 0, w, h)
  const hue = (t * 12) % 360
  grad.addColorStop(0, `hsl(${hue}, 70%, 14%)`)
  grad.addColorStop(1, `hsl(${(hue + 70) % 360}, 80%, 28%)`)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  // Equalizer bars (move only while "playing")
  const bars = 32
  for (let i = 0; i < bars; i++) {
    const v = playing ? 0.35 + 0.35 * Math.sin(t * 3 + i * 0.6) * Math.sin(t * 1.3 + i * 0.2) + 0.15 * Math.sin(t * 7 + i) : 0.12
    const bh = Math.max(6, v * 220)
    ctx.fillStyle = `hsla(${(hue + i * 4) % 360}, 90%, 62%, 0.85)`
    ctx.fillRect(40 + i * 28, h - 70 - bh, 18, bh)
  }

  // A sweeping dot shows left/right movement of the demo soundtrack.
  const sweep = 0.5 + 0.5 * Math.sin((t / 8) * Math.PI * 2)
  ctx.fillStyle = '#ffd089'
  ctx.beginPath()
  ctx.arc(60 + sweep * (w - 120), 70, 14, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.font = '700 54px "Instrument Sans", sans-serif'
  ctx.fillText('Demo screen', w / 2, 200)
  ctx.font = '400 26px "Instrument Sans", sans-serif'
  ctx.fillText('Add your film at public/videos/cinema-loop.mp4', w / 2, 250)
  ctx.fillText(playing ? 'Test soundtrack playing' : 'Paused', w / 2, 290)
}
