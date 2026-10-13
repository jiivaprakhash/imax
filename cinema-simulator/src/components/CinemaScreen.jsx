// -----------------------------------------------------------------------------
// CinemaScreen.jsx
// Draws the HTML <video> onto the 3D screen using a VideoTexture.
// If the video file is missing it shows an animated demo canvas instead.
// Every ~0.15 s it also samples the picture's average colour so the room can
// glow with the film (see Lighting.jsx).
// -----------------------------------------------------------------------------

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SCREEN } from '../cinemaLayout.js'
import { useStore } from '../store.js'
import { video, screenGlow, createDemoScreen, drawDemoFrame } from '../videoSource.js'

export default function CinemaScreen() {
  const status = useStore((s) => s.videoStatus)

  const videoTexture = useMemo(() => {
    const t = new THREE.VideoTexture(video)
    t.colorSpace = THREE.SRGBColorSpace
    t.minFilter = THREE.LinearFilter
    t.magFilter = THREE.LinearFilter
    t.generateMipmaps = false
    return t
  }, [])

  const demo = useMemo(() => createDemoScreen(), [])

  // Tiny canvas used to measure the average colour of the picture.
  const sampler = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 16
    c.height = 9
    return { canvas: c, ctx: c.getContext('2d', { willReadFrequently: true }) }
  }, [])

  const timer = useRef(0)
  const usingDemo = status === 'missing'

  useFrame((state, dt) => {
    const playing = useStore.getState().playing
    if (usingDemo) {
      drawDemoFrame(demo, state.clock.elapsedTime, playing)
      demo.texture.needsUpdate = true
    }

    timer.current += dt
    if (timer.current < 0.15) return
    timer.current = 0
    try {
      const source = usingDemo ? demo.canvas : video
      if (!usingDemo && video.readyState < 2) return
      sampler.ctx.drawImage(source, 0, 0, 16, 9)
      const data = sampler.ctx.getImageData(0, 0, 16, 9).data
      let r = 0, g = 0, b = 0
      const px = data.length / 4
      for (let i = 0; i < data.length; i += 4) {
        r += data[i]; g += data[i + 1]; b += data[i + 2]
      }
      screenGlow.r = r / px / 255
      screenGlow.g = g / px / 255
      screenGlow.b = b / px / 255
      screenGlow.level = 0.2126 * screenGlow.r + 0.7152 * screenGlow.g + 0.0722 * screenGlow.b
    } catch {
      /* Ignore: sampling is only a lighting nicety. */
    }
  })

  return (
    <mesh position={SCREEN.center}>
      <planeGeometry args={[SCREEN.width, SCREEN.height]} />
      {/* toneMapped=false keeps the video's colours exactly as encoded */}
      <meshBasicMaterial map={usingDemo ? demo.texture : videoTexture} toneMapped={false} />
    </mesh>
  )
}
