// What ship writes into this build's ruken.toml. Field names and values are Ruken's own.
import { defineShipConfig } from '@automata/tools'
import packageJson from './package.json' with { type: 'json' }

export default defineShipConfig({
  game: {
    id: 'emberwick',
    title: 'Emberwick',
    // From package.json, so the manifest can never disagree with the package (FloorFifty ruken-pack.ts).
    version: packageJson.version,
    entry: 'index.html',
    // The vendored SDK's version (vendor/ruken/README.md); Ruken reads it as a caret range.
    sdk: '^0.0.0',
  },
  runtime: {
    // Pixi's `webgl` preference creates a WebGL2 context: AF's default renderer.
    renderer: 'webgl2',
    orientation: 'any',
    inputs: ['touch', 'keyboard'],
    pause_behavior: 'pause',
  },
  network: { connect: [] },
  content: { languages: ['en'], rating: 'everyone', descriptors: [] },
})
