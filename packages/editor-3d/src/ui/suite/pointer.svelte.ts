import type { Point } from '../../format/sector.schema'
import type { Levels3dSuiteSession } from './levels-3d-suite-editor'

// Where the pointer is on the plan, for the status line (plan EDS.2d): the canvas and the status are two regions of the
// suite's shell, so the place they share is kept beside the session, as Svelte state, and goes with it.

export class PlanPointer {
  at: Point | undefined = $state.raw<Point | undefined>()
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
