import { defineConfig } from 'vite'

// Builds and previews the demo host page (ruken/host.ts) for the feature demos' smoke tests.
export default defineConfig({
  root: import.meta.dirname,
  base: './',
  build: { outDir: 'dist', emptyOutDir: true },
})
