// -----------------------------------------------------------------------------
// Lighting.jsx
// * Dark "movie" lighting while the film plays; house lights fade up when you
//   pause (just like a real cinema).
// * The screen casts coloured light onto the audience that follows the picture.
// * One ceiling spotlight casts the soft shadows of the seats.
// -----------------------------------------------------------------------------

import { useLayoutEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { SCREEN } from '../cinemaLayout.js'
import { useStore } from '../store.js'
import { screenGlow } from '../videoSource.js'

RectAreaLightUniformsLib.init() // required once before using RectAreaLight

const lerp = THREE.MathUtils.lerp
const damp = THREE.MathUtils.damp

export default function Lighting() {
  const shadows = useStore((s) => s.settings.shadows)
  const ambient = useRef()
  const hemi = useRef()
  const spot = useRef()
  const area = useRef()
  const glowPoint = useRef()
  const house = useRef(1) // 0 = film dark, 1 = house lights up

  useLayoutEffect(() => {
    area.current.lookAt(0, 3, 6) // face the audience
  }, [])

  useFrame((_, dt) => {
    const playing = useStore.getState().playing
    house.current = damp(house.current, playing ? 0 : 1, 2.2, dt)
    const h = house.current

    ambient.current.intensity = lerp(0.7, 2.6, h)
    hemi.current.intensity = lerp(0.25, 1.0, h)
    spot.current.intensity = lerp(140, 800, h)

    const { r, g, b, level } = screenGlow
    area.current.color.setRGB(r, g, b, THREE.SRGBColorSpace)
    glowPoint.current.color.setRGB(r, g, b, THREE.SRGBColorSpace)
    const glow = (1 - h * 0.8) * (1.2 + level * 7)
    area.current.intensity = glow
    glowPoint.current.intensity = glow * 14
  })

  return (
    <>
      <ambientLight ref={ambient} color="#ffe6cf" intensity={0.7} />
      <hemisphereLight ref={hemi} args={['#8e7aa8', '#2a1218', 1]} />

      {/* Ceiling spotlight: soft seat shadows */}
      <spotLight
        ref={spot}
        position={[0, 9.4, -1]}
        angle={1.0}
        penumbra={1}
        distance={40}
        decay={2}
        color="#ffd9a8"
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-camera-near={1}
        shadow-camera-far={30}
      />

      {/* Colour spill from the screen */}
      <rectAreaLight ref={area} position={[0, SCREEN.center[1], SCREEN.center[2] + 0.4]} width={SCREEN.width} height={SCREEN.height} />
      <pointLight ref={glowPoint} position={[0, SCREEN.center[1] - 1, SCREEN.center[2] + 3]} distance={30} decay={2} />
    </>
  )
}
