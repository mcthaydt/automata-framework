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
  /** The buttons, in reading order. Mark the safe one with `data-initial-focus`. */
  actions?: Snippet | undefined
  testId?: string | undefined
}
