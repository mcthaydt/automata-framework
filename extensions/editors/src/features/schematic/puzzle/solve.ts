// "Can it be finished?" for a puzzle, in a sentence. The solver (`@automata/puzzle/solver`) searches the puzzle's states for
// the goal and for states the player can get stuck in. It runs in a worker in the page (`solver-worker.ts`), because a
// large puzzle takes long enough to freeze a page. What the game's own code does (`{ call }`) is not data, so the solver is
// told each call changes nothing, and the answer says which were not counted.
import type { PuzzleDef } from '@automata/puzzle/sim'
import { createSolver, type State } from '@automata/puzzle/solver'
import { spaced } from '../pieces/piece.ts'

export interface PuzzleAnswer {
  readonly finishable: boolean
  readonly words: string
}

const plural = (n: number): string => `${n} ${n === 1 ? 'step' : 'steps'}`

/** The game's code the puzzle calls, by name, each once. */
const callsOf = (def: PuzzleDef): string[] => [
  ...new Set(def.actions.flatMap((a) => a.then.flatMap((e) => ('call' in e ? [e.call] : [])))),
]

export function canFinish(def: PuzzleDef): PuzzleAnswer {
  const calls = callsOf(def)
  const model = {
    calls: Object.fromEntries(calls.map((name) => [name, (state: State): State[] => [state]])),
  }
  const solver = createSolver(def, model)
  const solved = solver.solve()
  const stuck = solver.softlocks(1)
  const first = stuck.softlocks[0]
  const trail = first === undefined ? '' : first.trail.map((step) => spaced(step)).join(', then ')
  const uncounted =
    calls.length === 0 ? '' : ` What the game’s code does (${calls.join(', ')}) is not counted.`
  if (solved.capped)
    return { finishable: false, words: `Not sure: this puzzle is too big to check all of.${uncounted}` }
  if (solved.shortest === null)
    return {
      finishable: false,
      words: `No: ${first === undefined ? 'nothing the player can do reaches the goal' : `the player can get stuck after ${trail}`}.${uncounted}`,
    }
  const steps = plural(solved.shortest.steps.length)
  const caution = first === undefined ? '' : ` But the player can get stuck after ${trail}.`
  return { finishable: true, words: `Yes, in ${steps}.${caution}${uncounted}` }
}
