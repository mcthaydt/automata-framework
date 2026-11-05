import { describe, expect, it } from 'vitest'
import {
  createCamera2d,
  defaultContent,
  defaultScreens,
  defineGame,
  defineSave,
  keys,
  postFilter,
  rect,
  sprite,
  startGame,
} from '#src/entries/from-game.ts'

// What a game imports from `@mcthaydt/automata-game` (DX spec §3.1, §3.3): one call to start a game, its pure half,
// the input map, the entity views, the camera and the screen-space filter verb (re-exported from render-pixi, DX.2b,
// M4.8 and EX.4), a save's declaration (re-exported from the runtime, M5.2), and the defaults it fills in.
describe('@mcthaydt/automata-game', () => {
  it.each(
    Object.entries({
      defineGame,
      defineSave,
      startGame,
      keys,
      postFilter,
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
