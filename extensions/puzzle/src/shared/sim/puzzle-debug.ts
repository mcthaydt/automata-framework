// What the debug overlay shows of the puzzle (DBG-D4): a plain object built from the play state. `debug` imports no extension, so
// the game hands this over under a `summaryPanel` id. It reads the state and never writes it.
import { sortedKeys } from '@automata/sim'
import type { PuzzleStateValue } from './puzzle.resource'
import type { Value } from './value.schema'

/**
 * What the debug summary shows: whether the goal is reached, the items carried, how many actions
 * were seen and the facts.
 */
export interface PuzzleDebugSummary {
  readonly goal: boolean
  readonly items: string
  readonly seen: number
  readonly facts: Readonly<Record<string, Value>>
}

/** Turns the puzzle's play state into a summary for the debug overlay. */
export function puzzleDebugSummary(state: PuzzleStateValue): PuzzleDebugSummary {
  const facts: Record<string, Value> = {}
  for (const name of sortedKeys(state.facts)) facts[name] = state.facts[name] as Value
  return {
    goal: state.goal,
    items: state.items.length === 0 ? 'none' : state.items.join(', '),
    seen: state.seen.length,
    facts,
  }
}
