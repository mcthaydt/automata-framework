import { posix } from 'node:path'
import { parseSync } from 'oxc-parser'

// The boundary rules of the 2D editor spec §4 over a map of path (relative to `src/`) to source. `pnpm boundaries`
// covers only the sim, whose rules are much stricter, so this package carries its own. It works on the AST, so a word in
// a comment, a string, a property name or a type never counts.

export type Rule =
  | 'pure-imports'
  | 'pure-globals'
  | 'profiles-from-app-only'
  | 'profile-isolation'
  | 'no-profile-ids'
  | 'import-cycle'
  | 'unresolved-import'
  | 'parse-error'

export interface Violation {
  readonly file: string
  readonly rule: Rule
  readonly message: string
}

/** `model/` and `tiles/` are the headless core: they run in Node, in a worker or in a test, with no host. */
const PURE_AREAS: ReadonlySet<string> = new Set(['model', 'tiles'])
/** The only packages the core may import: the schema language and the kit's field rules (not the Svelte shell). */
const PURE_PACKAGES: ReadonlySet<string> = new Set(['zod', '@mcthaydt/automata-editor-kit/fields'])
/** Where nothing may name a profile or a template: each of these works for every profile (G-s). */
const GENERIC_AREAS: ReadonlySet<string> = new Set(['app', 'tiles', 'canvas'])
const PROFILE_AND_TEMPLATE_IDS: ReadonlySet<string> = new Set([
  'level-project',
  'floorfifty-stage',
  'platformer',
  'topdown-rpg',
  'blank',
])
/** The one file that may import a profile: the registration list. */
const REGISTRATION_FILE = 'app/profiles.ts'

/** The DOM, the wall clock, timers and entropy: what makes a core depend on where it runs. */
const BANNED_GLOBALS: ReadonlySet<string> = new Set([
  'window',
  'self',
  'document',
  'navigator',
  'location',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'Worker',
  'crypto',
  'Date',
  'performance',
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval',
  'queueMicrotask',
])

// Keys whose subtree is type-only, and declarations that are only types: skipped, so `type Stamp = Date` is fine.
const TYPE_KEYS: ReadonlySet<string> = new Set([
  'typeAnnotation',
  'returnType',
  'typeParameters',
  'typeArguments',
  'superTypeArguments',
  'implements',
])
const TYPE_NODES: ReadonlySet<string> = new Set([
  'TSInterfaceDeclaration',
  'TSTypeAliasDeclaration',
  'TSDeclareFunction',
])
// Identifier positions that name something rather than refer to it.
const BINDING_KEYS: ReadonlySet<string> = new Set(['id', 'params', 'local', 'imported', 'exported', 'label'])

interface Node {
  readonly type: string
  readonly [key: string]: unknown
}
const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string'

function isReference(key: string, parent: Node | null): boolean {
  if (parent === null) return true
  if (BINDING_KEYS.has(key)) return false
  if (parent.type === 'CatchClause' && key === 'param') return false
  if (key === 'property' && parent.type === 'MemberExpression' && parent.computed !== true) return false
  if (key === 'key' && parent.computed !== true) return false
  return true
}

function walk(
  node: Node,
  parent: Node | null,
  key: string,
  visit: (node: Node, parent: Node | null, key: string) => void,
): void {
  if (TYPE_NODES.has(node.type)) return
  visit(node, parent, key)
  for (const [childKey, child] of Object.entries(node)) {
    if (TYPE_KEYS.has(childKey)) continue
    if (Array.isArray(child)) {
      for (const item of child) if (isNode(item)) walk(item, node, childKey, visit)
    } else if (isNode(child)) {
      walk(child, node, childKey, visit)
    }
  }
}

interface Facts {
  /** Every module this file imports or re-exports; `typeOnly` when erased at build time. */
  readonly imports: readonly { readonly specifier: string; readonly typeOnly: boolean }[]
  readonly globals: ReadonlySet<string>
  readonly strings: ReadonlySet<string>
}

function factsOf(file: string, code: string): Facts | string {
  const parsed = parseSync(file, code)
  if (parsed.errors.length > 0) return parsed.errors.map((error) => error.message).join('; ')
  const imports: { specifier: string; typeOnly: boolean }[] = []
  const globals = new Set<string>()
  const strings = new Set<string>()
  const source = (node: Node): string | undefined => {
    const from = node.source
    return isNode(from) && typeof from.value === 'string' ? from.value : undefined
  }
  walk(parsed.program as unknown as Node, null, '', (node, parent, key) => {
    if (
      node.type === 'ImportDeclaration' ||
      node.type === 'ExportNamedDeclaration' ||
      node.type === 'ExportAllDeclaration' ||
      node.type === 'ImportExpression'
    ) {
      const specifier = source(node)
      if (specifier !== undefined)
        imports.push({ specifier, typeOnly: node.importKind === 'type' || node.exportKind === 'type' })
    } else if (node.type === 'Identifier' && isReference(key, parent) && typeof node.name === 'string') {
      if (BANNED_GLOBALS.has(node.name)) globals.add(node.name)
    } else if (node.type === 'MemberExpression') {
      const object = node.object
      const property = node.property
      if (isNode(object) && object.name === 'Math' && isNode(property)) {
        const name = node.computed === true ? property.value : property.name
        if (name === 'random') globals.add('Math.random')
      }
    } else if (node.type === 'Literal' && typeof node.value === 'string') {
      strings.add(node.value)
    } else if (node.type === 'TemplateLiteral') {
      for (const quasi of node.quasis as { value: { cooked: string | null } }[]) {
        if (quasi.value.cooked !== null) strings.add(quasi.value.cooked)
      }
    }
  })
  return { imports, globals, strings }
}

