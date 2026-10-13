// -----------------------------------------------------------------------------
// Seat.jsx
// One cinema seat. It knows its own id (e.g. "E8") and changes colour when it
// is the seat you are sitting in (gold) or standing next to (soft glow).
// Geometry and materials are created once and shared by all 144 seats.
// -----------------------------------------------------------------------------

import { memo } from 'react'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import { useStore } from '../store.js'

const geo = {
  base: new THREE.BoxGeometry(0.4, 0.34, 0.4),
  cushion: new THREE.BoxGeometry(0.58, 0.14, 0.5),
  back: new THREE.BoxGeometry(0.58, 0.68, 0.12),
  arm: new THREE.BoxGeometry(0.07, 0.1, 0.46),
}

const mat = {
  velvet: new THREE.MeshStandardMaterial({ color: '#7a1527', roughness: 0.88, envMapIntensity: 0.4 }),
  near: new THREE.MeshStandardMaterial({ color: '#a8334a', roughness: 0.8, emissive: '#5a1626', emissiveIntensity: 0.6 }),
  selected: new THREE.MeshStandardMaterial({ color: '#e0a75b', roughness: 0.5, emissive: '#e0a75b', emissiveIntensity: 0.55 }),
  frame: new THREE.MeshStandardMaterial({ color: '#1a1214', roughness: 0.5, metalness: 0.3, envMapIntensity: 0.6 }),
}

function Seat({ seat }) {
  // Each seat only re-renders when ITS OWN status changes.
  const status = useStore((s) => (s.seatedId === seat.id ? 'selected' : s.nearSeatId === seat.id ? 'near' : 'idle'))
  const shadows = useStore((s) => s.settings.shadows)
  const fabric = status === 'selected' ? mat.selected : status === 'near' ? mat.near : mat.velvet

  return (
    <group position={[seat.x, seat.y, seat.z]}>
      <mesh geometry={geo.base} material={mat.frame} position={[0, 0.17, 0]} castShadow={shadows} />
      <mesh geometry={geo.cushion} material={fabric} position={[0, 0.41, 0]} castShadow={shadows} />
      {/* The back leans slightly away from the screen */}
      <mesh geometry={geo.back} material={fabric} position={[0, 0.77, 0.24]} rotation={[0.12, 0, 0]} castShadow={shadows} />
      <mesh geometry={geo.arm} material={mat.frame} position={[-0.325, 0.56, 0]} />
      <mesh geometry={geo.arm} material={mat.frame} position={[0.325, 0.56, 0]} />
      {status !== 'idle' && (
        <Html position={[0, 1.4, 0]} center distanceFactor={7} style={{ pointerEvents: 'none' }}>
          <div className={`seat-tag ${status}`}>{seat.id}</div>
        </Html>
      )}
    </group>
  )
}

export default memo(Seat)
