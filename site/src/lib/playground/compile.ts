import { parse } from '@babel/parser'
import { transform } from 'sucrase'

// The playground's compile step (spec §5.2), a pure function the compile worker wraps. Babel parses the reader's
// TypeScript, because it places a syntax error inside an arrow function at its own line where sucrase's parser names
// the function's first line; the same tree gives the import check, the loop guards and the import.meta.url rewrite,
// applied as text edits that add no newline; sucrase then strips the types and keeps every line where it was, so a
// runtime error's line is the reader's.

/** Where a problem is, 1-based, in the reader's source. */
export interface Diagnostic {
  readonly line: number
  readonly column: number
  readonly message: string
}

export type CompileResult =
  | { readonly ok: true; readonly code: string }
  | { readonly ok: false; readonly diagnostics: readonly Diagnostic[] }

/** The function the frame defines and every loop body calls first (the protocol's LOOP_GUARD_NAME). */
const LOOP_GUARD = '__afLoop'
const ALLOWED_IMPORTS: ReadonlySet<string> = new Set(['@mcthaydt/automata', 'zod'])
const IMPORT_MESSAGE = 'The playground can import only @mcthaydt/automata and zod.'
// sucrase drops a namespace's body and turns `export =` into CommonJS, so either would run as something else.
const NAMESPACE_MESSAGE = 'The playground does not run namespaces; use a module-level object instead.'
const EXPORT_ASSIGNMENT_MESSAGE = 'The playground runs ES modules; use export default instead of export =.'
const LOOPS: ReadonlySet<string> = new Set([
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
])

interface Position {
  readonly line: number
  readonly column: number
}
interface Node {
  readonly type: string
  readonly start: number
  readonly end: number
  readonly loc: { readonly start: Position }
  readonly [key: string]: unknown
}
export interface Edit {
  readonly at: number
  readonly text: string
  readonly removeTo?: number
}

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string'

/** Every node of the tree, parents before children. */
function* walk(node: Node): Generator<Node> {
  yield node
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'leadingComments' || key === 'trailingComments' || key === 'innerComments')
      continue
    const value = node[key]
    if (Array.isArray(value))
      for (const child of value) {
        if (isNode(child)) yield* walk(child)
      }
    else if (isNode(value)) yield* walk(value)
  }
}

const at = (node: Node, message = IMPORT_MESSAGE): Diagnostic => ({
  line: node.loc.start.line,
  column: node.loc.start.column + 1,
  message,
})

const removes = (edit: Edit): boolean => edit.removeTo !== undefined

/**
 * The source with its edits applied, last first, so earlier offsets stay right. At one offset a replacement goes
 * before an insertion: the insertion then lands in front of the replaced text, where a loop guard belongs, instead of
 * being cut away with it (`while (x) import.meta.url`).
 */
function applyEdits(source: string, edits: readonly Edit[]): string {
  let out = source
  const ordered = [...edits].sort((a, b) => b.at - a.at || Number(removes(b)) - Number(removes(a)))
  for (const edit of ordered) out = out.slice(0, edit.at) + edit.text + out.slice(edit.removeTo ?? edit.at)
  return out
}

/** The reader's offset for an offset in the edited text; one inside inserted text maps to where it was inserted. */
function sourceOffset(edits: readonly Edit[], editedOffset: number): number {
  let shift = 0
  for (const edit of [...edits].sort((a, b) => a.at - b.at)) {
    const editedAt = edit.at + shift
    if (editedOffset < editedAt) break
    if (editedOffset < editedAt + edit.text.length) return edit.at
    shift += edit.text.length - ((edit.removeTo ?? edit.at) - edit.at)
  }
  return editedOffset - shift
}

/**
 * A sucrase failure as a diagnostic in the reader's source: its "Error transforming <file>:" prefix and "(l:c)"
 * suffix removed, and its offset (`pos`, in the edited text) mapped back past the inserted guards.
 */
export function sucraseDiagnostic(source: string, edits: readonly Edit[], error: unknown): Diagnostic {
  const message = String((error as Error).message ?? error)
    .replace(/^Error transforming [^:]*:\s*/, '')
    .replace(/\s*\(\d+:\d+\)$/, '')
  const pos = (error as { pos?: unknown }).pos
  if (typeof pos !== 'number') return { line: 1, column: 1, message }
  const before = source.slice(0, sourceOffset(edits, pos)).split('\n')
  return { line: before.length, column: before.at(-1)!.length + 1, message }
}

function isImportMetaUrl(node: Node): boolean {
  if (node.type !== 'MemberExpression' || node.computed) return false
  const object = node.object as Node | undefined
  const property = node.property as (Node & { name?: string }) | undefined
  const meta = object?.meta as { name?: string } | undefined
  const metaProperty = object?.property as { name?: string } | undefined
  return (
    object?.type === 'MetaProperty' &&
    meta?.name === 'import' &&
    metaProperty?.name === 'meta' &&
    property?.type === 'Identifier' &&
    property.name === 'url'
  )
}

/** Compiles the reader's example: the module text the frame imports, or what is wrong and where. */
export function compileExample(
  source: string,
  example: { readonly id: string; readonly moduleUrl: string },
): CompileResult {
  let program: Node
  try {
    program = parse(source, { sourceType: 'module', plugins: ['typescript'] }).program as unknown as Node
  } catch (error) {
    const loc = (error as { loc?: Position }).loc
    const message = String((error as Error).message ?? error).replace(/\s*\(\d+:\d+\)$/, '')
    return { ok: false, diagnostics: [{ line: loc?.line ?? 1, column: (loc?.column ?? 0) + 1, message }] }
  }

  const diagnostics: Diagnostic[] = []
  const edits: Edit[] = []
  for (const node of walk(program)) {
    if (
      node.type === 'ImportDeclaration' ||
      ((node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') && node.source)
    ) {
      const from = (node.source as { value?: unknown } | null)?.value
      if (typeof from !== 'string' || !ALLOWED_IMPORTS.has(from)) diagnostics.push(at(node))
    } else if (
      node.type === 'TSImportEqualsDeclaration' &&
      (node.moduleReference as Node).type === 'TSExternalModuleReference'
    ) {
      diagnostics.push(at(node))
    } else if (
      node.type === 'TSModuleDeclaration' &&
      !node.declare &&
      (node.id as Node).type !== 'StringLiteral'
    ) {
      diagnostics.push(at(node, NAMESPACE_MESSAGE))
    } else if (node.type === 'TSExportAssignment') {
      diagnostics.push(at(node, EXPORT_ASSIGNMENT_MESSAGE))
    } else if (LOOPS.has(node.type)) {
      const body = node.body as Node
      const guard = `${LOOP_GUARD}(${node.loc.start.line});`
      if (body.type === 'BlockStatement') edits.push({ at: body.start + 1, text: guard })
      else edits.push({ at: body.start, text: `{${guard}` }, { at: body.end, text: '}' })
    } else if (isImportMetaUrl(node)) {
      edits.push({ at: node.start, removeTo: node.end, text: JSON.stringify(example.moduleUrl) })
    }
  }
  if (diagnostics.length > 0) return { ok: false, diagnostics }

  const file = new URL(example.moduleUrl).pathname.replace(/^\/playground\//, '')
  try {
    const { code } = transform(applyEdits(source, edits), {
      transforms: ['typescript'],
      disableESTransforms: true,
      filePath: file,
    })
    return { ok: true, code: `${code}\n//# sourceURL=${file}` }
  } catch (error) {
    return { ok: false, diagnostics: [sucraseDiagnostic(source, edits, error)] }
  }
}
