// @mcthaydt/automata-game: one call to start a game (DX spec §3.1). The only package that composes runtime,
// render-pixi, host, ui and sim; every default it fills in is an existing core contract with its options set.
export {
  type Camera2d,
  type Camera2dOptions,
  type CameraRect,
  createCamera2d,
  type PostFilterDef,
  type PostFilterSpec,
  postFilter,
  type RectViewOptions,
  rect,
  type SpriteFrames,
  type SpriteViewOptions,
  sprite,
} from '@mcthaydt/automata-render-pixi'
// A save is declared with the runtime's `defineSave` and handed to `defineGame({ saves })` (M5.2); a game imports
// only the umbrella (or this package), never the runtime, so the declaration comes through here.
export {
  type AutosavePolicy,
  type AutosaveTrigger,
  defineSave,
  type SaveDef,
} from '@mcthaydt/automata-runtime'
export { defaultContent } from './default-content.ts'
export {
  type DefinedGame,
  defineGame,
  type GameCopy,
  type GameSaves,
  type GameSpec,
  GameSpecError,
} from './define-game.ts'
export type { DrawContext, DrawTextOptions } from './draw/draw-layer.ts'
export type { DrawEntity, DrawSim } from './draw/read-sim.ts'
export { inputs } from './input/inputs.ts'
export {
  type InputMap,
  type InputSource,
  type KeyBindings,
  type KeysOptions,
  keys,
  type TouchButton,
} from './input/keys.ts'
export { defaultScreens, type ScreensGame } from './screens/default-screens.ts'
// The default screens' words (DX.2d): a game passes its own in `copy.screens`, over the English defaults.
export type {
  ScreensCopy,
  ScreensCopyInput,
  ScreensCopyOverrides,
  SettingsScreenCopy,
} from './screens/screens-copy.ts'
export { startGame } from './start-game.ts'
