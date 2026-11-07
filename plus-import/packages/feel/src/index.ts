// @mcthaydt/automata-feel: game feel as data (M6 spec §4.1): hits that shake, hold, flash, squash and pop a word, from `feel.toml`,
// switchable by the player. Presentation only.

export { type Beat, Beats, type BeatsOptions } from './dynamics/beats'
export { hash } from './dynamics/noise'
export {
  createFeel,
  DEFAULT_SETTINGS,
  type EntityRef,
  type Feel,
  type FeelFrame,
  type FeelOptions,
  type FeelSettings,
  matches,
  type Pulse,
  type WordPop,
} from './feel'
export { feelContent } from './feel.content'
export { feelExtension } from './feel.extension'
export {
  type AudioRow,
  type CameraRow,
  DEFAULT_LIMITS,
  type FeelContent,
  type FeelEntry,
  feelSchema,
  type HapticRow,
  type Limits,
  limitWarnings,
  type PoseRow,
  resolveLimits,
  type SpringTuning,
  type VisualRow,
  type WordRow,
} from './feel.schema'
