import { Effect, SubscriptionRef } from 'effect'
import { FocusNavigator, type NavDirection } from '../../shared/ui/focus/focus-nav.ts'
import type { Input } from '../input/input.manager.ts'
import type { MenuAction } from '../input/menu-actions.ts'

/** Drives a menu screen's focus from the Input service (M4 spec §4.7). */
export interface MenuInput {
  /** Reads the pads and keeps focus on the screen; call it each frame while the menu is open. */
  poll(nowMs: number): void
  /** Stops listening to the Input. */
  stop(): void
}

const STEERS: readonly (readonly [MenuAction, NavDirection])[] = [
  ['nav-up', 'up'],
  ['nav-down', 'down'],
  ['nav-left', 'left'],
  ['nav-right', 'right'],
]

/**
 * The title and paused screens' controller and arrow keys, over an `Input` in the `menu` context. Each nav edge
 * (the pad's held-direction repeat included) steers the ui `FocusNavigator`; page and adjust go to it too. A pad's
 * confirm clicks the focused control and its back sends Escape. The keyboard's Enter, Space and Escape are left to
 * the browser and the screen's own listeners, which already click and go back: taking them here would act twice.
 *
 * The first poll only records what the pads hold, so the A that pressed Play on the last screen does not also press
 * this screen's primary (F-a): `Input` fires a press on the first poll that sees it (I-d timings start at 0 ms).
 */
export function menuInput(
  input: Pick<Input, 'onPress' | 'poll' | 'device'>,
  navigator: FocusNavigator = new FocusNavigator(),
): MenuInput {
  let recording = false
  const fromPad = (): boolean => Effect.runSync(SubscriptionRef.get(input.device)).device === 'gamepad'
  const on = (action: MenuAction, run: () => void, padOnly = false) =>
    input.onPress(action, () => {
      if (recording || (padOnly && !fromPad())) return
      run()
    })

  const stops = [
    ...STEERS.map(([action, direction]) => on(action, () => void navigator.steer(direction))),
    on('page-prev', () => void navigator.page(-1)),
    on('page-next', () => void navigator.page(1)),
    on('adjust-dec', () => void navigator.adjust(-1)),
    on('adjust-inc', () => void navigator.adjust(1)),
    on('confirm', () => navigator.confirm(), true),
    on('back', () => navigator.back(), true),
  ]

  let first = true
  return {
    poll(nowMs) {
      recording = first
      input.poll(nowMs)
      recording = false
      first = false
      navigator.recover()
    },
    stop() {
      for (const stop of stops) stop()
    },
  }
}
