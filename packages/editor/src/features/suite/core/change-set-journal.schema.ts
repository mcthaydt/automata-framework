// The change-set journal: what the `ChangeSet` adapter keeps for each open change set, so
// `list()` gives the same files, writes, checks and tokens on every device that edits through one checkout. The Node
// adapter writes it as JSON in the checkout's git directory, never in the work tree, and reads it back through this
// schema, which also reads an `af-change-set/1` journal as one with neither.

import { z } from 'zod'
import type { ChangeSetCheck, ChangeSetWrite } from '../../../shared/kit/ports/suite-ports.ts'

export const CHANGE_SET_JOURNAL_FORMAT = 'af-change-set/2'

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
  /** Each write in order, with its text. */
  readonly writes: readonly ChangeSetWrite[]
  /** The latest run of each check id, sorted by id. */
  readonly checks: readonly ChangeSetCheck[]
}

const count = z.number().int().min(0)

const header = {
  title: z.string().min(1),
  branch: z.string().min(1),
  base: z.string().min(1),
  files: z.array(z.string()),
  created: z.array(z.string()),
  tokens: z.strictObject({ used: count, cap: count }),
}

// JSON drops an `undefined` before text, so a created file's write comes back without the key; it is put back.
const write = z
  .strictObject({ path: z.string().min(1), before: z.string().optional(), after: z.string() })
  .transform(({ path, before, after }): ChangeSetWrite => ({ path, before, after }))

const finding = z.strictObject({
  path: z.string().optional(),
  keyPath: z.string().optional(),
  line: count.optional(),
  column: count.optional(),
  severity: z.enum(['error', 'warning']),
  message: z.string(),
})

const measure = z.strictObject({
  id: z.string(),
  label: z.string(),
  value: z.number(),
  threshold: z.number().optional(),
  ok: z.boolean(),
})

const check = z.strictObject({
  check: z.string().min(1),
  status: z.enum(['pass', 'warn', 'fail', 'error']),
  findings: z.array(finding),
  before: z.array(measure).optional(),
  after: z.array(measure).optional(),
})

const current = z.strictObject({
  format: z.literal(CHANGE_SET_JOURNAL_FORMAT),
  ...header,
  writes: z.array(write),
  checks: z.array(check),
})

/** `af-change-set/1` → `/2`: no writes or checks were kept. */
const version1 = z.strictObject({ format: z.literal('af-change-set/1'), ...header }).transform(
  (journal): ChangeSetJournal => ({
    ...journal,
    format: CHANGE_SET_JOURNAL_FORMAT,
    writes: [],
    checks: [],
  }),
)

export const changeSetJournalSchema: z.ZodType<ChangeSetJournal, unknown> = z.union([current, version1])
