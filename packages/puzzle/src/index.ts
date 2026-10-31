// @mcthaydt/automata-puzzle: the puzzle interpreter (M6 spec §4.5). The sim side is the `./sim` entry; this entry adds
// the `puzzle` content kind. `puzzleExtension` follows once Plus's core.ref includes the runtime's extension entry.

export { puzzleContent, puzzleSchema } from './puzzle.content'
export * from './sim/index'
export type { PuzzleCheckOptions } from './sim/puzzle-checks'
