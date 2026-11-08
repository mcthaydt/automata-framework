// How a game plugs into the solver's tools and the `puzzle` pipeline: a `PuzzleScene` adapter gives its puzzle,
// its solver model and what the doc and the checks need to know about the scene. The tools never import a game.
import type { PuzzleDef } from '../../shared/sim/puzzle.schema'
import type { Walk } from './matrix'
import type { PuzzleModel } from './model'

/**
 * How a game plugs into the solver's tools: its puzzle, its solver model, the names for the
 * generated doc, where the player spawns, the game's text, its cutscene ids, how far apart its
 * hotspots are and the files the doc depends on. The tools never import a game.
 */
export interface PuzzleScene {
  readonly id: string
  readonly def: PuzzleDef
  readonly model: PuzzleModel
  /** Hotspot names for the doc (the hotspots themselves are the puzzle's `hotspots`). */
  readonly names: Readonly<Record<string, string>>
  readonly spawn: { readonly x: number; readonly z: number }
  /** The game's text: line keys to text, item ids to names (the doc's words; a line key with no text fails `validate`). */
  readonly story: {
    readonly lines: Readonly<Record<string, string>>
    readonly items: Readonly<Record<string, string>>
  }
  /** The scene's cutscene ids. */
  readonly cutscenes: readonly string[]
  /** Metres walked between two hotspots (null: from the spawn), every door open. */
  readonly walk: Walk
  /** The files the generated doc depends on, relative to the scene folder, with their XXH64 hashes. */
  readonly sources: readonly { readonly path: string; readonly hash: string }[]
}
