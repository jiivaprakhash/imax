// Everything drawn on top of the 3D view while you explore: seat prompt,
// crosshair, playback controls and small hints.
import { useStore } from '../store.js'
import { SEATS_BY_ID } from '../cinemaLayout.js'
import { bridge } from '../bridge.js'
import { startPlayback, togglePlayback } from '../playback.js'
import { PlayIcon, PauseIcon, VolumeIcon, MuteIcon, SeatIcon, GearIcon } from './icons.jsx'

export default function HUD() {
  const entered = useStore((s) => s.entered)
  const locked = useStore((s) => s.locked)
  const seatedId = useStore((s) => s.seatedId)
  const nearSeatId = useStore((s) => s.nearSeatId)
  const playing = useStore((s) => s.playing)
  const muted = useStore((s) => s.muted)
  const volume = useStore((s) => s.volume)
  const needsGesture = useStore((s) => s.needsGesture)
  const videoStatus = useStore((s) => s.videoStatus)
  const panelOpen = useStore((s) => s.panelOpen)
  const settingsOpen = useStore((s) => s.settingsOpen)
  const { stand, sit, setVolume, toggleMute, togglePanel, toggleSettings } = useStore.getState()

  if (!entered) return null

  const seat = seatedId ? SEATS_BY_ID[seatedId] : null
  const near = nearSeatId ? SEATS_BY_ID[nearSeatId] : null

  return (
    <>
      {locked && !seat && <div className="crosshair" />}

      <div className="chip">
        {seat ? `Row ${seat.row} · Seat ${seat.number}` : 'Walking'}
      </div>

      {/* Contextual prompt */}
      {seat && (
        <div className="prompt">
          <kbd>E</kbd> Stand up
          <button className="prompt__btn" onClick={stand}>Stand up</button>
        </div>
      )}
      {!seat && near && (
        <div className="prompt">
          <kbd>E</kbd> Sit in Row {near.row}, Seat {near.number}
          <button className="prompt__btn" onClick={() => sit(near.id)}>Sit here</button>
        </div>
      )}

      {needsGesture && (
        <button className="center-btn" onClick={startPlayback}>Your browser paused the film. Click to start.</button>
      )}

      {!locked && !needsGesture && (
        <button className="center-btn" onClick={() => bridge.lock()}>
          Paused. Click to return to the cinema.
          <span>Esc frees the mouse. Click the view or this button to look around again.</span>
        </button>
      )}

      {videoStatus === 'missing' && (
        <div className="banner">Demo mode: add your film at <code>public/videos/cinema-loop.mp4</code></div>
      )}

      {!seat && locked && (
        <div className="hints">W A S D walk · Shift run · E sit · P pause · M mute · I seat details · Esc mouse</div>
      )}

      {/* Playback bar */}
      <div className="transport" role="toolbar" aria-label="Playback and settings">
        <button onClick={togglePlayback} aria-label={playing ? 'Pause film' : 'Play film'} title="Play / pause (P)">
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'} title="Mute (M)">
          {muted ? <MuteIcon /> : <VolumeIcon />}
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={muted ? 0 : volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          aria-label="Volume"
        />
        <span className="transport__sep" />
        <button className={panelOpen ? 'on' : ''} onClick={togglePanel} aria-label="Seat details" title="Seat details (I)">
          <SeatIcon />
        </button>
        <button className={settingsOpen ? 'on' : ''} onClick={toggleSettings} aria-label="Settings" title="Settings">
          <GearIcon />
        </button>
      </div>
    </>
  )
}
