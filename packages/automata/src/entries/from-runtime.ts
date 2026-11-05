/** The content hash the boot check recomputes; tooling that changes content before a run hashes it with this. */
export { contentHashOf } from '../app/boot/boot-program.js'
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
  type HapticsSettings,
  hapticsSettingsSchema,
} from '../app/core-settings.js'
export { Flow } from '../app/flow/flow.manager.js'
export type {
  FlowFailure,
  RuntimeServices,
  ScreenContext,
  ScreenDef,
} from '../app/flow/screen.js'
export {
  Audio,
  AudioLive,
  type AudioOptions,
  type AudioServices,
  audioLayer,
  makeAudio,
  type SoundOptions,
} from '../features/audio/audio.manager.js'
export { AudioBuses } from '../features/audio/audio-buses.js'
export {
  AUDIO_BUS_NAMES,
  type AudioBusGains,
  type AudioBusName,
  audioBusGainsSchema,
} from '../features/audio/audio-buses.schema.js'
export { AudioDecodeFailed, type AudioDecodeFailedFields } from '../features/audio/audio-error.js'
export type { AudioContextLike } from '../features/audio/audio-graph.js'
export type { MusicOptions } from '../features/audio/audio-music.js'
export {
  AUDIO_SETTINGS_DEFAULT,
  type AudioSettings,
  audioSettingsSchema,
} from '../features/audio/audio-settings.schema.js'
export type { EventSounds } from '../features/audio/event-sounds.js'
export type {
  DisplayCopy,
  GameOrientation,
  RotateHintMode,
} from '../features/display/display-policy.svelte.js'
export type { TouchStickSink } from '../features/input/analog/analog-input.js'
export {
  CAMERA_SETTINGS_DEFAULT,
  CAMERA_TURN_SPEED,
  type CameraSettings,
  cameraSettingsSchema,
} from '../features/input/analog/camera-settings.schema.js'
export {
  MAX_TURN_UNITS_PER_STEP,
  TURN_UNITS_PER_TURN,
  turnUnitsFromPixels,
} from '../features/input/analog/camera-turn.js'
export {
  type BindingOverride,
  INPUT_SETTINGS_DEFAULT,
  type InputSettings,
  inputSettingsSchema,
} from '../features/input/bindings/input-settings.schema.js'
export {
  applyOverrides,
  type Capture,
  RebindCancelled,
  RebindConflict,
  type RebindError,
  RebindReserved,
  RebindTimedOut,
  RebindUnknown,
  rebindProfile,
} from '../features/input/bindings/rebind.js'
export {
  CameraDragTracker,
  type DragPointer,
  type DragSink,
  type DragStart,
} from '../features/input/gestures/camera-drag-tracker.js'
export {
  GESTURE_TUNING,
  type GestureSink,
  type GestureTuning,
  type SwipeIndicator,
  SwipeTracker,
} from '../features/input/gestures/swipe-tracker.js'
export {
  browserHaptics,
  createHaptics,
  type HapticPulse,
  Haptics,
  type HapticsOptions,
} from '../features/input/haptics/haptics.manager.js'
export { Input, type InputOptions, makeInput, REBIND_TIMEOUT_MS } from '../features/input/input.manager.js'
export {
  actionsForGesture,
  actionsForKey,
  actionsForPadButton,
  type GestureName,
  type InputBinding,
  type InputContext,
  type InputProfile,
  type InputProfileInput,
  inputProfileSchema,
  RESERVED_KEYS,
  RESERVED_PAD_BUTTONS,
  STANDARD_PAD_BUTTON_MAX,
  type StickDirection,
  type TouchMode,
  touchModesFor,
} from '../features/input/input-profile.schema.js'
export type { MenuAction } from '../features/input/menu-actions.js'
export type { EventScores } from '../features/leaderboards/event-scores.js'
export {
  type BoardEntry,
  type BoardQuery,
  type BoardView,
  Leaderboards,
  makeLeaderboards,
} from '../features/leaderboards/leaderboards.manager.js'
export { applyDocumentLocale, textDirection } from '../features/locale/document-locale.js'
export {
  formatDateTime,
  formatDuration,
  formatNumber,
  formatPercent,
  pluralCategory,
  selectPlural,
} from '../features/locale/format.js'
export {
  LOCALE_SAVE_KEY,
  Locale,
  type LocaleDef,
} from '../features/locale/locale.manager.js'
export { type LocaleCandidates, matchLocale, negotiateLocale } from '../features/locale/negotiate-locale.js'
export {
  createT,
  type MessageFunction,
  type ParaglideRuntime,
  type Translate,
} from '../features/locale/paraglide.js'
export {
  type Loaded,
  type Save,
  type SaveServiceOptions,
  type SaveWriteOptions,
  saveService,
} from '../features/saves/save.manager.js'
export {
  type AutosavePolicy,
  type AutosaveTrigger,
  defineSave,
  type SaveDef,
  type SaveEnvelope,
  type SaveMigration,
  type SlotMeta,
  type SlotState,
} from '../features/saves/save.schema.js'
export {
  SaveFromNewerBuild,
  type SaveFromNewerBuildFields,
  SaveRefused,
  type SaveRefusedFields,
  SaveUnreadable,
  type SaveUnreadableFields,
} from '../features/saves/save-error.js'
export { makeSaves, Saves, saveOf } from '../features/saves/saves.manager.js'
export { Assets } from '../shared/runtime/assets.manager.js'
export type { BoardState } from '../shared/runtime/board-state.js'
export {
  AssetLoadFailed,
  BootDefect,
  type BootError,
  ContentHashMismatch,
  LoadStalled,
  ModelInvalid,
  RendererUnavailable,
} from '../shared/runtime/boot-error.js'
export {
  DEFAULT_QUALITY,
  type DisplaySettings,
  displaySettingsSchema,
  QUALITY_TIERS,
  type QualityTier,
  qualityTierSchema,
} from '../shared/runtime/display-settings.schema.js'
export type { GlyphFamily } from '../shared/runtime/glyph-family.js'
export type { ActiveDevice, InputContextNow, InputDevice, PadInfo } from '../shared/runtime/input-device.js'
export {
  type LoadMeter,
  SLOW_MS,
  STALL_MS,
} from '../shared/runtime/load-meter.js'
export { AppLoop } from '../shared/runtime/loop/app-loop.manager.js'
export { type FrameInfo, MAX_FRAME_MS } from '../shared/runtime/loop/frames.js'
export {
  PresentationBus,
  type RuntimeFacts,
  typedBus,
} from '../shared/runtime/presentation/presentation-bus.manager.js'
export {
  type GameRenderer,
  Renderer,
  type RendererFactory,
  type RenderTarget,
} from '../shared/runtime/render/renderer.js'
export { type DeviceStorage, liveDeviceStorage } from '../shared/runtime/settings/device-storage.js'
export {
  Settings,
  type SettingsDef,
  type SettingsStore,
  settingsStore,
} from '../shared/runtime/settings/settings.manager.js'
export {
  type PauseReason,
  Time,
} from '../shared/runtime/time/time.manager.js'
