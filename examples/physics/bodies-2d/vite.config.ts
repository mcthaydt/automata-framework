import { previewHeaders } from '@mcthaydt/examples-runner/host/preview-headers'
import { defineConfig } from 'vite'
import config from './ship.config.ts'

// Relative URLs, as Ruken serves a build from /b/<buildId>/; previewed with Ruken's headers (no eval).
export default defineConfig({
  base: './',
  build: { outDir: 'dist', emptyOutDir: true },
  preview: { headers: previewHeaders(config) },
})
