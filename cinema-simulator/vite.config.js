import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Standard Vite + React setup. Nothing special is needed for Rapier
// (the physics engine ships its WASM inlined).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    // Large .mp4 files on Windows often trigger EBUSY if Vite watches them.
    watch: { ignored: ['**/public/videos/**'] },
  },
})
