// The runtime a game can reach for: the clock, loop, content, saves, settings, audio, input and the boot services.
/** The content hash the boot check recomputes; tooling that changes content before a run hashes it with this. */
export { contentHashOf } from '../app/boot/boot-program.js'
export type {
  CompiledContentData,
  GameDefinition,
  RuntimeHandle,
  RuntimeSeams,
  StartOptions,
} from '../app/boot/game-definition.js'
export { runGame } from '../app/boot/run-game.js'
export {
  CORE_SETTINGS,
  type CoreSettings,
} from '../app/core-settings.js'
export type { Flow } from '../app/flow/flow.manager.js'
export type { RuntimeServices, ScreenContext, ScreenDef } from '../app/flow/screen.js'
export type { Audio } from '../features/audio/audio.manager.js'
export type { AudioBuses } from '../features/audio/audio-buses.js'
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
export type { Locale } from '../features/locale/locale.manager.js'
export { createT, type Translate } from '../features/locale/paraglide.js'
export type { Save } from '../features/saves/save.manager.js'
export {
  type AutosavePolicy,
  type AutosaveTrigger,
  defineSave,
  type SaveDef,
} from '../features/saves/save.schema.js'
export type { Saves } from '../features/saves/saves.manager.js'
export { type Clock, systemClock, type TimeoutHandle } from '../shared/lib/clock.ts'
export { type Disposables, disposables } from '../shared/lib/disposables.ts'
export {
  ModelInvalid,
  RendererUnavailable,
} from '../shared/runtime/boot-error.js'
export type { QualityTier } from '../shared/runtime/display-settings.schema.js'
export type { AppLoop } from '../shared/runtime/loop/app-loop.manager.js'
export type { FrameInfo } from '../shared/runtime/loop/frames.js'
export {
  type PresentationBus,
  type RuntimeFacts,
  typedBus,
} from '../shared/runtime/presentation/presentation-bus.manager.js'
export type {
  GameRenderer,
  OwnedRenderer,
  RendererFactory,
  RenderTarget,
} from '../shared/runtime/render/renderer.js'
export {
  type Settings,
  type SettingsDef,
  settingsStore,
} from '../shared/runtime/settings/settings.manager.js'
export type { Time } from '../shared/runtime/time/time.manager.js'
