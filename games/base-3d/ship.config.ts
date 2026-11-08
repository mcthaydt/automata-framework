// What ship writes into this build's ruken.toml (ship spec §3.2). Field names and values are Ruken's own.
import { defineShipConfig } from '@automata/tools'
import packageJson from './package.json' with { type: 'json' }

export default defineShipConfig({
  game: {
    id: 'base-3d',
    title: 'Ember Hall',
    // From package.json, so the manifest can never disagree with the package.
    version: packageJson.version,
    entry: 'index.html',
    // The vendored SDK's version (vendor/ruken/README.md); Ruken reads it as a caret range.
    sdk: '^0.0.0',
  },
  runtime: {
    // Pixi's `webgl` preference creates a WebGL2 context: AF's default renderer (master spec §12).
    renderer: 'webgl2',
    // M3 spec §4.7: landscape only; portrait shows M4's rotate hint.
    orientation: 'landscape',
    inputs: ['touch', 'keyboard', 'gamepad'],
    pause_behavior: 'pause',
  },
  network: { connect: [] },
  content: { languages: ['en'], rating: 'everyone', descriptors: [] },
  // The scene carries @pixi/3d, a closed beta (D-1): CI's prepare checks the build as private and writes no
  // ruken.toml; deploy-dev and publish --private ship it. Public at the AF 1.0 launch (M3 spec §4.8).
  audience: 'private',
})
