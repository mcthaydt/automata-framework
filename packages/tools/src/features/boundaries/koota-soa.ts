import { type AstNode, staticMemberName } from './ast.ts'

// koota 0.6.6 picks a trait's storage from its schema (`createTrait` in its dist): a function is an
// array-of-structures factory, nothing or `{}` is a tag, and any other object is a struct-of-arrays schema whose
// accessors koota compiles with `new Function`. Ruken's CSP has no 'unsafe-eval', so creating that trait throws.
// `relation({ store })` hands its store to `trait`. AF's `defineComponent` passes a factory
// (packages/sim/src/define/definitions.ts), and the `no-eval` scan allowlists koota's generators for that reason,
// so a direct call is the one way a game reaches them.
//
// Only calls tied to koota by an import are checked: the names a `koota` value import binds to `trait` and
// `relation` (aliases included), and members of a namespace import. A sim imports only koota, zod, Rapier, the sim's
// entries and relative files, so another `trait` is the game's own. koota's `trait` passed around as a value or
// re-exported through a relative module is not followed; `automata check --csp` stays the backstop for those.
// Scopes are not tracked either: a parameter or local that shadows the imported name is still read as koota's, a
// rare false finding that renaming the local clears.

type KootaFunction = 'trait' | 'relation'

interface KootaBindings {
  /** Local name -> the koota function it is. */
  readonly functions: ReadonlyMap<string, KootaFunction>
  /** Local names of `import * as koota from 'koota'`. */
  readonly namespaces: ReadonlySet<string>
}

const asKootaFunction = (name: unknown): KootaFunction | undefined =>
  name === 'trait' || name === 'relation' ? name : undefined

/** The koota functions a module imports, from its top-level import declarations. */
export function kootaBindings(program: AstNode): KootaBindings {
  const functions = new Map<string, KootaFunction>()
  const namespaces = new Set<string>()
  for (const statement of program.body as AstNode[]) {
    if (statement.type !== 'ImportDeclaration' || statement.importKind === 'type') continue
    if ((statement.source as { value?: unknown }).value !== 'koota') continue
    for (const specifier of statement.specifiers as AstNode[]) {
      const local = (specifier.local as { name: string }).name
      if (specifier.type === 'ImportNamespaceSpecifier') namespaces.add(local)
      if (specifier.type !== 'ImportSpecifier' || specifier.importKind === 'type') continue
      // `import { trait }` names an identifier; `import { 'trait' as t }` a string literal.
      const imported = specifier.imported as { name?: string; value?: unknown }
      const kootaFunction = asKootaFunction(imported.name ?? imported.value)
      if (kootaFunction !== undefined) functions.set(local, kootaFunction)
    }
  }
  return { functions, namespaces }
}

/** Parentheses and type assertions do not change what koota receives, or which function is called. */
const TRANSPARENT = new Set([
  'ParenthesizedExpression',
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSTypeAssertion',
])
function unwrap(node: AstNode | undefined): AstNode | undefined {
  let inner = node
  while (inner !== undefined && TRANSPARENT.has(inner.type)) inner = inner.expression as AstNode
  return inner
}

/** The function a callee evaluates to: through parentheses, assertions and a sequence's last expression (`(0, f)`). */
function calleeTarget(callee: AstNode): AstNode {
  let inner = unwrap(callee) as AstNode
  while (inner.type === 'SequenceExpression') {
    const expressions = inner.expressions as AstNode[]
    inner = unwrap(expressions[expressions.length - 1]) as AstNode
  }
  return inner
}

function calledFunction(call: AstNode, bindings: KootaBindings): KootaFunction | undefined {
  const callee = calleeTarget(call.callee as AstNode) as AstNode & { name?: string }
  if (callee.type === 'Identifier') return bindings.functions.get(callee.name as string)
  if (callee.type !== 'MemberExpression') return undefined
  const object = unwrap(callee.object as AstNode) as AstNode & { name?: string }
  if (object.type !== 'Identifier' || !bindings.namespaces.has(object.name as string)) return undefined
  return asKootaFunction(staticMemberName(callee))
}

/** What a schema makes koota build, as far as the source shows: `unknown` when it is not written inline. */
function schemaKind(schema: AstNode | undefined): 'safe' | 'object' | 'unknown' {
  const inner = unwrap(schema)
  if (inner === undefined) return 'safe' // a tag
  if (inner.type === 'ArrowFunctionExpression' || inner.type === 'FunctionExpression') return 'safe'
  if (inner.type === 'ObjectExpression')
    return (inner.properties as unknown[]).length === 0 ? 'safe' : 'object'
  return 'unknown'
}

/** A property's name when it is known without running code: `store`, `'store'`, `['store']`. */
function propertyName(property: AstNode): string | undefined {
  const key = property.key as AstNode & { name?: string; value?: unknown }
  if (!property.computed && key.type === 'Identifier') return key.name
  return key.type === 'Literal' && typeof key.value === 'string' ? key.value : undefined
}

/** The store of a relation definition: `undefined` for none, `unknown` when the source does not show it. */
function relationStore(definition: AstNode): AstNode | undefined | 'unknown' {
  const inner = unwrap(definition)
  if (inner?.type !== 'ObjectExpression') return 'unknown'
  let store: AstNode | undefined
  for (const property of inner.properties as AstNode[]) {
    // A spread or a computed key may hold a store.
    const name = property.type === 'Property' ? propertyName(property) : undefined
    if (name === undefined) return 'unknown'
    if (name !== 'store') continue
    // koota reads `definition?.store`, which runs a getter; a method (`store() {}`) hands koota the function.
    if (property.kind !== 'init') return 'unknown'
    store = property.value as AstNode
  }
  return store
}

const CSP = "koota compiles accessors for it with new Function, which Ruken's CSP (no 'unsafe-eval') refuses"
const TRAIT_FIX =
  'use defineComponent from @automataframework/automata-sim, or pass koota a factory: trait(() => ({ ... }))'
const RELATION_FIX = 'pass a factory store: relation({ store: () => ({ ... }) })'
const MESSAGES = {
  trait: {
    object: `an object schema makes a struct-of-arrays trait: ${CSP}; ${TRAIT_FIX}`,
    unknown: `the checker cannot see that this trait schema is not an object (an object schema makes a struct-of-arrays trait: ${CSP}); ${TRAIT_FIX}`,
  },
  relation: {
    object: `an object store makes a struct-of-arrays relation: ${CSP}; ${RELATION_FIX}`,
    unknown: `the checker cannot see that this relation's store is not an object (an object store makes a struct-of-arrays relation: ${CSP}); write the definition inline and ${RELATION_FIX}`,
  },
} as const

/** The problem with a call to koota's `trait` or `relation`, if it makes koota generate code. */
export function kootaSoaProblem(
  call: AstNode,
  bindings: KootaBindings,
): { readonly node: AstNode; readonly message: string } | undefined {
  const kootaFunction = calledFunction(call, bindings)
  const [argument] = call.arguments as AstNode[]
  // No argument: `trait()` is a tag and `relation()` has no store.
  if (kootaFunction === undefined || argument === undefined) return undefined
  if (kootaFunction === 'trait') {
    const kind = schemaKind(argument)
    return kind === 'safe' ? undefined : { node: argument, message: MESSAGES.trait[kind] }
  }
  const store = relationStore(argument)
  if (store === 'unknown') return { node: argument, message: MESSAGES.relation.unknown }
  const kind = schemaKind(store)
  return store === undefined || kind === 'safe'
    ? undefined
    : { node: store, message: MESSAGES.relation[kind] }
}
