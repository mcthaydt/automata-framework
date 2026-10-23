/**
 * The input method the player last used, app-wide.
 *
 * Menus and tutorials teach the controls in the player's hand, and neither
 * lives inside the sim, so this is not the game's input. A mouse moves
 * nothing: it says nothing about which controls to teach. Which buttons a
 * controller carries (its glyph family) belongs to M4 input.
 */

import { padKeyEvents } from '../focus/focus-nav'

export type InputMethod = 'keyboard' | 'gamepad' | 'touch'

/**
 * Tracks the input method the player used last (`keyboard`, `gamepad` or `touch`) as rune state in `method`.
 * `attach` listens for key presses and touch or pen presses, counting a controller's Back (which arrives as
 * Escape) as the controller; `note` records one by hand.
 */
export class InputMethodTracker {
  /** A coarse pointer starts as touch, anything else as keyboard. */
  method: InputMethod = $state<InputMethod>(
    typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches ? 'touch' : 'keyboard',
  )

  note(method: InputMethod): void {
    if (this.method !== method) this.method = method
  }

  /** Listens in the capture phase, so a control that stops propagation still counts. */
  attach(target: EventTarget = window): () => void {
    // A controller's Back arrives as Escape; it is still the controller.
    const onKey = (event: Event): void => {
      if (!padKeyEvents.has(event)) this.note('keyboard')
    }
    const onPointer = (event: Event): void => {
      const type = (event as PointerEvent).pointerType
      if (type === 'touch' || type === 'pen') this.note('touch')
    }
    target.addEventListener('keydown', onKey, { capture: true })
    target.addEventListener('pointerdown', onPointer, { capture: true })
    return () => {
      target.removeEventListener('keydown', onKey, { capture: true })
      target.removeEventListener('pointerdown', onPointer, { capture: true })
    }
  }
}
