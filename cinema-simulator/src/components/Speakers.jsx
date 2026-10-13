// -----------------------------------------------------------------------------
// Speakers.jsx
// Draws each virtual speaker at the same position used by the audio engine.
// The little amber ring pulses with the speaker's live loudness, so you can
// literally see which speakers are working.
// -----------------------------------------------------------------------------

import { useLayoutEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { SPEAKERS } from '../cinemaLayout.js'
import { audio } from '../SpatialAudio.js'

const SIZE = {
  front: [0.9, 1.3, 0.5],
  side: [0.5, 0.8, 0.4],
  rear: [0.5, 0.8, 0.4],
  bass: [1.2, 0.9, 0.9],
}

export default function Speakers() {
  const glowRefs = useRef({})
  const activity = useRef({})
  const timer = useRef(0)

  useFrame((_, dt) => {
    timer.current += dt
    if (timer.current > 0.06) {
      timer.current = 0
      if (audio.ready) activity.current = audio.getActivity()
    }
    for (const sp of SPEAKERS) {
      const m = glowRefs.current[sp.id]
      if (!m) continue
      const a = activity.current[sp.id] || 0
      m.material.emissiveIntensity += (0.15 + a * 3.5 - m.material.emissiveIntensity) * Math.min(1, dt * 12)
    }
  })

  return (
    <>
      {SPEAKERS.map((sp) => (
        <SpeakerBox key={sp.id} sp={sp} registerGlow={(m) => (glowRefs.current[sp.id] = m)} />
      ))}
    </>
  )
}

function SpeakerBox({ sp, registerGlow }) {
  const group = useRef()
  const size = SIZE[sp.group]

  // Point the speaker face (+Z) toward the audience.
  useLayoutEffect(() => {
    group.current.lookAt(sp.pos[0] + sp.facing[0], sp.pos[1] + sp.facing[1], sp.pos[2] + sp.facing[2])
  }, [sp])

  return (
    <group ref={group} position={sp.pos}>
      <mesh castShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color="#0f0b0c" roughness={0.6} metalness={0.2} />
      </mesh>
      {/* Speaker cone */}
      <mesh position={[0, 0, size[2] / 2 + 0.005]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[Math.min(size[0], size[1]) * 0.32, Math.min(size[0], size[1]) * 0.32, 0.02, 24]} />
        <meshStandardMaterial color="#1c1416" roughness={0.4} metalness={0.4} />
      </mesh>
      {/* Pulsing ring */}
      <mesh ref={registerGlow} position={[0, 0, size[2] / 2 + 0.012]}>
        <ringGeometry args={[Math.min(size[0], size[1]) * 0.36, Math.min(size[0], size[1]) * 0.42, 32]} />
        <meshStandardMaterial color="#2a1a08" emissive="#ffb347" emissiveIntensity={0.15} toneMapped={false} />
      </mesh>
    </group>
  )
}
