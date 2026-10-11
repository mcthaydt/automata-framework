// What ship writes into this demo's ruken.toml (ship spec §3.2): the base's settings under the demo's own id.
import { defineShipConfig } from '@mcthaydt/automata-ship'
import packageJson from './package.json' with { type: 'json' }

export default defineShipConfig({
  game: {
    id: 'demo-host-lifecycle-and-saves',
    title: 'AF demo: host lifecycle and saves',
    version: packageJson.version,
    entry: 'index.html',
    sdk: '^0.0.0',
  },
  runtime: { renderer: 'webgl2', orientation: 'any', inputs: ['touch', 'keyboard'], pause_behavior: 'pause' },
  network: { connect: [] },
  content: { languages: ['en'], rating: 'everyone', descriptors: [] },
})
