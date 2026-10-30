export {
  Audio,
  AudioLive,
  type AudioOptions,
  type AudioServices,
  audioLayer,
  makeAudio,
  type SoundOptions,
} from './audio/audio.manager.js'
export { AudioBuses } from './audio/audio-buses.js'
export {
  AUDIO_BUS_NAMES,
  type AudioBusGains,
  type AudioBusName,
  audioBusGainsSchema,
} from './audio/audio-buses.schema.js'
export { AudioDecodeFailed, type AudioDecodeFailedFields } from './audio/audio-error.js'
export type { AudioContextLike } from './audio/audio-graph.js'
export type { MusicOptions } from './audio/audio-music.js'
export type { EventSounds } from './audio/event-sounds.js'
export {
  AssetLoadFailed,
  BootDefect,
  type BootError,
  ContentHashMismatch,
  LoadStalled,
  RendererUnavailable,
} from './boot/boot-error.js'
/** The content hash the boot check recomputes; tooling that changes content before a run hashes it with this. */
export { contentHashOf } from './boot/boot-program.js'
export type {
  CompiledContentData,
  GameDefinition,
  RuntimeHandle,
  RuntimeSeams,
} from './boot/game-definition.js'
export { runGame } from './boot/run-game.js'
export type { DisplayCopy, GameOrientation, RotateHintMode } from './display/display-policy.svelte.js'
export { Flow } from './flow/flow.manager.js'
export type {
  FlowFailure,
  RuntimeServices,
  ScreenContext,
  ScreenDef,
} from './flow/screen.js'
export {
  browserHaptics,
  createHaptics,
  type HapticPulse,
  Haptics,
  type HapticsOptions,
} from './haptics/haptics.manager.js'
export type { TouchStickSink } from './input/analog/analog-input.js'
export {
  CAMERA_SETTINGS_DEFAULT,
  CAMERA_TURN_SPEED,
  type CameraSettings,
  cameraSettingsSchema,
} from './input/analog/camera-settings.schema.js'
export {
  MAX_TURN_UNITS_PER_STEP,
  TURN_UNITS_PER_TURN,
  turnUnitsFromPixels,
} from './input/analog/camera-turn.js'
export {
  type BindingOverride,
  INPUT_SETTINGS_DEFAULT,
  type InputSettings,
  inputSettingsSchema,
} from './input/bindings/input-settings.schema.js'
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
} from './input/bindings/rebind.js'
export type { GlyphFamily } from './input/gamepad/glyph-family.js'
export {
  CameraDragTracker,
  type DragPointer,
  type DragSink,
  type DragStart,
} from './input/gestures/camera-drag-tracker.js'
export {
  GESTURE_TUNING,
  type GestureSink,
  type GestureTuning,
  type SwipeIndicator,
  SwipeTracker,
} from './input/gestures/swipe-tracker.js'
export {
  type ActiveDevice,
  Input,
  type InputContextNow,
  type InputDevice,
  type InputOptions,
  makeInput,
  type PadInfo,
  REBIND_TIMEOUT_MS,
} from './input/input.manager.js'
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
} from './input/input-profile.schema.js'
export type { MenuAction } from './input/menu-actions.js'
export type { BoardState } from './leaderboards/board-state.js'
export type { EventScores } from './leaderboards/event-scores.js'
export {
  type BoardEntry,
  type BoardQuery,
  type BoardView,
  Leaderboards,
  makeLeaderboards,
} from './leaderboards/leaderboards.manager.js'
export { Assets } from './loading/assets.manager.js'
export {
  type LoadMeter,
  SLOW_MS,
  STALL_MS,
} from './loading/load-meter.js'
export { applyDocumentLocale, textDirection } from './locale/document-locale.js'
export {
  formatDateTime,
  formatDuration,
  formatNumber,
  formatPercent,
  pluralCategory,
  selectPlural,
} from './locale/format.js'
export {
  LOCALE_SAVE_KEY,
  Locale,
  type LocaleDef,
} from './locale/locale.manager.js'
export { type LocaleCandidates, matchLocale, negotiateLocale } from './locale/negotiate-locale.js'
export { createT, type MessageFunction, type ParaglideRuntime, type Translate } from './locale/paraglide.js'
export { AppLoop } from './loop/app-loop.manager.js'
export { type FrameInfo, MAX_FRAME_MS } from './loop/frames.js'
export { type AuthoritativeSnapshot, NetworkPort } from './net/network-port.js'
export {
  PresentationBus,
  type RuntimeFacts,
  typedBus,
} from './presentation/presentation-bus.manager.js'
export {
  type GameRenderer,
  Renderer,
  type RendererFactory,
  type RenderTarget,
} from './render/renderer.js'
export {
  type Loaded,
  type Save,
  type SaveServiceOptions,
  type SaveWriteOptions,
  saveService,
} from './save/save.manager.js'
export {
  type AutosavePolicy,
  type AutosaveTrigger,
  defineSave,
  type SaveDef,
  type SaveEnvelope,
  type SaveMigration,
  type SlotMeta,
  type SlotState,
} from './save/save.schema.js'
export {
  SaveFromNewerBuild,
  type SaveFromNewerBuildFields,
  SaveRefused,
  type SaveRefusedFields,
  SaveUnreadable,
  type SaveUnreadableFields,
} from './save/save-error.js'
export { makeSaves, Saves, saveOf } from './save/saves.manager.js'
export {
  AUDIO_SETTINGS_DEFAULT,
  type AudioSettings,
  audioSettingsSchema,
} from './settings/audio-settings.schema.js'
export {
  CORE_SETTINGS,
  type CoreSettings,
  type HapticsSettings,
  hapticsSettingsSchema,
} from './settings/core-settings.js'
export { type DeviceStorage, liveDeviceStorage } from './settings/device-storage.js'
export {
  DEFAULT_QUALITY,
  type DisplaySettings,
  displaySettingsSchema,
  QUALITY_TIERS,
  type QualityTier,
  qualityTierSchema,
} from './settings/display-settings.schema.js'
export {
  Settings,
  type SettingsDef,
  type SettingsStore,
  settingsStore,
} from './settings/settings.manager.js'
export {
  type PauseReason,
  Time,
} from './time/time.manager.js'
