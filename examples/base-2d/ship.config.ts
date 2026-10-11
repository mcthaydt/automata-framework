// What ship writes into this build's ruken.toml (ship spec §3.2). Field names and values are Ruken's own.
import { defineShipConfig } from '@mcthaydt/automata-ship'
import packageJson from './package.json' with { type: 'json' }

export default defineShipConfig({
  game: {
    id: 'base-2d',
    title: 'AF Base 2D',
    // From package.json, so the manifest can never disagree with the package (FloorFifty ruken-pack.ts).
    version: packageJson.version,
    entry: 'index.html',
    // The vendored SDK's version (vendor/ruken/README.md); Ruken reads it as a caret range.
    sdk: '^0.0.0',
  },
  runtime: {
    // Pixi's `webgl` preference creates a WebGL2 context: AF's default renderer (master spec §12).
    renderer: 'webgl2',
    orientation: 'any',
    inputs: ['touch', 'keyboard'],
    pause_behavior: 'pause',
  },
  network: { connect: [] },
  content: { languages: ['en'], rating: 'everyone', descriptors: [] },
})
