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
