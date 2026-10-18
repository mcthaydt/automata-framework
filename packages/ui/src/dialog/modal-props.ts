import type { Snippet } from 'svelte'

/** The props Modal and Sheet share. */
export interface ModalProps {
  title: string
  /** The Close button's name, in the game's language. */
  closeLabel: string
  onclose: () => void
  /** A tap on the dimmed page around the panel; absent, such a tap does nothing. */
  onbackdrop?: (() => void) | undefined
  children?: Snippet | undefined
  /** What sits with the title (Settings' tabs): beside it where the dialog is 480 px wide, under it where not. */
  head?: Snippet | undefined
  /** A long body (Settings) that widens on a short, wide band to set its groups two across; others keep their width. */
  wide?: boolean | undefined
  /** A dialog that fills a phone's band, its body taking the rest and its actions at the bottom (Settings). */
  fill?: boolean | undefined
  /** The buttons, in reading order. Mark the safe one with `data-initial-focus`. */
  actions?: Snippet | undefined
  testId?: string | undefined
}
