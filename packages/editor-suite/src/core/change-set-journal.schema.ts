// The change-set journal (editor suite spec §4.5): what the `ChangeSet` adapter keeps for each open change set, so
// `list()` gives the same files and tokens on every device that edits through one checkout. The Node adapter writes
// it as JSON in the checkout's git directory, never in the work tree, and reads it back through this schema.
import { z } from 'zod'

export const CHANGE_SET_JOURNAL_FORMAT = 'af-change-set/1'

const count = z.number().int().min(0)

export const changeSetJournalSchema = z.strictObject({
  format: z.literal(CHANGE_SET_JOURNAL_FORMAT),
  title: z.string().min(1),
  branch: z.string().min(1),
  base: z.string().min(1),
  /** The files recorded, sorted. */
  files: z.array(z.string()),
  /** The files it created (a write expecting `'absent'`), sorted. */
  created: z.array(z.string()),
  tokens: z.strictObject({ used: count, cap: count }),
})

export type ChangeSetJournal = z.infer<typeof changeSetJournalSchema>
