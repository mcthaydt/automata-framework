import { defineShipConfig } from '@automata/tools'
import packageJson from './package.json' with { type: 'json' }

export default defineShipConfig({
  game: {
    id: 'the-last-light',
    title: 'The Last Light',
    version: packageJson.version,
    entry: 'index.html',
  },
  runtime: {
    renderer: 'webgl2',
    orientation: 'landscape',
    inputs: ['touch', 'keyboard', 'gamepad'],
    pause_behavior: 'pause',
  },
  network: { connect: [] },
  content: { languages: ['en'], rating: 'everyone', descriptors: [] },
  itch: { project: 'your-itch-user/the-last-light', channel: 'html5' },
})
