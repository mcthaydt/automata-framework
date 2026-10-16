// @mcthaydt/automata-game: one call to start a game (DX spec §3.1). The only package that composes runtime,
// render-pixi, host, ui and sim; every default it fills in is an existing core contract with its options set.
export {
  type RectViewOptions,
  rect,
  type SpriteFrames,
  type SpriteViewOptions,
  sprite,
} from '@mcthaydt/automata-render-pixi'
export { defaultContent } from './default-content.ts'
export { defineGame } from './define-game.ts'
export { keys } from './input/keys.ts'
export { defaultScreens } from './screens/default-screens.ts'
export { startGame } from './start-game.ts'
