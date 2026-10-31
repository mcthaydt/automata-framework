import { automataContent } from '@mcthaydt/automata-content/vite'
import { previewHeaders } from '@mcthaydt/examples-runner/host/preview-headers'
import { defaultClientConditions, defineConfig } from 'vite'
import { roomSchema } from './room.schema.ts'
import config from './ship.config.ts'

// automata-content compiles content/ when Vite starts and again on every save in dev, and serves the result as
// `virtual:automata/content`. The browser check points it at a copy of content/ (AF_DEMO_CONTENT_ROOT) so it
// can edit the room without touching this folder.
export default defineConfig({
  base: './',
  // A Ruken build, as before DIST.2: the Ruken host adapter (DIST spec §5.3), in front of Vite's defaults.
  resolve: { conditions: ['automata-ruken', ...defaultClientConditions] },
  build: { outDir: 'dist', emptyOutDir: true },
  plugins: [automataContent({ root: process.env.AF_DEMO_CONTENT_ROOT, schemas: [roomSchema] })],
  preview: { headers: previewHeaders(config) },
})
