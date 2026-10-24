// What a level whose sectors do not resolve answers as the `rooms` check: the engine's own sentence, located at the
// sector it is about when it names one. Last Light and AF levels fail to resolve in the same way (a portal to a
// sector that is not there), so both profiles say it through this.
import { type Problem, place, sectorSelection } from './check'

/** The sector a resolve error is about, when it says (`hall: unknown portal target counter`). */
export function roomsProblem(error: unknown): Problem {
  const message = error instanceof Error ? error.message : String(error)
  const room = /^(.+): unknown portal target /.exec(message)?.[1]
  return { message, locator: room === undefined ? undefined : place(() => sectorSelection(room)) }
}
