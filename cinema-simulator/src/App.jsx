// -----------------------------------------------------------------------------
// App.jsx
// Puts the 3D canvas and the HTML interface together and wires up the
// keyboard shortcuts and audio settings.
// -----------------------------------------------------------------------------

import { Suspense, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'

import Cinema from './components/Cinema.jsx'
import Player from './components/Player.jsx'
import WelcomeScreen from './ui/WelcomeScreen.jsx'
import HUD from './ui/HUD.jsx'
import ExperiencePanel from './ui/ExperiencePanel.jsx'
import SettingsPanel from './ui/SettingsPanel.jsx'

import { useStore } from './store.js'
import { audio } from './SpatialAudio.js'
import { togglePlayback } from './playback.js'

export default function App() {
  const quality = useStore((s) => s.settings.quality)
  const shadows = useStore((s) => s.settings.shadows)
  const bloom = useStore((s) => s.settings.bloom)

  useHotkeys()
  useAudioSettings()

  const dpr = quality === 'low' ? 1 : quality === 'medium' ? [1, 1.5] : [1, 2]

  return (
    <>
      <Canvas
        shadows={shadows}
        dpr={dpr}
        camera={{ fov: 70, near: 0.1, far: 80, position: [0, 3.7, 7.6] }}
        gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.NoToneMapping }}
      >
        <Suspense fallback={null}>
          {/* timeStep="vary" keeps movement smooth on any monitor refresh rate */}
          <Physics gravity={[0, -9.81, 0]} timeStep="vary">
            <Cinema />
            <Player />
          </Physics>
        </Suspense>
        {bloom && (
          <EffectComposer multisampling={4}>
            <Bloom intensity={0.45} luminanceThreshold={0.8} luminanceSmoothing={0.25} mipmapBlur />
            <Vignette offset={0.25} darkness={0.75} eskil={false} />
          </EffectComposer>
        )}
      </Canvas>

      <WelcomeScreen />
      <HUD />
      <ExperiencePanel />
      <SettingsPanel />
    </>
  )
}

// E = sit / stand   P = play / pause   M = mute   I = seat info panel
function useHotkeys() {
  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat) return
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      const s = useStore.getState()
      if (!s.entered) return
      switch (e.code) {
        case 'KeyE':
          if (s.seatedId) s.stand()
          else if (s.nearSeatId) s.sit(s.nearSeatId)
          break
        case 'KeyP':
          togglePlayback()
          break
        case 'KeyM':
          s.toggleMute()
          break
        case 'KeyI':
          s.togglePanel()
          break
        default:
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

// Keeps the Web Audio engine in step with the volume and settings in the store.
function useAudioSettings() {
  const volume = useStore((s) => s.volume)
  const muted = useStore((s) => s.muted)
  const { spatial, hrtf, surroundLevel, bassLevel } = useStore((s) => s.settings)

  useEffect(() => audio.setVolume(volume, muted), [volume, muted])
  useEffect(() => audio.setSpatial(spatial), [spatial])
  useEffect(() => audio.setHrtf(hrtf), [hrtf])
  useEffect(() => audio.setSurroundLevel(surroundLevel), [surroundLevel])
  useEffect(() => audio.setBassLevel(bassLevel), [bassLevel])
}
