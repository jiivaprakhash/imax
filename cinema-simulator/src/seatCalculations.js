// -----------------------------------------------------------------------------
// seatCalculations.js
// Pure maths (no React, no Three.js). Give it a seat and it returns:
//   * viewing geometry  (distance, off-axis angle, field of view, neck angle)
//   * a comfort score   (based on common cinema guidelines)
//   * speaker-by-speaker audio estimates and an overall surround score
//
// Everything is derived from the seat's 3D position, so changing the layout in
// cinemaLayout.js automatically changes every number.
// -----------------------------------------------------------------------------

import { SCREEN, SPEAKERS, SEATS, AUDIO_MODEL } from './cinemaLayout.js'

const toDeg = (r) => (r * 180) / Math.PI
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

/** Piecewise-linear lookup: ramp(x, [[x0,y0],[x1,y1],...]) */
function ramp(x, points) {
  if (x <= points[0][0]) return points[0][1]
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i]
    const [x0, y0] = points[i - 1]
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
  }
  return points[points.length - 1][1]
}

function angleBetween(a, b) {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  const la = Math.hypot(...a)
  const lb = Math.hypot(...b)
  return toDeg(Math.acos(clamp(dot / (la * lb), -1, 1)))
}

const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]]

// ---- Viewing geometry -------------------------------------------------------

export function computeViewMetrics(seat) {
  const eye = [seat.eye.x, seat.eye.y, seat.eye.z]
  const [cx, cy, cz] = SCREEN.center
  const halfW = SCREEN.width / 2
  const halfH = SCREEN.height / 2

  const centre = [cx, cy, cz]
  const left = [cx - halfW, cy, cz]
  const right = [cx + halfW, cy, cz]
  const top = [cx, cy + halfH, cz]
  const bottom = [cx, cy - halfH, cz]

  const distance = Math.hypot(...sub(centre, eye)) // straight line to screen centre
  const depth = eye[2] - cz // perpendicular distance to the screen plane

  // Angle between "straight at the screen" and "toward the screen centre".
  // Positive = the screen centre is to your right (you are left of centre).
  const offAxis = toDeg(Math.atan2(cx - eye[0], depth))

  // How much of your view the screen fills.
  const hFov = angleBetween(sub(left, eye), sub(right, eye))
  const vFov = angleBetween(sub(bottom, eye), sub(top, eye))

  // How far you tilt your head up to see the top edge.
  const topElevation = toDeg(Math.atan2(top[1] - eye[1], depth))

  // Perspective skew: how much nearer one screen edge is than the other.
  const dLeft = Math.hypot(...sub(left, eye))
  const dRight = Math.hypot(...sub(right, eye))
  const edgeRatio = Math.max(dLeft, dRight) / Math.min(dLeft, dRight)

  // --- Scores 0-100. Break-points follow common guidance: SMPTE suggests the
  // screen should fill at least ~30 degrees horizontally, THX suggests ~36-40
  // degrees as a target, and well over ~60 degrees makes you scan the picture.
  // IMAX with Laser: a huge picture is the point. Sweet spot ~55–75° wide.
  const fovScore = ramp(hFov, [[18, 8], [36, 42], [50, 82], [62, 100], [75, 96], [88, 68], [110, 22]])
  const offAxisScore = ramp(Math.abs(offAxis), [[0, 100], [12, 100], [22, 82], [32, 55], [42, 28], [58, 0]])
  const verticalScore = ramp(topElevation, [[8, 86], [18, 100], [28, 90], [38, 52], [48, 18], [60, 0]])

  const comfort = Math.round(0.5 * fovScore + 0.25 * offAxisScore + 0.25 * verticalScore)

  // Explain the weakest factor in plain language.
  const weakest = Object.entries({ fov: fovScore, off: offAxisScore, vert: verticalScore }).sort((a, b) => a[1] - b[1])[0]
  let advice = 'A balanced IMAX view: the screen fills your vision and sits close to straight ahead.'
  if (comfort < 90) {
    if (weakest[0] === 'fov') {
      advice =
        hFov < 50
          ? 'The screen looks small and far away for an IMAX house, so the picture does not fill your vision.'
          : 'You are so close that the picture spills past comfortable viewing; you will keep scanning the frame.'
    } else if (weakest[0] === 'off') {
      advice = 'You are well off-centre: the picture looks skewed and the stereo image leans to one side.'
    } else {
      advice = 'You tilt your head steeply upward to see the top of the screen, which tires your neck.'
    }
  }

  return {
    distance,
    depth,
    offAxis,
    hFov,
    vFov,
    topElevation,
    edgeRatio,
    scores: { fov: fovScore, offAxis: offAxisScore, vertical: verticalScore },
    comfort,
    comfortLabel: comfortLabel(comfort),
    advice,
    zone: describeZone(seat),
  }
}

export function comfortLabel(score) {
  if (score >= 85) return 'Excellent'
  if (score >= 70) return 'Good'
  if (score >= 50) return 'Fair'
  return 'Poor'
}

function describeZone(seat) {
  const depthName = seat.rowIndex < 4 ? 'Front' : seat.rowIndex < 11 ? 'Sweet' : 'Rear'
  const side =
    Math.abs(seat.x) < 2.2 ? 'centre' : Math.abs(seat.x) < 5.6 ? (seat.x < 0 ? 'left' : 'right') : seat.x < 0 ? 'far left' : 'far right'
  return `${depthName} · ${side}`
}

