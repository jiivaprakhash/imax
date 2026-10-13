import { useStore } from '../store.js'
import { bridge } from '../bridge.js'
import { startPlayback } from '../playback.js'

export default function WelcomeScreen() {
  const entered = useStore((s) => s.entered)
  const ready = useStore((s) => s.sceneReady)
  const videoStatus = useStore((s) => s.videoStatus)

  if (entered) return null

  const enter = () => {
    // Both of these must happen inside the click: the browser only allows
    // mouse capture and sound after a user gesture.
    bridge.lock()
    useStore.getState().setEntered(true)
    startPlayback()
  }

  return (
    <main className="welcome">
      <div className="welcome__body">
        <h1 className="welcome__title">Sit anywhere. See and hear what that seat gets.</h1>
        <p className="welcome__lede">
          Walk around a full auditorium, take any of its 144 seats, and compare the picture and the surround sound
          from the front row, the middle, the back and the corners.
        </p>

        <button className="ticket" onClick={enter} disabled={!ready}>
          {ready ? 'Enter cinema' : 'Loading the auditorium…'}
        </button>
        <p className="welcome__note">
          Turn your sound on. Headphones give the best surround effect. Works best on a desktop browser with a keyboard and mouse.
        </p>

        <dl className="keys">
          <div><dt><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></dt><dd>Walk</dd></div>
          <div><dt><kbd>Mouse</kbd></dt><dd>Look around</dd></div>
          <div><dt><kbd>Shift</kbd></dt><dd>Walk faster</dd></div>
          <div><dt><kbd>E</kbd></dt><dd>Sit down or stand up</dd></div>
          <div><dt><kbd>P</kbd> <kbd>M</kbd></dt><dd>Pause, mute</dd></div>
          <div><dt><kbd>I</kbd></dt><dd>Show or hide seat details</dd></div>
          <div><dt><kbd>Esc</kbd></dt><dd>Free the mouse to use buttons</dd></div>
        </dl>

        {videoStatus === 'missing' && (
          <p className="welcome__warn">
            No film found at <code>public/videos/cinema-loop.mp4</code>, so a demo screen and test soundtrack will play instead.
          </p>
        )}
      </div>
    </main>
  )
}
