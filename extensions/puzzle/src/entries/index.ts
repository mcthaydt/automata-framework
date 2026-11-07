// @automata/puzzle: the puzzle interpreter. The sim side is the `./sim` entry; this entry adds
// the `puzzle` content kind and `puzzleExtension`, which registers both from one set of options.

export { puzzleContent, puzzleSchema } from '../features/rules/puzzle.content'
export { type PuzzleExtensionOptions, puzzleExtension } from '../features/rules/puzzle.extension'
export type { PuzzleCheckOptions } from '../shared/sim/puzzle-checks'
export * from './sim'
