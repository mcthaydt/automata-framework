import type { Point } from '@automata/3d/level'
import type { Levels3dSuiteSession } from './levels-3d-suite-editor'

// Where the pointer is on the plan, for the status line (plan EDS.2d): the canvas and the status are two regions of the
// suite's shell, so the place they share is kept beside the session, as Svelte state, and goes with it.

export class PlanPointer {
  at: Point | undefined = $state.raw<Point | undefined>()
  /** What Walk says while it is shown: its warning, else what the crosshair is on. */
  walkWords: string | undefined = $state<string | undefined>()
}

const pointers = new WeakMap<Levels3dSuiteSession, PlanPointer>()

export function pointerOf(session: Levels3dSuiteSession): PlanPointer {
  let pointer = pointers.get(session)
  if (pointer === undefined) {
    pointer = new PlanPointer()
    pointers.set(session, pointer)
  }
  return pointer
}
