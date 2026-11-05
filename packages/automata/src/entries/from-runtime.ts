/** The content hash the boot check recomputes; tooling that changes content before a run hashes it with this. */
export { contentHashOf } from '../app/boot/boot-program.js'
export { Audio, AudioBuses, Locale, Saves, Settings, settingsStore } from '../app/boot/effect-tags.ts'
export type {
  CompiledContentData,
  GameDefinition,
  RuntimeHandle,
  RuntimeSeams,
} from '../app/boot/game-definition.js'
export { runGame } from '../app/boot/run-game.js'
export {
  CORE_SETTINGS,
  type CoreSettings,
} from '../app/core-settings.js'
export { Flow } from '../app/flow/flow.manager.js'
export type { ScreenDef } from '../app/flow/screen.js'
export {
  AUDIO_BUS_NAMES,
  audioBusGainsSchema,
} from '../features/audio/audio-buses.schema.js'
export {
  MAX_TURN_UNITS_PER_STEP,
  turnUnitsFromPixels,
} from '../features/input/analog/camera-turn.js'
export type { Input } from '../features/input/input.manager.js'
export {
  actionsForKey,
  actionsForPadButton,
  type InputProfile,
  inputProfileSchema,
} from '../features/input/input-profile.schema.js'
export { createT, type Translate } from '../features/locale/paraglide.js'
export type { Save } from '../features/saves/save.manager.js'
export {
  type AutosavePolicy,
  type AutosaveTrigger,
  defineSave,
  type SaveDef,
} from '../features/saves/save.schema.js'
export {
  ModelInvalid,
  RendererUnavailable,
} from '../shared/runtime/boot-error.js'
export type { QualityTier } from '../shared/runtime/display-settings.schema.js'
export { AppLoop } from '../shared/runtime/loop/app-loop.manager.js'
export type { FrameInfo } from '../shared/runtime/loop/frames.js'
export {
  PresentationBus,
  type RuntimeFacts,
  typedBus,
} from '../shared/runtime/presentation/presentation-bus.manager.js'
export type {
  GameRenderer,
  RendererFactory,
  RenderTarget,
} from '../shared/runtime/render/renderer.js'
export type { SettingsDef } from '../shared/runtime/settings/settings.manager.js'
export { Time } from '../shared/runtime/time/time.manager.js'
