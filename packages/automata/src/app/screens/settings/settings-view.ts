// The default Settings screen's live state (`settings-screen.svelte.ts` keeps it in a `$state` object).

import type { PromptGlyphs } from '../../../shared/ui/prompts/prompt-label.ts'
import type { AudioValue } from './audio-section.ts'
import type { ControlsRow, ControlsState, ControlsTouchMode, RebindDevice } from './controls-section.ts'
import type { DisplayQuality } from './display-section.ts'

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
  /** The Audio group: the player's choices, whether sound could start, and whether the host's volume is down. */
  audio: AudioValue
  /** The Language group (redo step 9): the game's locales and the player's pick, null for Automatic. */
  locales: readonly string[]
  /** The Vibration group (redo step 10): shown only where the device can rumble or buzz. */
  hapticsSupported: boolean
  hapticsEnabled: boolean
  localeChoice: string | null
  audioAvailable: boolean
  hostVolumeBelowFull: boolean
  reducedMotion: boolean
}
