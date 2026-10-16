import { previewHeaders } from '@mcthaydt/examples-runner/host/preview-headers'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import { effectSharePlugin } from './budget/effect-share.ts'
import config from './ship.config.ts'

export default defineConfig({
  base: './',
  plugins: [svelte(), effectSharePlugin()],
  resolve: { conditions: ['browser'] },
  build: { outDir: 'dist', emptyOutDir: true },
  preview: { headers: previewHeaders(config) },
})
