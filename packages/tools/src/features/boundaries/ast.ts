// The parts of oxc-parser's ESTree AST the rules share. Nodes are read as plain objects: the checker walks every key.

export type AstNode = { type: string; start: number; [k: string]: unknown }

export const isNode = (v: unknown): v is AstNode =>
  typeof v === 'object' && v !== null && typeof (v as { type?: unknown }).type === 'string'

/**
 * The name a member expression reads, when it is known without running code: `a.b`, `a['b']` and
 * a template literal with no substitutions. Returns undefined for any other computed key.
 */
export function staticMemberName(node: AstNode): string | undefined {
  const prop = node.property as AstNode & { name?: string; value?: unknown; expressions?: unknown[] }
  if (!node.computed) return prop.name
  if (prop.type === 'Literal' && typeof prop.value === 'string') return prop.value
  if (prop.type === 'TemplateLiteral' && prop.expressions?.length === 0) {
    const quasi = (prop.quasis as { value: { cooked: string | null } }[])[0]
    return quasi?.value.cooked ?? undefined
  }
  return undefined
}

/** Keys whose subtree is type-only: skipped entirely. */
export const TYPE_KEYS: ReadonlySet<string> = new Set([
  'typeAnnotation',
  'returnType',
  'typeParameters',
  'typeArguments',
  'superTypeArguments',
  'implements',
])
export const TYPE_NODES: ReadonlySet<string> = new Set([
  'TSInterfaceDeclaration',
  'TSTypeAliasDeclaration',
  'TSDeclareFunction',
])
/** Identifier positions that name something rather than reference it. */
const BINDING_KEYS = new Set(['id', 'params', 'local', 'imported', 'exported', 'label'])

/** Whether an identifier at `key` of `parent` reads a variable (rather than declaring or naming one). */
export function isReference(key: string, parent: AstNode | null): boolean {
  if (!parent) return true
  if (BINDING_KEYS.has(key)) return false
  if (parent.type === 'CatchClause' && key === 'param') return false
  if (key === 'property' && parent.type === 'MemberExpression' && !parent.computed) return false
  if (key === 'key' && !parent.computed) return false // object/class property and method names
  return true
}

/** A node's value-level children with the key each hangs from; type-only subtrees are left out. */
export function childrenOf(node: AstNode): [string, AstNode][] {
  const found: [string, AstNode][] = []
  for (const [k, v] of Object.entries(node)) {
    if (k === 'type' || TYPE_KEYS.has(k)) continue
    if (Array.isArray(v)) {
      for (const child of v) if (isNode(child)) found.push([k, child])
    } else if (isNode(v)) found.push([k, v])
  }
  return found
}

/** Turns an offset in `code` into a 1-based line and column (binary search over the line starts). */
export function lineLocator(code: string): (offset: number) => { line: number; col: number } {
  const lineStarts = [0]
  for (let i = 0; i < code.length; i++) if (code[i] === '\n') lineStarts.push(i + 1)
  return (offset) => {
    let lo = 0
    let hi = lineStarts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if ((lineStarts[mid] as number) <= offset) lo = mid
      else hi = mid - 1
    }
    return { line: lo + 1, col: offset - (lineStarts[lo] as number) + 1 }
  }
}
