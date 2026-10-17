import { FocusNavigator } from '@mcthaydt/automata-ui'

/** Polls the standard pads on a menu screen (G-8). */
export interface MenuPad {
  /** Reads the pads once; call it each frame while the menu is open. */
  poll(): void
}

const CONFIRM = 0
const BACK = 1

/**
 * A controller on the title and paused screens: the standard mapping's A clicks the focused button and
 * B sends Escape, through the ui `FocusNavigator`, once per press. The first poll only records what is
 * held, so the A that pressed Play on the previous screen does not also press this screen's primary.
 * Any standard pad counts; a pad without the standard mapping has no known A or B and is ignored.
 */
export function menuPad(
  read: () => readonly (Gamepad | null)[],
  navigator: FocusNavigator = new FocusNavigator(),
): MenuPad {
  let held: [boolean, boolean] | undefined
  const pressed = (pads: readonly (Gamepad | null)[], index: number): boolean =>
    pads.some((pad) => pad?.mapping === 'standard' && pad.buttons[index]?.pressed === true)

  return {
    poll() {
      const pads = read()
      const now: [boolean, boolean] = [pressed(pads, CONFIRM), pressed(pads, BACK)]
      if (held !== undefined) {
        if (now[0] && !held[0]) navigator.confirm()
        if (now[1] && !held[1]) navigator.back()
      }
      held = now
    },
  }
}
