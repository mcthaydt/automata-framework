import { defineConfig } from 'vite'

// Builds and previews the e2e host page (tests/e2e/ruken/host.ts). The game's origin comes from VITE_GAME_ORIGIN.
export default defineConfig({
  root: import.meta.dirname,
  base: './',
  build: { outDir: '../../dist-e2e-host', emptyOutDir: true },
})
