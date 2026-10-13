// The seat-by-seat "experience" panel: view geometry, comfort, speaker levels,
// and a small comparison table for saved seats.
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store.js'
import { SEATS_BY_ID, SEAT_LAYOUT, rowLabel } from '../cinemaLayout.js'
import { computeViewMetrics, estimateSurround } from '../seatCalculations.js'
import { audio } from '../SpatialAudio.js'
import MiniMap from './MiniMap.jsx'
import { CloseIcon } from './icons.jsx'

const QUICK_SEATS = [
  { label: 'Front row, centre', id: 'A8' },
  { label: 'Middle, centre', id: 'E8' },
  { label: 'Back row, centre', id: 'I8' },
  { label: 'Front corner', id: 'A1' },
  { label: 'Back corner', id: 'I16' },
]

function useSpeakerActivity(active) {
  const playing = useStore((s) => s.playing)
  const [levels, setLevels] = useState(null)
  useEffect(() => {
    if (!active || !playing) {
      setLevels(null)
      return undefined
    }
    const id = setInterval(() => {
      if (audio.ready) setLevels(audio.getActivity())
    }, 120)
    return () => clearInterval(id)
  }, [active, playing])
  return levels
}

const describeAzimuth = (az) => {
  const side = Math.abs(az) < 4 ? 'ahead' : az < 0 ? 'left' : 'right'
  if (Math.abs(az) > 100) return `behind, ${side}`
  if (side === 'ahead') return 'straight ahead'
  return `${Math.abs(az).toFixed(0)}° ${side}`
}

