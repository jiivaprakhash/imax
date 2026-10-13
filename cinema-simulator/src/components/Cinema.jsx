// -----------------------------------------------------------------------------
// Cinema.jsx
// The auditorium shell: floor, stepped seating platforms, walls, ceiling,
// stage, curtains, projector beam and the invisible collision walls.
// Seats, screen, speakers and lights are separate components (see below).
// -----------------------------------------------------------------------------

import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { Instances, Instance, Sparkles, Environment, Lightformer } from '@react-three/drei'
import { ROOM, SCREEN, STAGE, SEAT_LAYOUT, rowCenterZ, platformTop } from '../cinemaLayout.js'
import { useStore } from '../store.js'
import { makeCarpet } from './textures.js'
import CinemaScreen from './CinemaScreen.jsx'
import SeatRows from './SeatRows.jsx'
import Speakers from './Speakers.jsx'
import Lighting from './Lighting.jsx'

const roomLength = ROOM.maxZ - ROOM.minZ
const roomCenterZ = (ROOM.maxZ + ROOM.minZ) / 2

export default function Cinema() {
  const shadows = useStore((s) => s.settings.shadows)
  const particles = useStore((s) => s.settings.particles)
  const playing = useStore((s) => s.playing)

  return (
    <>
      <color attach="background" args={['#050304']} />
      <fog attach="fog" args={['#070406', 16, 50]} />

      <Lighting />
      <Reflections />

      <Floor receiveShadow={shadows} />
      <Platforms receiveShadow={shadows} />
      <Walls />
      <Ceiling />
      <Stage />
      <ExitDoors />
      <Collision />

      <CinemaScreen />
      <Speakers />
      <SeatRows />

      {playing && <ProjectorBeam />}
      {particles && playing && (
        <Sparkles count={110} scale={[10, 5, 18]} position={[0, 5.5, -2]} size={2.2} speed={0.12} opacity={0.3} color="#ffffff" />
      )}
    </>
  )
}

// Soft studio-style reflections (generated in code, no downloads).
function Reflections() {
  return (
    <Environment resolution={128} frames={1}>
      <Lightformer form="rect" intensity={1.2} position={[0, 5.4, -12]} scale={[12, 6.75, 1]} color="#9db4ff" />
      <Lightformer form="rect" intensity={0.35} position={[0, 9.5, 0]} rotation-x={Math.PI / 2} scale={[16, 10, 1]} color="#ffd9a0" />
    </Environment>
  )
}

function Floor({ receiveShadow }) {
  const map = useMemo(() => makeCarpet(ROOM.width, roomLength), [])
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, roomCenterZ]} receiveShadow={receiveShadow}>
      <planeGeometry args={[ROOM.width, roomLength]} />
      <meshStandardMaterial map={map} roughness={0.95} envMapIntensity={0.3} />
    </mesh>
  )
}

// Each row sits on its own step. Row A is at floor level, so it needs no platform.
function Platforms({ receiveShadow }) {
  const rows = SEAT_LAYOUT.rows
  const items = useMemo(() => {
    const list = []
    for (let r = 1; r < rows; r++) {
      const height = platformTop(r)
      const start = rowCenterZ(r) - SEAT_LAYOUT.rowPitch / 2
      const end = r === rows - 1 ? ROOM.maxZ : start + SEAT_LAYOUT.rowPitch // last step runs to the back wall
      const depth = end - start
      list.push({ r, height, start, depth, map: makeCarpet(ROOM.width, depth) })
    }
    return list
  }, [rows])

  return (
    <>
      {items.map(({ r, height, start, depth, map }) => (
        <group key={r}>
          <mesh position={[0, height / 2, start + depth / 2]} receiveShadow={receiveShadow}>
            <boxGeometry args={[ROOM.width, height, depth]} />
            <meshStandardMaterial map={map} roughness={0.95} envMapIntensity={0.3} />
          </mesh>
          {/* Amber step-edge light, like a real auditorium */}
          <mesh position={[0, height - 0.02, start + 0.03]}>
            <boxGeometry args={[ROOM.width, 0.03, 0.05]} />
            <meshStandardMaterial color="#3a2208" emissive="#ffb347" emissiveIntensity={1.4} />
          </mesh>
        </group>
      ))}
    </>
  )
}

function Walls() {
  const slatZ = useMemo(() => {
    const z = []
    for (let v = ROOM.minZ + 2; v < ROOM.maxZ - 0.5; v += 1.4) z.push(v)
    return z
  }, [])

  const wallMat = <meshStandardMaterial color="#1c1016" roughness={0.95} envMapIntensity={0.2} />

  return (
    <group>
      {/* Wall surfaces */}
      <mesh position={[-ROOM.width / 2, ROOM.height / 2, roomCenterZ]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[roomLength, ROOM.height]} />
        {wallMat}
      </mesh>
      <mesh position={[ROOM.width / 2, ROOM.height / 2, roomCenterZ]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[roomLength, ROOM.height]} />
        {wallMat}
      </mesh>
      <mesh position={[0, ROOM.height / 2, ROOM.maxZ]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[ROOM.width, ROOM.height]} />
        {wallMat}
      </mesh>
      <mesh position={[0, ROOM.height / 2, ROOM.minZ]}>
        <planeGeometry args={[ROOM.width, ROOM.height]} />
        {wallMat}
      </mesh>

      {/* Wooden acoustic slats on both side walls */}
      <Instances limit={64}>
        <boxGeometry args={[0.18, 7.8, 0.5]} />
        <meshStandardMaterial color="#3b2418" roughness={0.6} envMapIntensity={0.5} />
        {slatZ.map((z) => (
          <Instance key={`l${z}`} position={[-ROOM.width / 2 + 0.1, 4.6, z]} />
        ))}
        {slatZ.map((z) => (
          <Instance key={`r${z}`} position={[ROOM.width / 2 - 0.1, 4.6, z]} />
        ))}
      </Instances>
    </group>
  )
}

