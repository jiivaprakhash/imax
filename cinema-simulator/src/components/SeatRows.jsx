// -----------------------------------------------------------------------------
// SeatRows.jsx
// Places every seat and gives each one a solid collider so you cannot walk
// through them. All colliders share one fixed physics body (cheap).
// -----------------------------------------------------------------------------

import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { SEATS } from '../cinemaLayout.js'
import Seat from './Seat.jsx'

export default function SeatRows() {
  return (
    <>
      {SEATS.map((seat) => (
        <Seat key={seat.id} seat={seat} />
      ))}

      <RigidBody type="fixed" colliders={false}>
        {SEATS.map((s) => (
          <CuboidCollider key={s.id} args={[0.36, 0.55, 0.28]} position={[s.x, s.y + 0.55, s.z + 0.03]} />
        ))}
      </RigidBody>
    </>
  )
}
