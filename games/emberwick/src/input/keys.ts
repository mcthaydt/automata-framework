// Keyboard and touch input as "what is held", turned into the sim's `move` command once per tick. Gamepad and
// remapping come with the input milestone (M4).
import type { MoveInput } from '../sim/index.ts'

export type Action = 'left' | 'right' | 'jump' | 'pause'

/** By `KeyboardEvent.code`, so the keys sit in the same place on every keyboard layout. */
const KEYS: Readonly<Record<string, Action>> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Space: 'jump',
  KeyZ: 'jump',
  KeyW: 'jump',
  ArrowUp: 'jump',
  Escape: 'pause',
  KeyP: 'pause',
}

export function actionForKey(code: string): Action | undefined {
  return KEYS[code]
}

export interface Held {
  readonly left: boolean
  readonly right: boolean
  readonly jump: boolean
}

export const NOTHING_HELD: Held = { left: false, right: false, jump: false }

/** Left and right together cancel out. */
export function toMove(held: Held): MoveInput {
  const x = held.left === held.right ? 0 : held.left ? -1 : 1
  return { x, jump: held.jump }
}
