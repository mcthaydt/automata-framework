// The game's editor list, `content/editors.toml`, format `af-editors/1` (editor suite spec §4.2, EDS-D6). The model
// is The Last Light's `editor.manifest.json` (92e6704) as TOML: file rows (glob, editor, modes, gates, checks), the
// game's checks and gates, and the generated and never globs. The game owner writes it; the suite only reads it and
// can never write it (workspace-policy.ts), so it cannot widen its own allowlist.
//
// Tables are strict: an unknown key is an error, so a misspelt `gate = [...]` cannot drop a row's gates. Cross-row
// rules (a row's check or gate is declared, ids are unique) are the loader's (editor-list.ts).
import { z } from 'zod'

/** Where a game keeps its editor list, relative to the game root. */
export const EDITOR_LIST_PATH = 'content/editors.toml'

/** The one format this suite reads (spec §4.2). */
export const EDITOR_LIST_FORMAT = 'af-editors/1'

/** `edit`: direct value and structure edits; `ask`: Claude may propose a diff. */
export type EditMode = 'edit' | 'ask'

/** One `[[file]]` row: the files its glob matches open in `editor`. The first matching row wins. */
export interface FileRow {
  readonly glob: string
  /** The `SuiteEditor` id, e.g. `tuner`; an id no installed editor provides is Home's "not installed" state. */
  readonly editor: string
  readonly modes: readonly EditMode[]
  /** The gates a change to these files reopens. Required, possibly empty (EDS-D7). */
  readonly gates: readonly string[]
  /** Check ids: `content` (built in) or a `[[check]]` id. */
  readonly checks: readonly string[]
}

/** One `[[check]]`: a game command, run as argv in the game checkout with no shell. */
export interface CheckRow {
  readonly id: string
  /** argv; `{scene}` and `{path}` are the only substitutions. */
  readonly run: readonly string[]
  /** `before`: runs on the candidate text and a failure refuses the write; `after`: runs on the written change set. */
  readonly when: 'before' | 'after'
  /** Generated files a passing run adds to the change set. */
  readonly joins: readonly string[]
  /** Whether its `--json` rows are a before-and-after measure (the Tuner's fairness). */
  readonly measure: boolean
}

/** One `[[gate]]`: shown, never recorded by an editor. */
export interface GateRow {
  readonly id: string
  readonly name: string
  /** Where its records are (read only); the record shape is the pipelines platform's. */
  readonly records: string
}

export interface EditorList {
  readonly format: typeof EDITOR_LIST_FORMAT
  /** The folder whose `{scene}` names the scene picker lists; absent for a game without scenes. */
  readonly scenes?: string | undefined
  readonly file: readonly FileRow[]
  readonly check: readonly CheckRow[]
  readonly gate: readonly GateRow[]
  readonly generated: readonly string[]
  readonly never: readonly string[]
}

/** The id of the check every file has: the touched file parses and its schema accepts it; always `before`. */
export const CONTENT_CHECK = 'content'

const placeholders = (text: string): string[] => text.match(/\{[^}]*\}/g) ?? []

/** A root-relative glob: not absolute, no `..` segment, at most one `{scene}` and no other placeholder. */
const globSchema = z
  .string()
  .min(1)
  .refine((glob) => !glob.startsWith('/') && !glob.split('/').includes('..'), {
    message: 'a glob stays inside the game root (no leading / and no .. segment)',
  })
  .refine(
    (glob) => {
      const found = placeholders(glob)
      return found.every((name) => name === '{scene}') && found.length <= 1
    },
    { message: 'a glob may name {scene} once, and no other placeholder' },
  )

const idSchema = z.string().min(1)

const argumentSchema = z
  .string()
  .min(1)
  .refine((argument) => placeholders(argument).every((name) => name === '{scene}' || name === '{path}'), {
    message: 'an argument may use only {scene} and {path}',
  })

const modesSchema = z
  .array(z.enum(['edit', 'ask']))
  .min(1)
  .refine((modes) => new Set(modes).size === modes.length, { message: 'each mode is listed once' })

const fileRowSchema: z.ZodType<FileRow> = z.strictObject({
  glob: globSchema,
  editor: idSchema,
  modes: modesSchema,
  gates: z.array(idSchema),
  checks: z.array(idSchema),
})

const checkRowSchema: z.ZodType<CheckRow> = z.strictObject({
  id: idSchema,
  run: z.array(argumentSchema).min(1),
  when: z.enum(['before', 'after']).default('after'),
  joins: z.array(globSchema).default([]),
  measure: z.boolean().default(false),
})

const gateRowSchema: z.ZodType<GateRow> = z.strictObject({
  id: idSchema,
  name: z.string().min(1),
  records: globSchema,
})

/** The shape of `af-editors/1`, one table at a time (cross-row rules are the loader's). */
export const editorListSchema: z.ZodType<EditorList> = z.strictObject({
  format: z.literal(EDITOR_LIST_FORMAT),
  scenes: globSchema.optional(),
  file: z.array(fileRowSchema).default([]),
  check: z.array(checkRowSchema).default([]),
  gate: z.array(gateRowSchema).default([]),
  generated: z.array(globSchema).default([]),
  never: z.array(globSchema).default([]),
})
