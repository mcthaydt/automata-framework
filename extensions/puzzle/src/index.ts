// @automata/puzzle: the puzzle interpreter (M6 spec §4.5). The sim side is the `./sim` entry; this entry adds
// the `puzzle` content kind and `puzzleExtension`, which registers both from one set of options.

export { puzzleContent, puzzleSchema } from './puzzle.content'
export { type PuzzleExtensionOptions, puzzleExtension } from './puzzle.extension'
export * from './sim/index'
export type { PuzzleCheckOptions } from './sim/puzzle-checks'
