// The rows each content editor needs in a game's editor list, in one place: starting a file in an editor adds them
// (`ensureListed`), and the editor server lets the list grow by exactly these rows and no others (`listGrowsBy`). The
// list is otherwise never written by an editor, so that an editor cannot widen its own access or add a command to a
// check (workspace-policy.ts `ALWAYS_NEVER`).

import type { SuiteWorkspace } from '../kit/ports/suite-ports.ts'
import type { WriteResult } from '../kit/storage/project-store.ts'
import { loadEditorList } from './editor-list.ts'
import { EDITOR_LIST_PATH, type FileRow } from './editors.schema.ts'

interface RowDef {
  readonly glob: string
  /** Check ids: the Tuner's and Schematic's files are checked for their content, the rest are not. */
  readonly checks: readonly string[]
}

/** What each editor edits, and the sentence the list says about it. */
const EDITORS: Readonly<Record<string, { readonly why: string; readonly rows: readonly RowDef[] }>> = {
  tuner: {
    why: 'The settings and the controls a game ships with, which the Tuner edits.',
    rows: [
      { glob: 'content/controls.toml', checks: ['content'] },
      { glob: 'content/tuning.toml', checks: ['content'] },
    ],
  },
  feel: {
    why: 'What the player feels when things happen (a flash, a shake, a pause), which Feel edits.',
    rows: [{ glob: 'content/feel/*.toml', checks: [] }],
  },
  audio: {
    why: 'The sounds, and the music a person puts in assets/music, which Audio edits.',
    rows: [
      { glob: 'content/audio/*.toml', checks: [] },
      { glob: 'assets/music/*', checks: [] },
    ],
  },
  writer: {
    why: 'The words people say and the conversations they are in, which Writer edits.',
    rows: [
      { glob: 'content/lines/*.toml', checks: [] },
      { glob: 'content/dialogue/*.toml', checks: [] },
    ],
  },
  sequence: {
    why: 'The scenes that play on their own, which Sequence edits.',
    rows: [{ glob: 'content/cutscenes/*.toml', checks: [] }],
  },
  schematic: {
    why: 'How characters think and where they go, which Schematic edits.',
    rows: [
      { glob: 'content/systems/*.toml', checks: ['content'] },
      { glob: 'content/nav/*.toml', checks: ['content'] },
      { glob: 'content/puzzles/*.toml', checks: ['content'] },
    ],
  },
}

const quoted = (items: readonly string[]): string => `[${items.map((item) => `"${item}"`).join(', ')}]`

const rowText = (id: string, row: RowDef): string =>
  `[[file]]\nglob = "${row.glob}"\neditor = "${id}"\nmodes = ["edit"]\ngates = []\nchecks = ${quoted(row.checks)}\n`

/** The TOML rows an editor needs in the list, with a comment above them, or `undefined` for an editor with none. */
export function editorRows(id: string): string | undefined {
  const editor = EDITORS[id]
  if (editor === undefined) return undefined
  return `# ${editor.why}\n${editor.rows.map((row) => rowText(id, row)).join('\n')}`
}

/** A row as one comparable string, every field the list knows. */
const key = (row: FileRow): string =>
  JSON.stringify([row.glob, row.editor, row.modes, row.gates, row.checks, row.exports ?? null])

const asRow = (id: string, row: RowDef): FileRow => ({
  glob: row.glob,
  editor: id,
  modes: ['edit'],
  gates: [],
  checks: row.checks,
})

/** Every row an editor may add, for `listGrowsBy`. */
const ALLOWED: ReadonlySet<string> = new Set(
  Object.entries(EDITORS).flatMap(([id, editor]) => editor.rows.map((row) => key(asRow(id, row)))),
)

/**
 * Whether `after` is `before` plus, at the end, rows that are exactly an editor's own rows. Every table of `before` is
 * in `after` unchanged and in order (format, scenes, each file row, check, gate, `never` and `generated`); a check, a
 * gate, a `never` or `generated` glob, or a row with any other glob or field, is not growth. Text that does not load is
 * not growth either.
 */
export function listGrowsBy(before: string, after: string): boolean {
  const old = loadEditorList(before)
  const next = loadEditorList(after)
  if (!old.ok || !next.ok) return false
  const a = old.list
  const b = next.list
  const same = (x: unknown, y: unknown): boolean => JSON.stringify(x) === JSON.stringify(y)
  if (a.format !== b.format || a.scenes !== b.scenes) return false
  if (!same(a.check, b.check) || !same(a.gate, b.gate)) return false
  if (!same(a.generated, b.generated) || !same(a.never, b.never)) return false
  if (b.file.length < a.file.length) return false
  if (!a.file.every((row, index) => key(row) === key(b.file[index] as FileRow))) return false
  return b.file.slice(a.file.length).every((row) => ALLOWED.has(key(row)))
}

const UNCHANGED = { ok: true, unchanged: true } as const

/**
 * Adds the editor's rows the game's list lacks, at the end, through `workspace`. A game with no list gets none (the
 * editors never start one), an editor with no rows adds nothing, and a list that does not read is left alone and
 * said so. Rows are compared by glob, so a glob the list already names (for any editor) is not added twice.
 */
export async function ensureListed(
  workspace: Pick<SuiteWorkspace, 'read' | 'write'>,
  id: string,
): Promise<WriteResult | typeof UNCHANGED> {
  const editor = EDITORS[id]
  if (editor === undefined) return UNCHANGED
  const file = await workspace.read(EDITOR_LIST_PATH)
  if (file === undefined) return UNCHANGED
  const load = loadEditorList(file.text)
  if (!load.ok)
    return {
      ok: false,
      reason: 'policy',
      message: "This game's list of editors can't be read, so the editor can't be added to it.",
    }
  const named = new Set(load.list.file.map((row) => row.glob))
  const missing = editor.rows.filter((row) => !named.has(row.glob))
  if (missing.length === 0) return UNCHANGED
  const body = `# ${editor.why}\n${missing.map((row) => rowText(id, row)).join('\n')}`
  const gap = file.text.endsWith('\n') ? '\n' : '\n\n'
  const text = `${file.text}${gap}${body}`
  if (!listGrowsBy(file.text, text))
    return {
      ok: false,
      reason: 'policy',
      message: "The editors can only add to this game's list of editors.",
    }
  return workspace.write(EDITOR_LIST_PATH, text, { mtime: file.mtime })
}
