// The change-set journal (editor suite spec §4.5): what the `ChangeSet` adapter keeps for each open change set, so
// `list()` gives the same files and tokens on every device that edits through one checkout. The Node adapter writes
// it as JSON in the checkout's git directory, never in the work tree, and reads it back through this schema.
import { z } from 'zod'

export const CHANGE_SET_JOURNAL_FORMAT = 'af-change-set/1'

export interface ChangeSetJournal {
  readonly format: typeof CHANGE_SET_JOURNAL_FORMAT
  readonly title: string
  readonly branch: string
  readonly base: string
  /** The files recorded, sorted. */
  readonly files: readonly string[]
  /** The files it created (a write expecting `'absent'`), sorted. */
  readonly created: readonly string[]
  readonly tokens: { readonly used: number; readonly cap: number }
}

const count = z.number().int().min(0)

export const changeSetJournalSchema: z.ZodType<ChangeSetJournal> = z.strictObject({
  format: z.literal(CHANGE_SET_JOURNAL_FORMAT),
  title: z.string().min(1),
  branch: z.string().min(1),
  base: z.string().min(1),
  files: z.array(z.string()),
  created: z.array(z.string()),
  tokens: z.strictObject({ used: count, cap: count }),
})
