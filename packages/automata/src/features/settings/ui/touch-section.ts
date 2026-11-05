// The Touch controls group's words (FloorFifty `SettingsPanel.svelte` at a28dc44): how touch drives play.
import type { ControlsTouchMode } from './controls-section'

/** Every word the Touch controls group shows, in the game's language. */
export interface TouchCopy {
  readonly title: string
  /** The mode choice's name. */
  readonly mode: string
  readonly modes: Readonly<Record<ControlsTouchMode, string>>
}
