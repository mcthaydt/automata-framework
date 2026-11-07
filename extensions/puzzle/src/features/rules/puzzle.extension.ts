// `puzzle` as an extension a game opts into: the sim plugin and the `puzzle` content kind, built from one set of
// options, so the calls content may name are the calls the plugin runs (P6-D2 as built).
import { defineExtension, type ExtensionDef } from '@automata/framework/extension'
import { sortedKeys } from '@automata/sim'
import { createPuzzlePlugin } from '../../shared/sim/puzzle.plugin'
import type { PuzzleOptions } from '../../shared/sim/puzzle.system'
import { puzzleContent } from './puzzle.content'

/**
 * The puzzle's options plus the names of the extensions the game registers, so an effect that
 * needs a missing one fails when content compiles.
 */
export interface PuzzleExtensionOptions extends PuzzleOptions {
  /** The extensions the game registers, so an effect that needs a missing one fails when content compiles. */
  readonly extensions: readonly string[]
}

/**
 * The puzzle extension a game opts into. It adds the puzzle plugin and the `puzzle` content kind
 * from one set of options.
 */
export const puzzleExtension = (options: PuzzleExtensionOptions): ExtensionDef<'puzzle'> =>
  defineExtension({
    name: 'puzzle',
    sim: [createPuzzlePlugin(options)],
    content: [puzzleContent({ calls: sortedKeys(options.calls ?? {}), extensions: options.extensions })],
  })
