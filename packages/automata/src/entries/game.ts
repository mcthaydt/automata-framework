// One call to start a game (`defineGame`, `startGame`). The one file that composes the runtime, renderer, host,
// ui and sim; every default it fills in is an existing core contract with its options set.

export { defaultContent } from '../app/default-content.ts'
export {
  type DefinedGame,
  defineGame,
  type GameCopy,
  type GameSaves,
  type GameSpec,
  GameSpecError,
} from '../app/define-game.ts'
export {
  type DrawContext,
  type DrawTextBox,
  type DrawTextOptions,
  mergeStageHooks,
} from '../app/draw/draw-layer.ts'
export { defaultScreens, type ScreensGame } from '../app/screens/default-screens.ts'
export type { ChangedElsewhereCopy } from '../app/screens/saves/saves-copy.ts'
// The default screens' words: a game passes its own in `copy.screens`, over the English defaults.
export type {
  ScreensCopy,
  ScreensCopyInput,
  ScreensCopyOverrides,
  SettingsScreenCopy,
} from '../app/screens/screens-copy.ts'
export { startGame } from '../app/start-game.ts'
export { controlsFrom } from '../features/input/controls-from.ts'
export { inputs } from '../features/input/inputs.ts'
export {
  type AnalogOptions,
  type AnalogReading,
  type InputMap,
  type InputSource,
  type KeyBindings,
  type KeysOptions,
  keys,
  type TouchButton,
} from '../features/input/keys.ts'
export type { DrawEntity, DrawSim } from '../shared/draw/read-sim.ts'
export {
  type Camera2d,
  type Camera2dOptions,
  type CameraRect,
  createCamera2d,
  type LevelScene,
  type LevelSceneHooks,
  type LevelSceneOptions,
  levelScene,
  type PictureViewOptions,
  type PostFilterDef,
  type PostFilterSpec,
  pictureView,
  postFilter,
  type RectViewOptions,
  rect,
  type SpriteFrames,
  type SpriteViewOptions,
  sprite,
} from './render.ts'
// A save is declared with the runtime's `defineSave` and handed to `defineGame({ saves })`; a game imports
// only the umbrella (or this package), never the runtime, so the declaration comes through here.
export {
  type AutosavePolicy,
  type AutosaveTrigger,
  defineSave,
  type SaveDef,
} from './runtime.ts'