export default function ExperiencePanel() {
  const entered = useStore((s) => s.entered)
  const open = useStore((s) => s.panelOpen)
  const seatedId = useStore((s) => s.seatedId)
  const pinned = useStore((s) => s.pinned)
  const { stand, sit, togglePin, clearPins, togglePanel } = useStore.getState()

  const seat = seatedId ? SEATS_BY_ID[seatedId] : null
  const view = useMemo(() => (seat ? computeViewMetrics(seat) : null), [seat])
  const sound = useMemo(() => (seat ? estimateSurround(seat) : null), [seat])
  const live = useSpeakerActivity(!!seat)

  if (!entered || !open) return null

  return (
    <aside className="panel" aria-label="Seat experience">
      <header className="panel__head">
        <div>
          <h2>{seat ? `Row ${seat.row} · Seat ${seat.number}` : 'Choose a seat'}</h2>
          <p>{seat ? view.zone : 'Walk up to a seat and press E, or jump to one below.'}</p>
        </div>
        <button className="icon-btn" onClick={togglePanel} aria-label="Hide seat details"><CloseIcon /></button>
      </header>

      {seat && (
        <div className="panel__actions">
          <button onClick={stand}>Stand up</button>
          <button className={pinned.includes(seat.id) ? 'on' : ''} onClick={() => togglePin(seat.id)}>
            {pinned.includes(seat.id) ? 'Saved to compare' : 'Save to compare'}
          </button>
        </div>
      )}

      <MiniMap speakerLevels={sound ? Object.fromEntries(sound.speakers.map((s) => [s.id, Math.max(0, 1 + s.relativeDb / 14)])) : null} />

      <section>
        <h3>Jump to a seat</h3>
        <div className="chips">
          {QUICK_SEATS.map((q) => (
            <button key={q.id} className={seatedId === q.id ? 'on' : ''} onClick={() => sit(q.id)}>{q.label}</button>
          ))}
        </div>
        <SeatFinder onGo={sit} current={seat} />
      </section>

      {seat && view && (
        <>
          <section>
            <h3>Picture</h3>
            <dl className="stats">
              <div><dt>Distance to screen</dt><dd>{view.distance.toFixed(1)} m</dd></div>
              <div>
                <dt>Angle to screen centre</dt>
                <dd>{Math.abs(view.offAxis).toFixed(1)}°<small>{Math.abs(view.offAxis) < 1.5 ? 'on the centre line' : view.offAxis > 0 ? 'you are left of centre' : 'you are right of centre'}</small></dd>
              </div>
              <div><dt>Screen fills</dt><dd>{view.hFov.toFixed(0)}° wide<small>{view.vFov.toFixed(0)}° tall</small></dd></div>
              <div><dt>Head tilt up</dt><dd>{view.topElevation.toFixed(0)}°<small>to the top edge</small></dd></div>
            </dl>
            <Meter value={view.comfort} label={`${view.comfortLabel} · ${view.comfort}/100`} />
            <p className="note">{view.advice}</p>
          </section>

          <section>
            <h3>Sound</h3>
            <Meter value={sound.overall} label={`${sound.label} surround · ${sound.overall}/100`} />
            <p className="note">{sound.note}</p>
            <ul className="speakers">
              {sound.speakers.map((sp) => (
                <li key={sp.id}>
                  <span className={`dot ${live && live[sp.id] > 0.05 ? 'is-live' : ''}`} style={live ? { opacity: 0.3 + Math.min(1, live[sp.id]) * 0.7 } : undefined} />
                  <span className="speakers__name">{sp.label}<small>{describeAzimuth(sp.azimuth)}</small></span>
                  <span className="bar"><i style={{ width: `${Math.max(6, 100 + sp.relativeDb * 5.5)}%` }} /></span>
                  <span className="speakers__db">{sp.relativeDb > -0.05 ? '0 dB' : `${sp.relativeDb.toFixed(1)} dB`}</span>
                </li>
              ))}
            </ul>
            <p className="fine">
              Levels are relative to the loudest speaker at this seat. Delay to the farthest speaker is {Math.max(...sound.speakers.map((s) => s.relativeDelayMs)).toFixed(0)} ms later than the nearest.
              These are estimates from distance, speaker direction and a simple open-air model. They ignore room echoes, absorption and real speaker response, so they are not acoustic measurements unless calibrated with real ones.
            </p>
          </section>
        </>
      )}

      {pinned.length > 0 && (
        <section>
          <h3>Compare saved seats</h3>
          <table className="compare">
            <thead>
              <tr><th>Seat</th><th>Distance</th><th>Fills</th><th>View</th><th>Sound</th></tr>
            </thead>
            <tbody>
              {pinned.map((id) => {
                const s = SEATS_BY_ID[id]
                const v = computeViewMetrics(s)
                const a = estimateSurround(s)
                return (
                  <tr key={id} className={id === seatedId ? 'is-current' : ''} onClick={() => sit(id)}>
                    <td>{id}</td>
                    <td>{v.distance.toFixed(1)} m</td>
                    <td>{v.hFov.toFixed(0)}°</td>
                    <td>{v.comfort}</td>
                    <td>{a.overall}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <button className="link" onClick={clearPins}>Clear saved seats</button>
        </section>
      )}
    </aside>
  )
}

function Meter({ value, label }) {
  const color = value >= 85 ? 'var(--good)' : value >= 70 ? '#b9d36a' : value >= 50 ? 'var(--warn)' : 'var(--bad)'
  return (
    <div className="meter" role="img" aria-label={label}>
      <div className="meter__track"><i style={{ width: `${value}%`, background: color }} /></div>
      <span>{label}</span>
    </div>
  )
}

function SeatFinder({ onGo, current }) {
  const [row, setRow] = useState(current ? current.rowIndex : 4)
  const [num, setNum] = useState(current ? current.number : 8)
  const go = () => onGo(`${rowLabel(row)}${num}`)
  return (
    <div className="finder">
      <label>Row
        <select value={row} onChange={(e) => setRow(Number(e.target.value))}>
          {Array.from({ length: SEAT_LAYOUT.rows }, (_, r) => <option key={r} value={r}>{rowLabel(r)}</option>)}
        </select>
      </label>
      <label>Seat
        <select value={num} onChange={(e) => setNum(Number(e.target.value))}>
          {Array.from({ length: SEAT_LAYOUT.perRow }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
        </select>
      </label>
      <button onClick={go}>Sit there</button>
    </div>
  )
}
