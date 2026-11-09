// @automata/puzzle/sim: the puzzle interpreter, a sim entry. `Value` and `Cond` are puzzle's
// narrative and systems import them from here.
export { fallbackLine, holds, match, type Reader, uses, type Verb } from '../shared/sim/interpret'
export { loadPuzzle } from '../shared/sim/load-puzzle'
export { VerbCommand } from '../shared/sim/puzzle.command'
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
} from '../shared/sim/puzzle.event'
export { createPuzzlePlugin, puzzlePlugin } from '../shared/sim/puzzle.plugin'
export { PuzzleSceneResource, PuzzleState } from '../shared/sim/puzzle.resource'
export type { Action, Effect, Entry, Lethal, Point, PuzzleDef, Systemic } from '../shared/sim/puzzle.schema'
export { effectSchema, puzzleDefShape } from '../shared/sim/puzzle.schema'
export type { PuzzleCall, PuzzleOptions, VerbReport } from '../shared/sim/puzzle.system'
export { type PuzzleDebugSummary, puzzleDebugSummary } from '../shared/sim/puzzle-debug'
export { type Cond, condSchema, type Value, valueSchema } from '../shared/sim/value.schema'
