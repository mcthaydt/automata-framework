import { defineShipConfig } from '@mcthaydt/automata-ship'
import packageJson from './package.json' with { type: 'json' }

export default defineShipConfig({
  game: {
    id: 'demo-renderer-2d',
    title: 'AF demo: 2D PixiJS Renderer',
    version: packageJson.version,
    entry: 'index.html',
    sdk: '^0.0.0',
  },
  runtime: {
    renderer: 'webgl2',
    orientation: 'any',
    inputs: ['touch', 'keyboard'],
    pause_behavior: 'pause',
  },
  network: { connect: [] },
  content: { languages: ['en'], rating: 'everyone', descriptors: [] },
})