/** The path of the file `specifier` names from `from`, if it is one of `files`; `undefined` when it names none. */
function resolveRelative(
  from: string,
  specifier: string,
  files: ReadonlyMap<string, string>,
): string | undefined {
  const base = posix.normalize(posix.join(posix.dirname(from), specifier))
  for (const candidate of [base, `${base}.ts`, `${base}/index.ts`]) {
    if (files.has(candidate)) return candidate
  }
  return undefined
}

const areaOf = (file: string): string => (file.includes('/') ? (file.split('/')[0] ?? '') : '')

/** `profiles/<name>/…` is inside a profile; `profiles/profile.ts` (the interface) is shared and beside them. */
function profileOf(file: string): string | undefined {
  const parts = file.split('/')
  return parts[0] === 'profiles' && parts.length >= 3 ? parts[1] : undefined
}

/** Groups of files that import each other in a ring, found with Tarjan's algorithm. */
function cycles(graph: ReadonlyMap<string, readonly string[]>): string[][] {
  const index = new Map<string, number>()
  const low = new Map<string, number>()
  const onStack = new Set<string>()
  const stack: string[] = []
  const found: string[][] = []
  let counter = 0
  const visit = (file: string): void => {
    index.set(file, counter)
    low.set(file, counter)
    counter++
    stack.push(file)
    onStack.add(file)
    for (const next of graph.get(file) ?? []) {
      if (!index.has(next)) {
        visit(next)
        low.set(file, Math.min(low.get(file) ?? 0, low.get(next) ?? 0))
      } else if (onStack.has(next)) {
        low.set(file, Math.min(low.get(file) ?? 0, index.get(next) ?? 0))
      }
    }
    if (low.get(file) === index.get(file)) {
      const group: string[] = []
      for (let member = stack.pop(); member !== undefined; member = stack.pop()) {
        onStack.delete(member)
        group.push(member)
        if (member === file) break
      }
      if (group.length > 1 || (graph.get(file) ?? []).includes(file)) found.push(group.sort())
    }
  }
  for (const file of graph.keys()) if (!index.has(file)) visit(file)
  return found
}

/** Every rule violated by `files`, in file order. */
export function checkArchitecture(files: ReadonlyMap<string, string>): Violation[] {
  const violations: Violation[] = []
  const graph = new Map<string, string[]>()
  for (const [file, code] of files) {
    const area = areaOf(file)
    const report = (rule: Rule, message: string): void => {
      violations.push({ file, rule, message })
    }
    const facts = factsOf(file, code)
    if (typeof facts === 'string') {
      report('parse-error', facts)
      continue
    }
    const edges: string[] = []
    graph.set(file, edges)
    for (const { specifier, typeOnly } of facts.imports) {
      if (!specifier.startsWith('.')) {
        if (PURE_AREAS.has(area) && !PURE_PACKAGES.has(specifier)) {
          report('pure-imports', `${specifier}: the core imports only ${[...PURE_PACKAGES].join(' and ')}`)
        }
        continue
      }
      const target = resolveRelative(file, specifier, files)
      if (target === undefined) {
        if (/\.[a-z]+$/i.test(specifier) && !specifier.endsWith('.ts')) {
          if (PURE_AREAS.has(area))
            report('pure-imports', `${specifier}: the core imports no asset or component`)
        } else {
          report('unresolved-import', `${specifier} resolves to no file under src/`)
        }
        continue
      }
      if (!typeOnly) edges.push(target)
      const profile = profileOf(target)
      if (profile === undefined) continue
      const own = profileOf(file)
      if (own !== undefined && own !== profile) {
        report('profile-isolation', `${specifier}: the ${own} profile imports the ${profile} profile`)
      } else if (own === undefined && file !== REGISTRATION_FILE) {
        report('profiles-from-app-only', `${specifier}: only ${REGISTRATION_FILE} imports a profile`)
      }
    }
    if (PURE_AREAS.has(area)) {
      for (const name of [...facts.globals].sort()) {
        report('pure-globals', `${name}: the core has no DOM, clock, timer or randomness`)
      }
    }
    if (GENERIC_AREAS.has(area)) {
      for (const id of [...PROFILE_AND_TEMPLATE_IDS].sort()) {
        if (facts.strings.has(id))
          report('no-profile-ids', `"${id}": ${area}/ works for every profile and template`)
      }
    }
  }
  for (const group of cycles(graph)) {
    violations.push({
      file: group[0] ?? '',
      rule: 'import-cycle',
      message: `files import each other in a ring: ${group.join(', ')}`,
    })
  }
  return violations
}
