import { defineShipConfig } from '@mcthaydt/automata-ship'
import { EXAMPLES_GAME_ID } from './page-template.ts'

/**
 * The manifest every example is served under: examples have no `ruken.toml` of their own (EX spec §5), so they all
 * share Ruken's headers for one 2D game, framable by the fake host. The playground's frame policy starts from it too.
 */
export const EXAMPLES_SHIP_CONFIG = defineShipConfig({
  game: { id: EXAMPLES_GAME_ID, title: 'AF examples', version: '0.0.0', entry: 'index.html', sdk: '^0.0.0' },
  runtime: { renderer: 'webgl2', orientation: 'any', inputs: ['touch', 'keyboard'], pause_behavior: 'pause' },
  network: { connect: [] },
  content: { languages: ['en'], rating: 'everyone', descriptors: [] },
})
