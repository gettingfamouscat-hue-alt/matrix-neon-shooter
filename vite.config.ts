import { defineConfig } from 'vite'

export default defineConfig({
  // Relative paths so Electron can load dist/index.html via file://
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    chunkSizeWarningLimit: 800,
  },
})
