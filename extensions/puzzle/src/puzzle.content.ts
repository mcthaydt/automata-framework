// The `puzzle` content kind (M6 spec §4.5): every TOML file in `content/puzzles` is one scene's puzzle. The game says
// which calls it declares and which extensions it registers, so a reference to either is checked when content compiles.
import { type ContentSchemaDef, defineContentSchema } from '@automata/content/schema'
import type { z } from 'zod'
import { type PuzzleDef, puzzleDefShape } from './sim/puzzle.schema'
import { checkPuzzle, type PuzzleCheckOptions } from './sim/puzzle-checks'

export const puzzleSchema = (options: PuzzleCheckOptions): z.ZodType<PuzzleDef> =>
  puzzleDefShape.superRefine((def, context) =>
    checkPuzzle(def, options, (path, message) => context.addIssue({ code: 'custom', path, message })),
  )

export const puzzleContent = (
  options: PuzzleCheckOptions,
): ContentSchemaDef<'puzzle', z.ZodType<PuzzleDef>> =>
  defineContentSchema('puzzle', puzzleSchema(options), { folder: 'puzzles' })
