// `puzzle` as an extension a game opts into: the sim plugin and the `puzzle` content kind, built from one set of
// options, so the calls content may name are the calls the plugin runs (P6-D2 as built).
import { defineExtension, type ExtensionDef } from '@automata/framework/extension'
import { sortedKeys } from '@automata/sim'
import { puzzleContent } from './puzzle.content'
import { createPuzzlePlugin } from './sim/puzzle.plugin'
import type { PuzzleOptions } from './sim/puzzle.system'

export interface PuzzleExtensionOptions extends PuzzleOptions {
  /** The extensions the game registers, so an effect that needs a missing one fails when content compiles. */
  readonly extensions: readonly string[]
}

export const puzzleExtension = (options: PuzzleExtensionOptions): ExtensionDef<'puzzle'> =>
  defineExtension({
    name: 'puzzle',
    sim: [createPuzzlePlugin(options)],
    content: [puzzleContent({ calls: sortedKeys(options.calls ?? {}), extensions: options.extensions })],
  })
