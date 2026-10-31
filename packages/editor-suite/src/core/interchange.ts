// scene-interchange v2 for AF (editor suite spec §4.8, EDS-D15): the open scene's listed files (or the whole game
// without scenes) as one document of values, grouped editor → path → the file's parsed value, and the way back in.
//
// Export reads each file's value through the content documents and prints the document with sorted keys and no
// clock, so the same files always print the same bytes. Import never reprints a file: it builds a plan of value edits
// on each file's current document (a leaf `set`, a new key `insert`, a dropped key `remove`, a changed array `set`
// whole), so comments and layout survive; a path that does not exist yet is created from its value. The plan names
// each change's diff, gates and checks and what it refuses and why; Apply writes it through the write path as one
// undo step, with each file's mtime from the plan, so a file that moved on since refuses the whole apply.
//
// Provenance is not written (decision 2 of the EDS.2c plan): every value's file and key path is its place in
// `sections`. Plain TypeScript: no DOM, no clock.
import { type ContentEdit, type KeyPath, openDocument } from '@mcthaydt/automata-editor-kit/documents'
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml'
import { z } from 'zod'
import type { EditorList } from './editors.schema'
import { type Hunk, lineDiff } from './text-diff'
import { fileAccess } from './workspace-policy'
import type { WriteOutcome, WritePath } from './write-path'

export const INTERCHANGE_FORMAT = 'scene-interchange'
export const INTERCHANGE_VERSION = 2

export interface InterchangeDocument {
  readonly format: typeof INTERCHANGE_FORMAT
  readonly version: typeof INTERCHANGE_VERSION
  readonly scene?: string | undefined
  readonly source: { readonly commit?: string | undefined }
  /** Editor id → workspace path → the file's value. */
  readonly sections: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  /** JSON pointer into `sections` → where it is written; read and ignored (every value's place is its section path). */
  readonly provenance?:
    | Readonly<Record<string, { readonly path: string; readonly keyPath: KeyPath }>>
    | undefined
}

export const interchangeSchema: z.ZodType<InterchangeDocument, unknown> = z.object({
  format: z.literal(INTERCHANGE_FORMAT),
  version: z.literal(INTERCHANGE_VERSION),
  scene: z.string().min(1).optional(),
  source: z.object({ commit: z.string().min(1).optional() }),
  sections: z.record(z.string().min(1), z.record(z.string().min(1), z.unknown())),
  provenance: z
    .record(z.string(), z.object({ path: z.string(), keyPath: z.array(z.union([z.string(), z.number()])) }))
    .optional(),
})

/** A plain table: not an array, and not a TOML date (an object of another prototype). */
const isTable = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value))

/** A copy with every table's keys in sorted order, so printing is deterministic. */
function sortedValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedValue)
  if (!isTable(value)) return value
  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(value).sort()) sorted[key] = sortedValue(value[key])
  return sorted
}

const print = (value: unknown, format: 'toml' | 'json'): string =>
  format === 'json'
    ? `${JSON.stringify(sortedValue(value), null, 2)}\n`
    : `${stringifyToml(sortedValue(value) as Record<string, unknown>).trimEnd()}\n`

export interface ExportFile {
  readonly path: string
  /** The editor its row names. */
  readonly editor: string
  readonly text: string
}

/** The interchange document of `files`, printed as TOML or JSON. Throws when a file does not parse. */
export function exportInterchange(
  files: readonly ExportFile[],
  options: { readonly format: 'toml' | 'json'; readonly scene?: string; readonly commit?: string },
): string {
  const sections: Record<string, Record<string, unknown>> = {}
  for (const file of files) {
    const section = sections[file.editor] ?? {}
    section[file.path] = openDocument(file.path, file.text).value()
    sections[file.editor] = section
  }
  const interchange: InterchangeDocument = {
    format: INTERCHANGE_FORMAT,
    version: INTERCHANGE_VERSION,
    ...(options.scene === undefined ? {} : { scene: options.scene }),
    source: options.commit === undefined ? {} : { commit: options.commit },
    sections,
  }
  return print(interchange, options.format)
}

export interface PlannedChange {
  readonly path: string
  readonly editor: string
  /** The file's text now; `undefined` for a file the import creates. */
  readonly before?: string | undefined
  readonly after: string
  /** What Apply expects the file to be: its mtime when planned, or absent. */
  readonly expected: { readonly mtime: number } | 'absent'
  readonly hunks: readonly Hunk[]
  /** The gates its row reopens (empty: "No gates"). */
  readonly gates: readonly string[]
  /** The checks its row runs. */
  readonly checks: readonly string[]
}

export interface PlanRefusal {
  readonly editor: string
  /** Absent when the whole section is refused. */
  readonly path?: string | undefined
  readonly reason: 'not-installed' | 'unlisted' | 'read-only' | 'editor-mismatch' | 'locked' | 'unwritable'
  readonly why: string
}

export type ImportPlan =
  | { readonly error: string }
  | {
      readonly changes: readonly PlannedChange[]
      readonly refused: readonly PlanRefusal[]
      /** Changes to write, and nothing refused but sections of editors not installed (decision 1). */
      readonly applicable: boolean
    }

export interface PlanImportOptions {
  readonly list: EditorList
  readonly read: (path: string) => Promise<{ readonly text: string; readonly mtime: number } | undefined>
  /** The editor ids this build has. */
  readonly installed: readonly string[]
  /** The package that brings an editor, named when it is not installed. */
  readonly provider?: ((editor: string) => string | undefined) | undefined
  /** The dotted keys the person locked in a file this session (EDS-D18). */
  readonly locked: (path: string) => readonly string[]
}

