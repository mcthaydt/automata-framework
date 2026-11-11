// What a game gives interact: who the player is, what the hotspots' conditions read, and what hiding does.
import type { PuzzleOptions, Reader } from '@automata/puzzle/sim'
import type { SimContext } from '@automata/sim'

/** What a view of the sim needs to ask: a system's context has it, and so has a `Sim` outside a step. */
export type SimView = Pick<SimContext, 'entity' | 'query' | 'resource'>

export interface InteractOptions {
  /** The player's entity and where it stands. Read each tick, and by the HUD for the prompt. */
  readonly player: (
    view: SimView,
  ) => { readonly entity: number; readonly x: number; readonly z: number } | undefined
  /** The reader the hotspots' `when` is asked of: the same facts the puzzle reads. */
  readonly reader: (view: SimView) => Reader
  /** Called for a hiding place in place of a verb; a game passes `systems.hide`. Without it a hiding place is an ordinary hotspot. */
  readonly hide?: ((ctx: SimContext, spot: string) => void) | undefined
  /** The options the game gave `createPuzzlePlugin`, so a use runs the same `call` effects as a verb command does. */
  readonly puzzle?: PuzzleOptions | undefined
}
