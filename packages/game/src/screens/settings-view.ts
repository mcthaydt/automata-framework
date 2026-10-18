// The default Settings screen's live state (`settings-screen.svelte.ts` keeps it in a `$state` object).
import type {
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
  glyphs: PromptGlyphs
  controls: ControlsState
  layout: ReadonlyMap<string, string> | undefined
  touchModes: readonly ControlsTouchMode[]
  touchMode: ControlsTouchMode
  quality: DisplayQuality
  reducedMotion: boolean
}
