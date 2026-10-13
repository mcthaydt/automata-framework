import { previewHeaders } from '@af-examples/demo-host/preview-headers'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import config from './ship.config.ts'

export default defineConfig({
  base: './',
  plugins: [svelte()],
  resolve: { conditions: ['browser'] },
  build: { outDir: 'dist', emptyOutDir: true },
  preview: { headers: previewHeaders(config) },
})
