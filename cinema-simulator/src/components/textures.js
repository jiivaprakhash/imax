// Procedural carpet texture (no image files needed).
import * as THREE from 'three'

let carpetCanvas = null

function getCarpetCanvas() {
  if (carpetCanvas) return carpetCanvas
  const size = 256
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#3a0f1b'
  ctx.fillRect(0, 0, size, size)

  // Fibre speckle
  for (let i = 0; i < 5000; i++) {
    const v = Math.random()
    ctx.fillStyle = v > 0.5 ? 'rgba(120,40,60,0.18)' : 'rgba(0,0,0,0.22)'
    ctx.fillRect(Math.random() * size, Math.random() * size, 1.5, 1.5)
  }

  // Diamond lattice that tiles seamlessly
  ctx.strokeStyle = 'rgba(210,150,90,0.16)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, size / 2); ctx.lineTo(size / 2, 0); ctx.lineTo(size, size / 2); ctx.lineTo(size / 2, size); ctx.closePath()
  ctx.stroke()
  ctx.fillStyle = 'rgba(210,150,90,0.18)'
  ctx.beginPath(); ctx.arc(size / 2, size / 2, 5, 0, Math.PI * 2); ctx.fill()

  carpetCanvas = c
  return c
}

/** A carpet texture tiled roughly every 1.5 m across a surface of w x d metres. */
export function makeCarpet(w, d) {
  const tex = new THREE.CanvasTexture(getCarpetCanvas())
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(Math.max(1, w / 1.5), Math.max(1, d / 1.5))
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}
