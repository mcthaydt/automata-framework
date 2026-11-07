// A scene change (M6 spec §5): the game's Flow makes the new scene's def the puzzle, and the play state starts from the
// def's facts with an entry's items and facts laid over (the first entry when none is named).
import type { SimContext } from '@mcthaydt/automata-sim'
import { PuzzleSceneResource, PuzzleState } from './puzzle.resource'
import { type PuzzleDef, puzzleDefShape } from './puzzle.schema'

export function loadPuzzle(ctx: SimContext, def: PuzzleDef, entryName?: string): void {
  const checked = puzzleDefShape.parse(def)
  const entry = entryName === undefined ? checked.entry[0] : checked.entry.find((e) => e.name === entryName)
  if (entryName !== undefined && entry === undefined)
    throw new Error(`${checked.scene}: no entry "${entryName}"`)
  ctx.resource(PuzzleSceneResource).def = checked
  const state = ctx.resource(PuzzleState)
  state.facts = { ...checked.facts, ...entry?.facts }
  state.items = [...(entry?.items ?? [])].sort()
  state.seen = []
  state.goal = false
}
