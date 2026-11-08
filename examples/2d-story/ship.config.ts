import { defineShipConfig } from '@automata/tools'
import packageJson from './package.json' with { type: 'json' }

export default defineShipConfig({
  game: {
    id: 'story',
    title: '2D Story',
    version: packageJson.version,
    entry: 'index.html',
  },
  runtime: {
    renderer: 'webgl2',
    orientation: 'any',
    inputs: ['touch', 'keyboard', 'gamepad'],
    pause_behavior: 'pause',
  },
  network: { connect: [] },
  content: { languages: ['en'], rating: 'everyone', descriptors: [] },
  itch: { project: 'your-itch-user/story', channel: 'html5' },
})