function Ceiling() {
  const zs = useMemo(() => {
    const z = []
    for (let v = ROOM.minZ + 1; v < ROOM.maxZ; v += 1.6) z.push(v)
    return z
  }, [])
  return (
    <group>
      <mesh position={[0, ROOM.height, roomCenterZ]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ROOM.width, roomLength]} />
        <meshStandardMaterial color="#120a0d" roughness={1} />
      </mesh>
      {/* Hanging acoustic baffles */}
      <Instances limit={32}>
        <boxGeometry args={[ROOM.width - 1, 0.35, 0.4]} />
        <meshStandardMaterial color="#1a1013" roughness={0.9} />
        {zs.map((z) => (
          <Instance key={z} position={[0, ROOM.height - 0.45, z]} />
        ))}
      </Instances>
      {/* Recessed warm light strips between baffles */}
      <Instances limit={32}>
        <boxGeometry args={[ROOM.width - 3, 0.03, 0.12]} />
        <meshStandardMaterial color="#2a1a0a" emissive="#ffcf8a" emissiveIntensity={0.9} toneMapped={false} />
        {zs.map((z) => (
          <Instance key={z} position={[0, ROOM.height - 0.04, z + 0.8]} />
        ))}
      </Instances>
    </group>
  )
}

function Stage() {
  const halfW = SCREEN.width / 2
  const [cx, cy, cz] = SCREEN.center
  const stageDepth = STAGE.backZ - STAGE.frontZ
  return (
    <group>
      {/* Raised stage */}
      <mesh position={[0, STAGE.height / 2, STAGE.frontZ + stageDepth / 2]}>
        <boxGeometry args={[ROOM.width, STAGE.height, stageDepth]} />
        <meshStandardMaterial color="#2a1c14" roughness={0.45} metalness={0.1} envMapIntensity={0.8} />
      </mesh>
      {/* Black masking behind the screen */}
      <mesh position={[cx, cy, cz - 0.04]}>
        <boxGeometry args={[SCREEN.width + 0.8, SCREEN.height + 0.8, 0.05]} />
        <meshStandardMaterial color="#030303" roughness={1} />
      </mesh>
      {/* Velvet curtains and valance */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (halfW + 1.5), cy, cz + 0.2]}>
          <boxGeometry args={[2.2, SCREEN.height + 2.4, 0.5]} />
          <meshStandardMaterial color="#5a0f23" roughness={1} />
        </mesh>
      ))}
      <mesh position={[0, cy + SCREEN.height / 2 + 1.5, cz + 0.2]}>
        <boxGeometry args={[SCREEN.width + 5.2, 1.1, 0.5]} />
        <meshStandardMaterial color="#4a0c1d" roughness={1} />
      </mesh>
    </group>
  )
}

function ExitDoors() {
  const baseY = platformTop(SEAT_LAYOUT.rows - 1)
  return (
    <group>
      {[-8, 8].map((x) => (
        <group key={x}>
          <mesh position={[x, baseY + 1.3, ROOM.maxZ - 0.03]}>
            <boxGeometry args={[1.5, 2.6, 0.06]} />
            <meshStandardMaterial color="#0e0708" roughness={0.7} />
          </mesh>
          <mesh position={[x, baseY + 3.0, ROOM.maxZ - 0.07]}>
            <boxGeometry args={[0.7, 0.22, 0.04]} />
            <meshStandardMaterial color="#0a2a14" emissive="#3ddc97" emissiveIntensity={1.8} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {/* Projection booth window */}
      <mesh position={[0, 7.2, ROOM.maxZ - 0.04]}>
        <boxGeometry args={[1.0, 0.5, 0.05]} />
        <meshStandardMaterial color="#111" emissive="#dbe8ff" emissiveIntensity={1.2} toneMapped={false} />
      </mesh>
    </group>
  )
}

// A faint cone of projector light from the booth to the screen.
function ProjectorBeam() {
  const group = useRef()
  const origin = [0, 7.2, ROOM.maxZ - 0.2]
  const length = useMemo(() => Math.hypot(SCREEN.center[0] - origin[0], SCREEN.center[1] - origin[1], SCREEN.center[2] - origin[2]), [])
  useLayoutEffect(() => {
    group.current.lookAt(...SCREEN.center) // +Z of the group now points at the screen
  }, [])
  return (
    <group ref={group} position={origin}>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, length / 2]} scale={[1, 1, 0.55]}>
        <cylinderGeometry args={[SCREEN.width / 2, 0.08, length, 40, 1, true]} />
        <meshBasicMaterial color="#cfe0ff" transparent opacity={0.035} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} fog={false} />
      </mesh>
    </group>
  )
}

// Invisible solid walls the physics engine uses to stop the player.
// (Seats have their own colliders in SeatRows.jsx.)
function Collision() {
  const halfW = ROOM.width / 2
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[0.5, 8, roomLength / 2 + 1]} position={[-halfW - 0.5, 8, roomCenterZ]} />
      <CuboidCollider args={[0.5, 8, roomLength / 2 + 1]} position={[halfW + 0.5, 8, roomCenterZ]} />
      <CuboidCollider args={[halfW + 1, 8, 0.5]} position={[0, 8, ROOM.maxZ + 0.5]} />
      {/* Solid stage block: keeps visitors off the stage and away from the screen */}
      <CuboidCollider
        args={[halfW + 1, 8, (STAGE.backZ - STAGE.frontZ) / 2 + 0.5]}
        position={[0, 8, (STAGE.frontZ + STAGE.backZ) / 2 - 0.5]}
      />
    </RigidBody>
  )
}
