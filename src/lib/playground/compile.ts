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

export type CompileResult = { readonly ok: true; readonly code: string } | { readonly ok: false; readonly diagnostics: readonly Diagnostic[] }

/** The function the frame defines and every loop body calls first (the protocol's LOOP_GUARD_NAME). */
const LOOP_GUARD = '__afLoop'
const ALLOWED_IMPORTS: ReadonlySet<string> = new Set(['@mcthaydt/automata', 'zod'])
const IMPORT_MESSAGE = 'The playground can import only @mcthaydt/automata and zod.'
const LOOPS: ReadonlySet<string> = new Set(['ForStatement', 'ForInStatement', 'ForOfStatement', 'WhileStatement', 'DoWhileStatement'])

interface Position { readonly line: number; readonly column: number }
interface Node {
  readonly type: string
  readonly start: number
  readonly end: number
  readonly loc: { readonly start: Position }
  readonly [key: string]: unknown
}
interface Edit { readonly at: number; readonly text: string; readonly removeTo?: number }

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string'

/** Every node of the tree, parents before children. */
function* walk(node: Node): Generator<Node> {
  yield node
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'leadingComments' || key === 'trailingComments' || key === 'innerComments') continue
    const value = node[key]
    if (Array.isArray(value)) for (const child of value) { if (isNode(child)) yield* walk(child) }
    else if (isNode(value)) yield* walk(value)
  }
}

const at = (node: Node): Diagnostic => ({ line: node.loc.start.line, column: node.loc.start.column + 1, message: IMPORT_MESSAGE })

/** The source with its edits applied, last first, so earlier offsets stay right. */
function applyEdits(source: string, edits: readonly Edit[]): string {
  let out = source
  for (const edit of [...edits].sort((a, b) => b.at - a.at)) out = out.slice(0, edit.at) + edit.text + out.slice(edit.removeTo ?? edit.at)
  return out
}

function isImportMetaUrl(node: Node): boolean {
  if (node.type !== 'MemberExpression' || node.computed) return false
  const object = node.object as Node | undefined
  const property = node.property as (Node & { name?: string }) | undefined
  const meta = object?.meta as { name?: string } | undefined
  const metaProperty = object?.property as { name?: string } | undefined
  return object?.type === 'MetaProperty' && meta?.name === 'import' && metaProperty?.name === 'meta' && property?.type === 'Identifier' && property.name === 'url'
}

/** Compiles the reader's example: the module text the frame imports, or what is wrong and where. */
export function compileExample(source: string, example: { readonly id: string; readonly moduleUrl: string }): CompileResult {
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
    if (node.type === 'ImportDeclaration' || ((node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') && node.source)) {
      const from = (node.source as { value?: unknown } | null)?.value
      if (typeof from !== 'string' || !ALLOWED_IMPORTS.has(from)) diagnostics.push(at(node))
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
    const { code } = transform(applyEdits(source, edits), { transforms: ['typescript'], disableESTransforms: true, filePath: file })
    return { ok: true, code: `${code}\n//# sourceURL=${file}` }
  } catch (error) {
    const loc = (error as { loc?: Position }).loc
    return { ok: false, diagnostics: [{ line: loc?.line ?? 1, column: (loc?.column ?? 0) + 1, message: String((error as Error).message ?? error) }] }
  }
}
