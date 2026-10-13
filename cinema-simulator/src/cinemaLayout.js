// -----------------------------------------------------------------------------
// cinemaLayout.js
// One place that describes the physical cinema. Everything else (3D scene,
// player, calculations, audio, UI) reads from here, so if you change a number
// the whole app updates together.
//
// Coordinates: metres. x = left/right, y = up, z = toward the audience.
// The screen is at the far negative-z end; the back wall is at positive z.
//
// This hall is a commercial IMAX with Laser house: 1.90:1 wall-to-wall screen,
// stadium rake, 330 seats.
// -----------------------------------------------------------------------------

export const ROOM = {
  width: 26, // x from -13 to +13
  minZ: -22, // front wall (behind the screen)
  maxZ: 7.5, // back wall
  height: 13,
}

export const SCREEN = {
  width: 18,
  height: 9.47, // 1.90:1 IMAX Digital / Laser
  center: [0, 5.89, -21.55],
}

export const STAGE = { frontZ: -22, backZ: -19.35, height: 0.4 }

export const SEAT_LAYOUT = {
  rows: 15, // A (front) ... O (back)
  perRow: 22, // 11 | aisle | 11
  rowPitch: 1.15,
  riser: 0.42,
  firstRowZ: -13.05,
  seatSpacing: 0.7,
  aisleGap: 1.5,
  seatDepthOffset: 0.22,
  eyeHeightSeated: 1.15,
  eyeHeightStanding: 1.65,
}

const { rows, perRow, rowPitch, riser, firstRowZ, seatSpacing, aisleGap, seatDepthOffset, eyeHeightSeated } =
  SEAT_LAYOUT

export const rowLabel = (r) => String.fromCharCode(65 + r)
export const rowCenterZ = (r) => firstRowZ + r * rowPitch
export const platformTop = (r) => r * riser

/**
 * Height of the floor at a given z. The auditorium is "stadium style":
 * every row is one step higher than the one in front of it.
 */
export function floorHeightAt(z) {
  const start = rowCenterZ(0) - rowPitch / 2
  if (z < start) return 0
  const r = Math.min(rows - 1, Math.floor((z - start) / rowPitch))
  return platformTop(r)
}

export const SEATS = []
for (let r = 0; r < rows; r++) {
  for (let i = 0; i < perRow; i++) {
    const x = (i - (perRow - 1) / 2) * seatSpacing + (i < perRow / 2 ? -aisleGap / 2 : aisleGap / 2)
    const y = platformTop(r)
    const z = rowCenterZ(r) + seatDepthOffset
    SEATS.push({
      id: `${rowLabel(r)}${i + 1}`,
      rowIndex: r,
      row: rowLabel(r),
      number: i + 1,
      x,
      y,
      z,
      eye: { x, y: y + eyeHeightSeated, z: z - 0.05 },
      standZ: z - 0.55,
      accessZ: z - 0.5,
    })
  }
}

export const SEATS_BY_ID = Object.fromEntries(SEATS.map((s) => [s.id, s]))
export const SEAT_COUNT = SEATS.length

// One physics box per seating block (left of aisle / right of aisle) per row.
export const ROW_COLLIDERS = []
for (let r = 0; r < rows; r++) {
  const rowSeats = SEATS.filter((s) => s.rowIndex === r)
  const left = rowSeats.filter((s) => s.x < 0)
  const right = rowSeats.filter((s) => s.x > 0)
  for (const block of [left, right]) {
    const minX = Math.min(...block.map((s) => s.x))
    const maxX = Math.max(...block.map((s) => s.x))
    const z = block[0].z
    const y = block[0].y
    ROW_COLLIDERS.push({
      args: [(maxX - minX) / 2 + 0.38, 0.55, 0.32],
      position: [(minX + maxX) / 2, y + 0.55, z + 0.03],
    })
  }
}

const AIM_POINT = [0, 3.2, -2]

function facingFrom(pos) {
  const v = [AIM_POINT[0] - pos[0], AIM_POINT[1] - pos[1], AIM_POINT[2] - pos[2]]
  const len = Math.hypot(...v)
  return v.map((n) => n / len)
}

const speaker = (id, label, group, pos, feed, trim = 1) => ({
  id,
  label,
  group,
  pos,
  facing: facingFrom(pos),
  feed,
  trim,
})

export const SPEAKERS = [
  speaker('FL', 'Front left', 'front', [-7.4, 6.4, -21.75], [['L', 1]]),
  speaker('C', 'Centre', 'front', [0, 6.2, -21.75], [['L', 0.5], ['R', 0.5]], 1.08),
  speaker('FR', 'Front right', 'front', [7.4, 6.4, -21.75], [['R', 1]]),
  speaker('SL1', 'Side left front', 'side', [-12.55, 5.4, -12.5], [['L', 0.55]], 0.92),
  speaker('SR1', 'Side right front', 'side', [12.55, 5.4, -12.5], [['R', 0.55]], 0.92),
  speaker('SL2', 'Side left mid', 'side', [-12.55, 5.9, -4.2], [['L', 0.5], ['R', -0.12]], 0.9),
  speaker('SR2', 'Side right mid', 'side', [12.55, 5.9, -4.2], [['R', 0.5], ['L', -0.12]], 0.9),
  speaker('SL3', 'Side left rear', 'side', [-12.55, 6.4, 2.2], [['L', 0.48], ['R', -0.16]], 0.88),
  speaker('SR3', 'Side right rear', 'side', [12.55, 6.4, 2.2], [['R', 0.48], ['L', -0.16]], 0.88),
  speaker('RL', 'Rear left', 'rear', [-6.2, 7.1, 7.05], [['L', 0.42], ['R', -0.2]], 0.84),
  speaker('RR', 'Rear right', 'rear', [6.2, 7.1, 7.05], [['R', 0.42], ['L', -0.2]], 0.84),
  speaker('LFE', 'Subwoofer', 'bass', [0, 0.5, -18.8], [['L', 0.5], ['R', 0.5]], 1.42),
]

export const AUDIO_MODEL = {
  refDistance: 4.2,
  rolloffFactor: 0.48, // stronger near-field so corners lean to the wall
  coneInner: 130,
  coneOuter: 250,
  coneOuterGain: 0.38,
  speedOfSound: 343,
  proximityMeters: 8.5, // extra gain when you sit next to a surround
  proximityBoost: 1.25,
}
