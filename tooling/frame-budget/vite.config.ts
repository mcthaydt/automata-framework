import { previewHeaders } from '@mcthaydt/examples-runner/host/preview-headers'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import config from './ship.config.ts'

// The production build the frame-budget probe measures: `vite build`, then `vite preview` with Ruken's headers.
export default defineConfig({
  base: './',
  plugins: [svelte()],
  resolve: { conditions: ['browser'] },
  build: { outDir: 'dist', emptyOutDir: true },
  preview: { headers: previewHeaders(config) },
})
