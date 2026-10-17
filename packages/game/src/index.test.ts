import { describe, expect, it } from 'vitest'
import {
  createCamera2d,
  defaultContent,
  defaultScreens,
  defineGame,
  keys,
  rect,
  sprite,
  startGame,
} from './index.ts'

// What a game imports from `@mcthaydt/automata-game` (DX spec §3.1, §3.3): one call to start a game, its pure half,
// the input map, the entity views and the camera (re-exported from render-pixi, DX.2b and M4.8), and the defaults it
// fills in.
describe('@mcthaydt/automata-game', () => {
  it.each(
    Object.entries({
      defineGame,
      startGame,
      keys,
      rect,
      sprite,
      createCamera2d,
      defaultContent,
      defaultScreens,
    }),
  )('exports %s', (_name, value) => {
    expect(typeof value).toBe('function')
  })
})
