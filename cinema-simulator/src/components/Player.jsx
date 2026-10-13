// -----------------------------------------------------------------------------
// Player.jsx
// First-person movement + sitting.
//
//   * Mouse look  : drei's PointerLockControls turns the camera.
//   * Walking     : a capsule-shaped physics body (Rapier) is pushed with WASD.
//                   Rapier stops it at walls, the stage and seats.
//   * Gravity     : the floor is "stadium style" (each row is one step higher).
//                   Each frame we measure the floor height under the player and
//                   glide the body up/down to it. That gives smooth stair
//                   climbing without the usual physics-capsule step snagging.
//   * Sitting     : the physics body is switched off and the camera glides to
//                   the seat's eye position, turning toward the screen.
//   * Standing    : the body is switched back on in the legroom in front of
//                   the seat and you can walk again.
//   * Audio       : the Web Audio "listener" follows the camera every frame.
// -----------------------------------------------------------------------------

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'
import { RigidBody, CapsuleCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { SEATS, SEATS_BY_ID, SEAT_LAYOUT, SCREEN, floorHeightAt } from '../cinemaLayout.js'
import { useStore } from '../store.js'
import { bridge } from '../bridge.js'
import { audio } from '../SpatialAudio.js'

const WALK_SPEED = 2.4 // m/s
const RUN_SPEED = 4.2
const BODY_CENTER = 0.8 // capsule is 1.6 m tall; its centre is 0.8 m above the feet
const EYE_ABOVE_CENTER = SEAT_LAYOUT.eyeHeightStanding - BODY_CENTER
const SPAWN = { x: 0, z: 7 } // top of the aisle at the back of the auditorium
const NEAR_SEAT_RANGE = 1.5

const clamp = THREE.MathUtils.clamp
const damp = THREE.MathUtils.damp
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

export default function Player() {
  const { camera, gl } = useThree()
  const controls = useRef()
  const body = useRef()
  const keys = useRef({})

  // Reusable objects (avoids creating garbage every frame)
  const t = useRef({
    vel: new THREE.Vector3(),
    dir: new THREE.Vector3(),
    flat: new THREE.Vector3(),
    right: new THREE.Vector3(),
    move: new THREE.Vector3(),
    up: new THREE.Vector3(0, 1, 0),
    camUp: new THREE.Vector3(),
    cam: new THREE.Vector3(0, 3.7, 7.6), // smoothed camera position
    m: new THREE.Matrix4(),
  }).current

  const prevSeated = useRef(null)
  const wasEntered = useRef(false)
  const anim = useRef(null) // active "sit down" camera glide
  const settle = useRef(0) // seconds of slow camera smoothing left
  const frame = useRef(0)
  const poseTimer = useRef(0)

  // ---- Keyboard ----------------------------------------------------------------
  useEffect(() => {
    const GAME_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Space']
    const down = (e) => {
      if (!GAME_KEYS.includes(e.code)) return
      if (useStore.getState().entered && e.target.tagName !== 'INPUT') e.preventDefault()
      keys.current[e.code] = true
    }
    const up = (e) => (keys.current[e.code] = false)
    const reset = () => (keys.current = {})
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', reset)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', reset)
    }
  }, [])

  // ---- Let the HTML UI capture / release the mouse -------------------------------
  useEffect(() => {
    bridge.lock = () => controls.current?.lock()
    bridge.unlock = () => controls.current?.unlock()
    useStore.getState().setSceneReady(true)
    // Clicking the 3D view re-captures the mouse after pressing Esc.
    const onClick = () => {
      if (useStore.getState().entered && !controls.current?.isLocked) controls.current?.lock()
    }
    gl.domElement.addEventListener('click', onClick)
    return () => gl.domElement.removeEventListener('click', onClick)
  }, [gl])

  // ---- Every frame ----------------------------------------------------------------
  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const rb = body.current
    if (!rb) return
    const store = useStore.getState()

    // Camera field of view from settings
    if (camera.fov !== store.settings.fov) {
      camera.fov = store.settings.fov
      camera.updateProjectionMatrix()
    }

    // Before pressing "Enter cinema": a slow, gentle view of the auditorium.
    if (!store.entered) {
      const time = state.clock.elapsedTime
      camera.position.set(Math.sin(time * 0.15) * 1.2, 3.7, 7.6)
      camera.lookAt(Math.sin(time * 0.1) * 1.5, 4.4, -13.6)
      t.cam.copy(camera.position)
      return
    }
    if (!wasEntered.current) {
      wasEntered.current = true
      settle.current = 1.4 // glide from the lobby view to eye level
      camera.lookAt(0, 3.6, -13.6)
    }

    // ---- Detect sit / stand requests (from E key or UI buttons) ----
    const seatedId = store.seatedId
    if (seatedId !== prevSeated.current) {
      if (seatedId) beginSit(seatedId)
      else endSit(prevSeated.current)
      prevSeated.current = seatedId
    }

    camera.getWorldDirection(t.dir)

    if (seatedId) {
      runSeated(dt, seatedId)
    } else {
      runWalking(dt, rb, store)
    }

    // Move the audio "ears" to the camera
    t.camUp.set(0, 1, 0).applyQuaternion(camera.quaternion)
    audio.updateListener(camera.position, t.dir, t.camUp, dt)

    // Share position with the mini-map (a few times per second)
    poseTimer.current += dt
    if (poseTimer.current > 0.12) {
      poseTimer.current = 0
      const heading = Math.atan2(t.dir.x, -t.dir.z)
      store.setPlayerPose({ x: camera.position.x, z: camera.position.z, yaw: heading })
    }
  })

  // ---- Sitting down -------------------------------------------------------------------
  function beginSit(id) {
    const seat = SEATS_BY_ID[id]
    const eye = new THREE.Vector3(seat.eye.x, seat.eye.y, seat.eye.z)
    t.m.lookAt(eye, new THREE.Vector3(...SCREEN.center), t.up)
    const toQuat = new THREE.Quaternion().setFromRotationMatrix(t.m)
    const distance = camera.position.distanceTo(eye)
    anim.current = {
      t: 0,
      duration: clamp(0.8 + distance * 0.05, 0.8, 1.8),
      fromPos: camera.position.clone(),
      fromQuat: camera.quaternion.clone(),
      toPos: eye,
      toQuat,
    }
    body.current?.setEnabled(false) // no physics while seated
    useStore.getState().setNearSeat(null)
  }

  function runSeated(dt, id) {
    const seat = SEATS_BY_ID[id]
    const a = anim.current
    if (a) {
      a.t += dt / a.duration
      const k = easeInOut(clamp(a.t, 0, 1))
      camera.position.lerpVectors(a.fromPos, a.toPos, k)
      camera.quaternion.copy(a.fromQuat).slerp(a.toQuat, k)
      if (a.t >= 1) anim.current = null
    } else {
      // Locked at eye level; you can still look around freely with the mouse.
      camera.position.set(seat.eye.x, seat.eye.y, seat.eye.z)
    }
    t.cam.copy(camera.position)
  }

  // ---- Standing up ----------------------------------------------------------------------
  function endSit(id) {
    const rb = body.current
    anim.current = null
    if (!id || !rb) return
    const seat = SEATS_BY_ID[id]
    rb.setEnabled(true)
    rb.setTranslation({ x: seat.x, y: seat.y + BODY_CENTER + 0.02, z: seat.standZ }, true)
    rb.setLinvel({ x: 0, y: 0, z: 0 }, true)
    t.vel.set(0, 0, 0)
    t.cam.copy(camera.position)
    settle.current = 0.9
  }

  // ---- Walking -----------------------------------------------------------------------------
  function runWalking(dt, rb, store) {
    const k = keys.current
    const pos = rb.translation()

    // Movement direction relative to where you are looking (ignoring up/down)
    t.flat.copy(t.dir)
    t.flat.y = 0
    if (t.flat.lengthSq() < 1e-6) t.flat.set(0, 0, -1)
    t.flat.normalize()
    t.right.crossVectors(t.flat, t.up)

    t.move.set(0, 0, 0)
    if (store.locked) {
      if (k.KeyW || k.ArrowUp) t.move.add(t.flat)
      if (k.KeyS || k.ArrowDown) t.move.sub(t.flat)
      if (k.KeyD || k.ArrowRight) t.move.add(t.right)
      if (k.KeyA || k.ArrowLeft) t.move.sub(t.right)
    }
    const speed = k.ShiftLeft || k.ShiftRight ? RUN_SPEED : WALK_SPEED
    if (t.move.lengthSq() > 0) t.move.normalize().multiplyScalar(speed)
    t.vel.lerp(t.move, 1 - Math.exp(-14 * dt)) // gentle acceleration / braking

    // "Gravity": glide to the floor height under the player (handles steps).
    const targetY = floorHeightAt(pos.z) + BODY_CENTER
    const vy = clamp((targetY - pos.y) * 12, -9, 5)
    rb.setLinvel({ x: t.vel.x, y: vy, z: t.vel.z }, true)

    // Camera follows the body, with slight smoothing for step climbing
    const slow = settle.current > 0
    if (slow) settle.current -= dt
    const eyeY = pos.y + EYE_ABOVE_CENTER
    t.cam.x = damp(t.cam.x, pos.x, slow ? 6 : 40, dt)
    t.cam.z = damp(t.cam.z, pos.z, slow ? 6 : 40, dt)
    t.cam.y = damp(t.cam.y, eyeY, slow ? 6 : 14, dt)
    camera.position.copy(t.cam)

    // Find the seat you are standing next to (checked every 4th frame)
    frame.current++
    if (frame.current % 4 === 0) {
      const floorY = floorHeightAt(pos.z)
      let best = null
      let bestDist = NEAR_SEAT_RANGE
      for (const s of SEATS) {
        if (Math.abs(s.y - floorY) > 0.2) continue // different row level
        const d = Math.hypot(pos.x - s.x, pos.z - s.accessZ)
        if (d < bestDist) {
          bestDist = d
          best = s
        }
      }
      store.setNearSeat(best ? best.id : null)
    }
  }

  return (
    <>
      <PointerLockControls
        ref={controls}
        onLock={() => useStore.getState().setLocked(true)}
        onUnlock={() => useStore.getState().setLocked(false)}
      />
      <RigidBody
        ref={body}
        type="dynamic"
        colliders={false}
        position={[SPAWN.x, floorHeightAt(SPAWN.z) + BODY_CENTER, SPAWN.z]}
        enabledRotations={[false, false, false]}
        gravityScale={0}
        canSleep={false}
        linearDamping={0}
      >
        {/* 1.6 m tall capsule: half-height 0.5 + radius 0.3 at each end */}
        <CapsuleCollider args={[0.5, 0.3]} friction={0} />
      </RigidBody>
    </>
  )
}
