// -----------------------------------------------------------------------------
// store.js
// Global app state (zustand). The 3D scene lives inside <Canvas>, which can't
// share React context with the page, so both the 3D code and the HTML UI read
// and write this one store.
// -----------------------------------------------------------------------------

import { create } from 'zustand'

// Graphics presets. Individual toggles in the settings panel override these.
export const QUALITY_PRESETS = {
  low: { shadows: false, bloom: false, particles: false },
  medium: { shadows: true, bloom: false, particles: false },
  high: { shadows: true, bloom: true, particles: true },
}

export const useStore = create((set, get) => ({
  // --- session ---
  entered: false, // has the user pressed "Enter cinema"?
  locked: false, // is the mouse captured (pointer lock)?
  sceneReady: false, // physics engine loaded and player mounted

  // --- seats ---
  seatedId: null, // e.g. "E8" when sitting
  nearSeatId: null, // seat you are standing next to
  pinned: [], // seat ids saved for comparison
  playerPose: { x: 0, z: 7, yaw: 0 }, // for the mini-map

  // --- playback ---
  playing: false,
  muted: false,
  volume: 0.8,
  videoStatus: 'loading', // 'loading' | 'ready' | 'missing'
  needsGesture: false, // browser blocked autoplay

  // --- UI ---
  panelOpen: true,
  settingsOpen: false,

  settings: {
    quality: 'high',
    ...QUALITY_PRESETS.high,
    fov: 70,
    spatial: true, // spatial surround vs plain stereo
    hrtf: true, // headphone-style 3D panning
    surroundLevel: 1,
    bassLevel: 1,
  },

  // --- actions ---
  setEntered: (entered) => set({ entered }),
  setLocked: (locked) => set({ locked }),
  setSceneReady: (sceneReady) => set({ sceneReady }),
  sit: (id) => set({ seatedId: id, panelOpen: true }),
  stand: () => set({ seatedId: null }),
  setNearSeat: (id) => set((s) => (s.nearSeatId === id ? s : { nearSeatId: id })),
  setPlayerPose: (playerPose) => set({ playerPose }),
  togglePin: (id) =>
    set((s) => ({ pinned: s.pinned.includes(id) ? s.pinned.filter((p) => p !== id) : [...s.pinned.slice(-2), id] })),
  clearPins: () => set({ pinned: [] }),

  setPlaying: (playing) => set({ playing }),
  setVolume: (volume) => set({ volume, muted: volume === 0 ? true : false }),
  toggleMute: () => set((s) => ({ muted: !s.muted })),
  setVideoStatus: (videoStatus) => set({ videoStatus }),
  setNeedsGesture: (needsGesture) => set({ needsGesture }),

  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
  toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),
  updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
  applyQuality: (quality) =>
    set((s) => ({ settings: { ...s.settings, quality, ...QUALITY_PRESETS[quality] } })),
}))
