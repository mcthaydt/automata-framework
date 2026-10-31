// @mcthaydt/automata-puzzle/sim: the puzzle interpreter (M6 spec §4.5), a sim entry. `Value` and `Cond` are puzzle's
// (§3): narrative and systems import them from here.
export { fallbackLine, holds, match, type Reader, uses, type Verb } from './interpret'
export { loadPuzzle } from './load-puzzle'
export { VerbCommand } from './puzzle.command'
export {
  PuzzleCheckpoint,
  PuzzleCutscene,
  PuzzleDialogue,
  PuzzleExit,
  PuzzleGave,
  PuzzleGoal,
  PuzzleKeypad,
  PuzzleNoise,
  PuzzleSaid,
} from './puzzle.event'
export { createPuzzlePlugin, puzzlePlugin } from './puzzle.plugin'
export { PuzzleSceneResource, PuzzleState } from './puzzle.resource'
export type { Action, Effect, Entry, Lethal, Point, PuzzleDef, Systemic } from './puzzle.schema'
export { effectSchema, puzzleDefShape } from './puzzle.schema'
export type { PuzzleCall, PuzzleOptions, VerbReport } from './puzzle.system'
export { type PuzzleDebugSummary, puzzleDebugSummary } from './puzzle-debug'
export { type Cond, condSchema, type Value, valueSchema } from './value.schema'
