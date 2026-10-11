import { previewHeaders } from '@af-examples/demo-host/preview-headers'
import { automataContent } from '@mcthaydt/automata-content/vite'
import { defineConfig } from 'vite'
import { roomSchema } from './room.schema.ts'
import config from './ship.config.ts'

// automata-content compiles content/ when Vite starts and again on every save in dev, and serves the result as
// `virtual:automata/content`. The browser check points it at a copy of content/ (AF_DEMO_CONTENT_ROOT) so it
// can edit the room without touching this folder.
export default defineConfig({
  base: './',
  build: { outDir: 'dist', emptyOutDir: true },
  plugins: [automataContent({ root: process.env.AF_DEMO_CONTENT_ROOT, schemas: [roomSchema] })],
  preview: { headers: previewHeaders(config) },
})
