// The Controls section's data (M4 spec §4.5, §7): a row per game action, the devices that can be rebound, and
// the section's state through a rebind. Every word is the game's (`ControlsCopy`); the section is told the action
// labels, so its messages name actions as the player reads them.
import type { PromptBinding } from '../../../shared/ui/prompts/prompt-label'

/** A device a player can rebind (touch buttons and gestures are the game's). */
export type RebindDevice = 'keyboard' | 'gamepad'
/** How touch drives play (runtime's `TouchMode`). */
export type ControlsTouchMode = 'buttons' | 'swipe'

/** One game action in the Controls section: its id, its name and its bindings now. */
export interface ControlsRow {
  /** The action's id, as `onrebind` reports it. */
  readonly id: string
  readonly label: string
  readonly binding: PromptBinding
}

/**
 * Where a rebind is: the list; waiting for a press (with the seconds left); refused because it would leave `with`
 * unbound; refused as reserved; timed out; or saved.
 */
export type ControlsState =
  | { readonly kind: 'list' }
  | {
      readonly kind: 'capturing'
      readonly action: string
      readonly device: RebindDevice
      readonly secondsLeft: number
    }
  | { readonly kind: 'conflict'; readonly action: string; readonly with: string }
  | { readonly kind: 'reserved'; readonly action: string }
  | { readonly kind: 'timed-out'; readonly action: string }
  | { readonly kind: 'saved'; readonly action: string }

/** Every word the Controls section shows, in the game's language. */
export interface ControlsCopy {
  readonly title: string
  /** Each device section's heading. */
  readonly keyboard: string
  readonly gamepad: string
  readonly touch: string
  /** The mark on the section of the device in the player's hand. */
  readonly inUse: string
  readonly reset: string
  /** On the button that waits for a press. */
  readonly press: string
  /** A rebind button's name for assistive technology: "Change Jump on Keyboard". */
  rebind(action: string, device: string): string
  capturing(action: string, device: string, secondsLeft: number): string
  conflict(action: string, other: string): string
  reserved(action: string): string
  timedOut(action: string): string
  saved(action: string): string
}

/** The section's status line for `state`, with actions by their labels; empty in the list. */
export function controlsMessage(
  state: ControlsState,
  copy: ControlsCopy,
  labelOf: (action: string) => string,
): string {
  switch (state.kind) {
    case 'list':
      return ''
    case 'capturing':
      return copy.capturing(labelOf(state.action), copy[state.device], state.secondsLeft)
    case 'conflict':
      return copy.conflict(labelOf(state.action), labelOf(state.with))
    case 'reserved':
      return copy.reserved(labelOf(state.action))
    case 'timed-out':
      return copy.timedOut(labelOf(state.action))
    case 'saved':
      return copy.saved(labelOf(state.action))
  }
}
