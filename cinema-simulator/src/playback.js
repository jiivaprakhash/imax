// -----------------------------------------------------------------------------
// playback.js
// Play / pause logic in one place. It handles:
//   * browser autoplay rules (audio + video may only start after a click/key)
//   * the fallback demo screen when no video file is available
// -----------------------------------------------------------------------------

import { video } from './videoSource.js'
import { audio } from './SpatialAudio.js'
import { useStore } from './store.js'

/** Start the film. Safe to call repeatedly. Call it from a click or key press. */
export async function startPlayback() {
  const store = useStore.getState()
  audio.init(video)
  audio.setVolume(store.volume, store.muted)
  await audio.resume()

  if (useStore.getState().videoStatus === 'missing') return startDemo()

  try {
    await video.play()
    useStore.getState().setPlaying(true)
    useStore.getState().setNeedsGesture(false)
  } catch (err) {
    if (err && err.name === 'NotAllowedError') {
      // The browser wants another click before it lets the video play.
      useStore.getState().setNeedsGesture(true)
      useStore.getState().setPlaying(false)
    } else {
      // File missing or unsupported: fall back to the demo.
      useStore.getState().setVideoStatus('missing')
      startDemo()
    }
  }
}

function startDemo() {
  audio.setDemoActive(true)
  useStore.getState().setPlaying(true)
  useStore.getState().setNeedsGesture(false)
}

export function pausePlayback() {
  video.pause()
  audio.setDemoActive(false)
  useStore.getState().setPlaying(false)
}

export function togglePlayback() {
  if (useStore.getState().playing) pausePlayback()
  else startPlayback()
}

// If the video file turns out to be missing AFTER the user already pressed play,
// switch over to the demo soundtrack seamlessly.
video.addEventListener('error', () => {
  if (useStore.getState().playing && audio.ready) audio.setDemoActive(true)
})
