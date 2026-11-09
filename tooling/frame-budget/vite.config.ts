import { previewHeaders } from '@automata/examples-runner/host/preview-headers'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import config from './ship.config.ts'

// The production build the frame-budget probe measures: `vite build`, then `vite preview` with Ruken's headers.
export default defineConfig({
  base: './',
  plugins: [svelte()],
  resolve: { conditions: ['browser'] },
  // Two pages: the core stress scene and the 3D one, which the 3D projects load from `stress/3d/`.
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: { input: { main: 'index.html', stress3d: 'stress/3d/index.html' } },
  },
  preview: { headers: previewHeaders(config) },
})
