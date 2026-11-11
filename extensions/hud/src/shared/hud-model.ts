// What the play HUD is fed and what it asks for. The game builds a `HudModel` each frame from its own state (this file
// names no extension and nothing of any game), and the pieces draw it; they never decide anything, they call `HudActions`
// and the game turns each into a command (law 2: presentation observes). Words are message keys, resolved at the last
// moment by the `words` the game gives.
import type { HudFile } from './hud.schema'

/** What the HUD shows this frame. */
export interface HudModel {
  /** The key of the objective line, or undefined for none. */
  readonly objective: string | undefined
  /** The hotspot in reach: its id and the key of its name. */
  readonly prompt: { readonly at: string; readonly name: string } | undefined
  /** The items carried: id, the key of the name and the key of the text. */
  readonly items: readonly { readonly id: string; readonly name: string; readonly text: string }[]
  /** The item in hand. */
  readonly held: string | undefined
  /** An examine box to show: a title key and a line key. */
  readonly examine: { readonly title: string | undefined; readonly line: string } | undefined
  /** The keypad: whether it is open and how many digits a code has. */
  readonly keypad: { readonly open: boolean; readonly digits: number }
  /** A cutscene holds input: every piece but the examine box is hidden. */
  readonly locked: boolean
}

/** What the pieces ask the game to do. */
export interface HudActions {
  use(at: string): void
  hold(item: string | undefined): void
  examineItem(item: string): void
  combine(a: string, b: string): void
  code(code: string): void
  dismiss(): void
}

export interface HudOptions {
  /** The file that places the pieces and says which words they show. */
  readonly file: HudFile
  /** The words for a message key; undefined when there are none (a key is never shown to a player). */
  readonly words: (key: string) => string | undefined
  /** The model, read again each frame. */
  readonly model: () => HudModel
  readonly actions: HudActions
}
