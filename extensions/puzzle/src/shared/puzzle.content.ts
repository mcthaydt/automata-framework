// The `puzzle` content kind: every TOML file in `content/puzzles` is one scene's puzzle. The game says
// which calls it declares and which extensions it registers, so a reference to either is checked when content compiles.
import { type ContentSchemaDef, defineContentSchema } from '@automata/content/schema'
import type { z } from 'zod'
import { type PuzzleDef, puzzleDefShape } from './sim/puzzle.schema'
import { checkPuzzle, type PuzzleCheckOptions } from './sim/puzzle-checks'

/**
 * The Zod schema of a puzzle with all its cross-checks: every item, fact, call and extension an
 * action names must exist.
 */
export const puzzleSchema = (options: PuzzleCheckOptions): z.ZodType<PuzzleDef> =>
  puzzleDefShape.superRefine((def, context) =>
    checkPuzzle(def, options, (path, message) => context.addIssue({ code: 'custom', path, message })),
  )

/** The `puzzle` content kind: `content/puzzles/*.toml`, one puzzle per scene. */
export const puzzleContent = (
  options: PuzzleCheckOptions,
): ContentSchemaDef<'puzzle', z.ZodType<PuzzleDef>> =>
  defineContentSchema('puzzle', puzzleSchema(options), { folder: 'puzzles' })
