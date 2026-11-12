// What ship writes into this build's ruken.toml. Field names and values are Ruken's own.
import { defineShipConfig } from '@automataframework/tools'
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
  // The six languages the game ships (messages/ui and content/messages), the framework's defaults. Written out, not read
  // from `@automataframework/content/locale`: the `automata` command loads this file in plain Node, which cannot load that entry.
  content: {
    languages: ['en', 'ja', 'ko', 'es-419', 'pt-BR', 'zh-Hans'],
    rating: 'everyone',
    descriptors: [],
  },
  // The fastest climb, in milliseconds (the end screen submits the round's time). Ruken checks a score against these.
  leaderboards: { fastest: { order: 'asc', min: 1000, max: 3_600_000, title: 'Fastest climb' } },
  // Reaching the ember in under a minute. A goal is a rule on a board's score; each host awards what it can (Ruken
  // from its manifest), and one with no achievements ignores the declaration.
  achievements: {
    'ember-in-a-minute': {
      title: 'Ember in a minute',
      description: 'Reach the ember in under 60 seconds.',
      board: 'fastest',
      goal: { reach: 60_000 },
    },
  },
})
