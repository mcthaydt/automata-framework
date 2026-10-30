// Loading the game's editor list (editor suite spec §4.2, §11). The loader never throws: a missing, unreadable,
// invalid or newer list is a value Home shows with its key path, and while it stands every editor is read only.
import { parse, TomlError } from 'smol-toml'
import {
  CONTENT_CHECK,
  EDITOR_LIST_FORMAT,
  EDITOR_LIST_PATH,
  type EditorList,
  editorListSchema,
} from './editors.schema'

export interface EditorListProblem {
  /** `missing`: no file; `syntax`: not TOML; `invalid`: not `af-editors/1`; `newer-format`: a later major. */
  readonly kind: 'missing' | 'syntax' | 'invalid' | 'newer-format'
  /** Where in the list: `['file', 0, 'gates']`; empty for the whole file. */
  readonly keyPath: readonly (string | number)[]
  readonly message: string
  /** For a syntax error, 1-based. */
  readonly line?: number
  readonly column?: number
  /** For `newer-format`, the format the file names. */
  readonly format?: string
}

export type EditorListLoad =
  | { readonly ok: true; readonly list: EditorList }
  | { readonly ok: false; readonly problems: readonly EditorListProblem[] }

const FORMAT = /^af-editors\/(\d+)$/
const CURRENT_MAJOR = 1

const failed = (...problems: EditorListProblem[]): EditorListLoad => ({ ok: false, problems })

const invalid = (keyPath: readonly (string | number)[], message: string): EditorListProblem => ({
  kind: 'invalid',
  keyPath,
  message,
})

/** A later major version is its own state (Home names the format found), not a pile of schema errors. */
function newerFormat(raw: Record<string, unknown>): EditorListProblem | undefined {
  const format = raw.format
  if (typeof format !== 'string') return undefined
  const major = FORMAT.exec(format)?.[1]
  if (major === undefined || Number(major) <= CURRENT_MAJOR) return undefined
  return {
    kind: 'newer-format',
    keyPath: ['format'],
    format,
    message: `${EDITOR_LIST_PATH} is ${format}; this suite reads ${EDITOR_LIST_FORMAT}`,
  }
}

/** Rules across rows: ids are unique, `content` is built in, and every check and gate a row names is declared. */
function crossRowProblems(list: EditorList): EditorListProblem[] {
  const problems: EditorListProblem[] = []
  const checks = new Set<string>([CONTENT_CHECK])
  list.check.forEach((check, index) => {
    if (check.id === CONTENT_CHECK) {
      problems.push(
        invalid(['check', index, 'id'], `"${CONTENT_CHECK}" is the built-in check and is not declared`),
      )
    } else if (checks.has(check.id)) {
      problems.push(invalid(['check', index, 'id'], `check "${check.id}" is declared twice`))
    }
    checks.add(check.id)
  })
  const gates = new Set<string>()
  list.gate.forEach((gate, index) => {
    if (gates.has(gate.id))
      problems.push(invalid(['gate', index, 'id'], `gate "${gate.id}" is declared twice`))
    gates.add(gate.id)
  })
  list.file.forEach((row, rowIndex) => {
    row.checks.forEach((id, index) => {
      if (!checks.has(id)) {
        problems.push(
          invalid(['file', rowIndex, 'checks', index], `check "${id}" is not declared in [[check]]`),
        )
      }
    })
    row.gates.forEach((id, index) => {
      if (!gates.has(id)) {
        problems.push(invalid(['file', rowIndex, 'gates', index], `gate "${id}" is not declared in [[gate]]`))
      }
    })
  })
  return problems
}

/** Reads `content/editors.toml`'s text (undefined when the file is absent) as an editor list or its problems. */
export function loadEditorList(text: string | undefined): EditorListLoad {
  if (text === undefined) {
    return failed({ kind: 'missing', keyPath: [], message: `${EDITOR_LIST_PATH} is missing` })
  }
  let raw: Record<string, unknown>
  try {
    raw = parse(text)
  } catch (error) {
    if (!(error instanceof TomlError)) throw error
    return failed({
      kind: 'syntax',
      keyPath: [],
      message: error.message,
      line: error.line,
      column: error.column,
    })
  }
  const newer = newerFormat(raw)
  if (newer !== undefined) return failed(newer)
  // A key a row must have and does not is the commonest mistake; it reads "gates is missing", not Zod's type message.
  const result = editorListSchema.safeParse(raw, {
    error: (issue) =>
      issue.code === 'invalid_type' && issue.input === undefined
        ? `${String(issue.path?.at(-1) ?? 'a key')} is missing`
        : undefined,
  })
  if (!result.success) {
    return failed(
      ...result.error.issues.map((issue) =>
        invalid(
          issue.path.filter((key): key is string | number => typeof key !== 'symbol'),
          issue.message,
        ),
      ),
    )
  }
  const problems = crossRowProblems(result.data)
  return problems.length > 0 ? failed(...problems) : { ok: true, list: result.data }
}
