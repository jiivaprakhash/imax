// Top-down map of the auditorium.
//  * every seat is coloured by its view-comfort score (a live heat map)
//  * the selected seat shows its view cone toward the screen edges
//  * speakers brighten with their estimated level at the selected seat
//  * click any seat to jump there
import { memo } from 'react'
import { useStore } from '../store.js'
import { ROOM, SCREEN, SEATS, SEATS_BY_ID, SPEAKERS } from '../cinemaLayout.js'
import { SEAT_COMFORT } from '../seatCalculations.js'

const S = 10 // pixels per metre
const px = (x) => (x + ROOM.width / 2) * S
const pz = (z) => (z - ROOM.minZ) * S
const W = ROOM.width * S
const H = (ROOM.maxZ - ROOM.minZ) * S

const hue = (comfort) => Math.round((comfort / 100) * 130)

function MiniMap({ speakerLevels }) {
  const seatedId = useStore((s) => s.seatedId)
  const pose = useStore((s) => s.playerPose)
  const pinned = useStore((s) => s.pinned)
  const sit = useStore.getState().sit
  const seat = seatedId ? SEATS_BY_ID[seatedId] : null

  const left = [px(SCREEN.center[0] - SCREEN.width / 2), pz(SCREEN.center[2])]
  const right = [px(SCREEN.center[0] + SCREEN.width / 2), pz(SCREEN.center[2])]

  return (
    <figure className="map">
      <svg viewBox={`-6 -6 ${W + 12} ${H + 12}`} role="img" aria-label="Top-down map of the cinema. The screen is at the top.">
        <rect x="0" y="0" width={W} height={H} rx="6" className="map__room" />

        {seat && (
          <polygon
            points={`${px(seat.eye.x)},${pz(seat.eye.z)} ${left.join(',')} ${right.join(',')}`}
            className="map__cone"
          />
        )}

        {/* Screen */}
        <line x1={left[0]} y1={left[1]} x2={right[0]} y2={right[1]} className="map__screen" />

        {/* Speakers */}
        {SPEAKERS.map((sp) => {
          const level = speakerLevels ? speakerLevels[sp.id] : 0.35
          return (
            <circle
              key={sp.id}
              cx={px(sp.pos[0])}
              cy={pz(sp.pos[2])}
              r={sp.group === 'bass' ? 5 : 4}
              className="map__speaker"
              style={{ opacity: 0.25 + 0.75 * level }}
            >
              <title>{sp.label}</title>
            </circle>
          )
        })}

        {/* Seats, coloured by comfort */}
        {SEATS.map((s) => (
          <rect
            key={s.id}
            x={px(s.x) - 3.2}
            y={pz(s.z) - 3.2}
            width="6.4"
            height="6.4"
            rx="1.5"
            fill={`hsl(${hue(SEAT_COMFORT[s.id])} 55% 42%)`}
            className={`map__seat ${s.id === seatedId ? 'is-selected' : ''} ${pinned.includes(s.id) ? 'is-pinned' : ''}`}
            onClick={() => sit(s.id)}
          >
            <title>{`Row ${s.row}, Seat ${s.number} · comfort ${SEAT_COMFORT[s.id]}/100`}</title>
          </rect>
        ))}

        {seat && <circle cx={px(seat.eye.x)} cy={pz(seat.eye.z)} r="7" className="map__you" />}

        {/* You, while walking */}
        {!seat && (
          <g transform={`translate(${px(pose.x)} ${pz(pose.z)}) rotate(${(pose.yaw * 180) / Math.PI})`}>
            <path d="M0,-8 L5,5 L0,2 L-5,5 Z" className="map__player" />
          </g>
        )}
      </svg>
      <figcaption>
        Screen at the top. Seat colour shows view comfort, from poor (red) to excellent (green). Click a seat to sit there.
      </figcaption>
    </figure>
  )
}

export default memo(MiniMap)