const same = (a: unknown, b: unknown): boolean =>
  JSON.stringify(sortedValue(a)) === JSON.stringify(sortedValue(b))

/** The value edits that turn `was` into `now`; tables are walked key by key, anything else is set whole. */
function editsBetween(was: unknown, now: unknown, keyPath: KeyPath, edits: ContentEdit[]): void {
  if (isTable(was) && isTable(now)) {
    for (const key of Object.keys(was))
      if (!(key in now)) edits.push({ keyPath: [...keyPath, key], remove: true })
    for (const key of Object.keys(now)) {
      if (key in was) editsBetween(was[key], now[key], [...keyPath, key], edits)
      else edits.push({ keyPath: [...keyPath, key], insert: now[key] })
    }
    return
  }
  if (!same(was, now)) edits.push({ keyPath, expected: was, set: now })
}

const keyValue = (value: unknown, key: string): unknown => {
  let current = value
  for (const part of key.split('.')) current = isTable(current) ? current[part] : undefined
  return current
}

function parseInterchange(text: string): InterchangeDocument | string {
  let value: unknown
  try {
    value = text.trimStart().startsWith('{') ? JSON.parse(text) : parseToml(text)
  } catch (error) {
    return `The text does not parse: ${error instanceof Error ? error.message : String(error)}`
  }
  const head = isTable(value) ? value : {}
  if (head.format !== INTERCHANGE_FORMAT) return `Not scene-interchange (format ${String(head.format)})`
  if (head.version !== INTERCHANGE_VERSION)
    return `scene-interchange version ${String(head.version)} is not supported; this suite reads version 2`
  const parsed = interchangeSchema.safeParse(value)
  if (!parsed.success)
    return `The text does not match scene-interchange v2: ${parsed.error.issues[0]?.message}`
  return parsed.data
}

type FilePlan = { change?: PlannedChange; refusal?: PlanRefusal }

async function planFile(
  editor: string,
  path: string,
  value: unknown,
  options: PlanImportOptions,
): Promise<FilePlan> {
  const refuse = (reason: PlanRefusal['reason'], why: string): FilePlan => ({
    refusal: { editor, path, reason, why },
  })
  const access = fileAccess(options.list, path)
  if (!access.writable)
    return access.reason === 'unlisted' || access.reason === 'outside'
      ? refuse('unlisted', access.why)
      : refuse('read-only', access.why)
  if (access.row.editor !== editor)
    return refuse('editor-mismatch', `${path} opens in ${access.row.editor}, not ${editor}`)

  const current = await options.read(path)
  let after: string
  if (current === undefined) {
    after = print(value, path.endsWith('.json') ? 'json' : 'toml')
  } else {
    try {
      const content = openDocument(path, current.text)
      const was = content.value()
      const lock = options.locked(path).find((key) => !same(keyValue(was, key), keyValue(value, key)))
      if (lock !== undefined) return refuse('locked', `${lock} is locked in this session`)
      const edits: ContentEdit[] = []
      editsBetween(was, value, [], edits)
      if (edits.length === 0) return {}
      const result = content.edit(edits)
      if (!result.ok) return refuse('unwritable', `${result.keyPath.join('.')}: ${result.message}`)
      const { document: edited } = result
      after = edited.text
    } catch (error) {
      return refuse('unwritable', error instanceof Error ? error.message : String(error))
    }
  }
  return {
    change: {
      path,
      editor,
      before: current?.text,
      after,
      expected: current === undefined ? 'absent' : { mtime: current.mtime },
      hunks: lineDiff(current?.text ?? '', after),
      gates: access.row.gates,
      checks: access.row.checks,
    },
  }
}

/** The plan for an interchange document: what it would write, what it refuses and whether Apply is enabled. */
export async function planImport(text: string, options: PlanImportOptions): Promise<ImportPlan> {
  const interchange = parseInterchange(text)
  if (typeof interchange === 'string') return { error: interchange }
  const changes: PlannedChange[] = []
  const refused: PlanRefusal[] = []
  for (const editor of Object.keys(interchange.sections).sort()) {
    if (!options.installed.includes(editor)) {
      const provider = options.provider?.(editor)
      const why = provider === undefined ? 'editor not installed' : `editor not installed (${provider})`
      refused.push({ editor, reason: 'not-installed', why })
      continue
    }
    const section = interchange.sections[editor] ?? {}
    for (const path of Object.keys(section).sort()) {
      const { change, refusal } = await planFile(editor, path, section[path], options)
      if (change !== undefined) changes.push(change)
      if (refusal !== undefined) refused.push(refusal)
    }
  }
  const blocking = refused.some((refusal) => refusal.reason !== 'not-installed')
  return { changes, refused, applicable: changes.length > 0 && !blocking }
}

/** Writes an applicable plan as one undo step labelled "Import"; a plan that cannot apply writes nothing. */
export async function applyImport(
  plan: ImportPlan,
  writePath: WritePath,
): Promise<WriteOutcome | { readonly refused: 'plan' }> {
  if ('error' in plan || !plan.applicable) return { refused: 'plan' }
  return writePath.writeAll(
    plan.changes.map(({ path, after, expected }) => ({ path, text: after, expected })),
    'Import',
  )
}
