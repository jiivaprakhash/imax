import { useStore } from '../store.js'
import { CloseIcon } from './icons.jsx'

export default function SettingsPanel() {
  const open = useStore((s) => s.settingsOpen)
  const entered = useStore((s) => s.entered)
  const settings = useStore((s) => s.settings)
  const { applyQuality, updateSettings, toggleSettings } = useStore.getState()

  if (!open || !entered) return null

  const toggle = (key, label, hint) => (
    <label className="row">
      <span>{label}{hint && <small>{hint}</small>}</span>
      <input type="checkbox" checked={settings[key]} onChange={(e) => updateSettings({ [key]: e.target.checked })} />
    </label>
  )

  const slider = (key, label, min, max, step, format) => (
    <label className="row row--slider">
      <span>{label}<b>{format(settings[key])}</b></span>
      <input type="range" min={min} max={max} step={step} value={settings[key]} onChange={(e) => updateSettings({ [key]: parseFloat(e.target.value) })} />
    </label>
  )

  return (
    <aside className="settings" aria-label="Settings">
      <header>
        <h2>Settings</h2>
        <button onClick={toggleSettings} aria-label="Close settings"><CloseIcon /></button>
      </header>

      <h3>Graphics</h3>
      <div className="seg" role="group" aria-label="Graphics quality">
        {['low', 'medium', 'high'].map((q) => (
          <button key={q} className={settings.quality === q ? 'on' : ''} onClick={() => applyQuality(q)}>
            {q[0].toUpperCase() + q.slice(1)}
          </button>
        ))}
      </div>
      {toggle('shadows', 'Seat shadows')}
      {toggle('bloom', 'Glow and vignette')}
      {toggle('particles', 'Dust in the projector beam')}
      {slider('fov', 'Field of view', 55, 95, 1, (v) => `${v}°`)}

      <h3>Audio</h3>
      {toggle('spatial', 'Spatial surround', 'Off plays the soundtrack as plain stereo')}
      {toggle('hrtf', 'Headphone-style 3D panning', 'Best with headphones')}
      {slider('surroundLevel', 'Surround speakers', 0, 2, 0.05, (v) => `${Math.round(v * 100)}%`)}
      {slider('bassLevel', 'Subwoofer', 0, 2, 0.05, (v) => `${Math.round(v * 100)}%`)}
    </aside>
  )
}