// ---- Audio estimates --------------------------------------------------------

/** Inverse-distance gain, identical to the Web Audio PannerNode "inverse" model. */
export function distanceGain(d) {
  const { refDistance: ref, rolloffFactor: k } = AUDIO_MODEL
  const dd = Math.max(d, ref)
  return ref / (ref + k * (dd - ref))
}

/** Speaker directivity, identical to the Web Audio cone model. */
export function coneGain(angleDeg) {
  const { coneInner, coneOuter, coneOuterGain } = AUDIO_MODEL
  const a = Math.abs(angleDeg)
  const inner = coneInner / 2
  const outer = coneOuter / 2
  if (a <= inner) return 1
  if (a >= outer) return coneOuterGain
  return 1 + (coneOuterGain - 1) * ((a - inner) / (outer - inner))
}

export function estimateSurround(seat) {
  const L = [seat.eye.x, seat.eye.y, seat.eye.z]

  const raw = SPEAKERS.map((sp) => {
    const toListener = sub(L, sp.pos)
    const d = Math.hypot(...toListener)
    const angleOffAxis = angleBetween(sp.facing, toListener)
    const feedNorm = Math.hypot(...sp.feed.map((f) => f[1]))
    const amp = sp.trim * feedNorm * distanceGain(d) * coneGain(angleOffAxis)
    // 0 deg = straight ahead (toward the screen), +90 = right, 180 = behind.
    const azimuth = toDeg(Math.atan2(sp.pos[0] - L[0], -(sp.pos[2] - L[2])))
    return { id: sp.id, label: sp.label, group: sp.group, distance: d, azimuth, amp, delayMs: (d / AUDIO_MODEL.speedOfSound) * 1000 }
  })

  const maxAmp = Math.max(...raw.map((s) => s.amp))
  const minDelay = Math.min(...raw.map((s) => s.delayMs))
  const speakers = raw.map((s) => ({
    ...s,
    relativeDb: 20 * Math.log10(s.amp / maxAmp),
    relativeDelayMs: s.delayMs - minDelay,
  }))

  const byId = Object.fromEntries(speakers.map((s) => [s.id, s]))
  const power = (ids) => ids.reduce((sum, id) => sum + (byId[id]?.amp ?? 0) ** 2, 0)
  const idsOf = (group) => SPEAKERS.filter((s) => s.group === group).map((s) => s.id)

  const frontPower = power(idsOf('front'))
  const surroundPower = power([...idsOf('side'), ...idsOf('rear')])
  const surroundShare = surroundPower / (frontPower + surroundPower || 1)

  const db = (a, b) => Math.abs(20 * Math.log10(a / b))
  const frontBalanceDb = db(byId.FL.amp, byId.FR.amp)
  const leftSide = power(SPEAKERS.filter((s) => (s.group === 'side' || s.group === 'rear') && s.pos[0] < 0).map((s) => s.id))
  const rightSide = power(SPEAKERS.filter((s) => (s.group === 'side' || s.group === 'rear') && s.pos[0] > 0).map((s) => s.id))
  const sideBalanceDb = 10 * Math.abs(Math.log10(leftSide / rightSide))
  const shiftSide = leftSide > rightSide ? 'left' : 'right'
  const shiftDb = 10 * Math.abs(Math.log10((Math.max(leftSide, rightSide) || 1e-6) / (Math.min(leftSide, rightSide) || 1e-6)))

  const scores = {
    stage: clamp(100 - frontBalanceDb * 12, 0, 100), // is the front stage evenly balanced?
    dialogue: ramp(Math.abs(byId.C.azimuth), [[0, 100], [10, 100], [20, 80], [35, 45], [50, 15], [70, 0]]),
    envelopment: ramp(surroundShare, [[0, 0], [0.15, 40], [0.3, 85], [0.4, 100], [0.55, 90], [0.7, 50], [0.9, 10]]),
    balance: clamp(100 - sideBalanceDb * 10, 0, 100), // are left/right surrounds even?
  }
  const overall = Math.round(0.3 * scores.stage + 0.2 * scores.dialogue + 0.35 * scores.envelopment + 0.15 * scores.balance)

  let note
  if (shiftDb > 4.5) {
    note = `Corner seat: the soundstage shifts ${shiftDb.toFixed(1)} dB toward the ${shiftSide} wall. Dialogue still comes from the screen, but surrounds and the nearer front speaker pull to that side.`
  } else if (surroundShare < 0.15) {
    note = 'Close to the screen: the front stage dominates and surround effects will sound faint.'
  } else if (surroundShare > 0.65) {
    note = 'Near the surround speakers: they may compete with the screen and pull attention sideways.'
  } else if (frontBalanceDb > 3) {
    note = 'Off to one side: the nearer front speaker sounds louder, so the soundstage tilts.'
  } else {
    note = 'Front stage and surrounds are in healthy proportion for a convincing wrap-around effect.'
  }

  return {
    speakers,
    surroundShare,
    frontBalanceDb,
    sideBalanceDb,
    shiftDb,
    shiftSide,
    scores,
    overall,
    label: overall >= 85 ? 'Immersive' : overall >= 70 ? 'Good' : overall >= 50 ? 'Fair' : 'Limited',
    note,
  }
}

// ---- Heat-map data for the mini-map (computed once) --------------------------

export const SEAT_COMFORT = Object.fromEntries(SEATS.map((s) => [s.id, computeViewMetrics(s).comfort]))
