import type { Command, CommandDef } from '@mcthaydt/automata-sim'

/** One on-screen touch button: every key bound to the same payload shares it. */
export interface TouchButton {
  readonly id: string
  readonly label: string
  readonly keys: readonly string[]
}

/** The input map attached to a window for one play session. */
export interface InputSource {
  /** This tick's command, if any: one per tick, never an edge (DX spec §3.3). */
  commands(tick: number): readonly Command[]
  /** A touch button pressed or released (its `TouchButton.id`). */
  hold(buttonId: string): void
  release(buttonId: string): void
  dispose(): void
}

/** Held keys, touch buttons and gamepad buttons, turned into one command per tick (DX spec §3.3). */
export interface InputMap {
  readonly command: CommandDef
  /** Whether the play screen shows touch buttons when the player uses touch. */
  readonly touch: boolean
  readonly touchButtons: readonly TouchButton[]
  attach(target: Window): InputSource
}

export function keys(): never {
  throw new Error('not implemented')
}
