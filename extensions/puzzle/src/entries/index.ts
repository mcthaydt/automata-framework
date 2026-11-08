// @automata/puzzle: the puzzle interpreter. The sim side is the `./sim` entry; this entry adds
// the `puzzle` content kind and `puzzleExtension`, which registers both from one set of options.

export { type PuzzleExtensionOptions, puzzleExtension } from '../app/puzzle.extension'
export { puzzleContent, puzzleSchema } from '../shared/puzzle.content'
export type { PuzzleCheckOptions } from '../shared/sim/puzzle-checks'
export * from './sim'
