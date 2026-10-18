// The default Settings screen's live state (`settings-screen.svelte.ts` keeps it in a `$state` object).
import type {
  AudioValue,
  ControlsRow,
  ControlsState,
  ControlsTouchMode,
  DisplayQuality,
  PromptGlyphs,
  RebindDevice,
} from '@mcthaydt/automata-ui'

export interface SettingsViewState {
  /** The game's actions; undefined without an input map, and then there is no Controls section. */
  rows: readonly ControlsRow[] | undefined
  devices: readonly RebindDevice[]
  /** `(pointer: coarse)`: the player can touch, so the Controls tab says what the on-screen buttons do and the
   * Settings tab offers the touch mode. */
  coarse: boolean
  glyphs: PromptGlyphs
  controls: ControlsState
  layout: ReadonlyMap<string, string> | undefined
  touchModes: readonly ControlsTouchMode[]
  touchMode: ControlsTouchMode
  quality: DisplayQuality
  /** The Audio group (M5.4): the player's choices, whether sound could start, and whether the host's volume is down. */
  audio: AudioValue
  /** The Language group (redo step 9): the game's locales and the player's pick, null for Automatic. */
  locales: readonly string[]
  localeChoice: string | null
  audioAvailable: boolean
  hostVolumeBelowFull: boolean
  reducedMotion: boolean
}
