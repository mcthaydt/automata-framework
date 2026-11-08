import { posix } from 'node:path'
import { parseSync } from 'oxc-parser'
import { parse as parseSvelte } from 'svelte/compiler'

// The boundary rules of the 2D editor over a map of path (relative to `src/`) to source. `pnpm boundaries`
// covers only the sim, whose rules are much stricter, so this package carries its own. It works on the AST, so a word in
// a comment, a string, a property name or a type never counts. A Svelte component is read the same way: its scripts and
// its markup are one tree (the compiler's), so an import in `<script>` and an id in an attribute are both seen.

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

/** Where the 2D editor's shared code sits, relative to `src/`: its model, tiles, canvas and profiles. */
const CORE_ROOT = 'shared/level-2d/'
/**
 * The headless core runs in Node, in a worker or in a test, with no host: `model/`, `tiles/` and the canvas's draw list
 * (`canvas/draw/`), which says what to draw so the Pixi files beside it in `canvas/` only draw it.
 */
const PURE_PREFIXES: readonly string[] = [
  `${CORE_ROOT}model/`,
  `${CORE_ROOT}tiles/`,
  `${CORE_ROOT}canvas/draw/`,
]
/** The kit's field rules are headless too (they run in Node, in a codec), so the core may import their code. */
const PURE_SHARED_PREFIXES: readonly string[] = ['shared/kit/fields/']
const isPure = (file: string): boolean => PURE_PREFIXES.some((prefix) => file.startsWith(prefix))
const isPureOrShared = (file: string): boolean =>
  isPure(file) || PURE_SHARED_PREFIXES.some((prefix) => file.startsWith(prefix))
/** The only package the core may import: the schema language. The kit's field rules are reached by path (above). */
const PURE_PACKAGES: ReadonlySet<string> = new Set(['zod'])
/** Where nothing may name a profile or a template: each of these works for every profile (G-s). */
const GENERIC_PREFIXES: readonly string[] = [
  'app/editor-2d/',
  `${CORE_ROOT}editor/`,
  `${CORE_ROOT}session/`,
  `${CORE_ROOT}tiles/`,
  `${CORE_ROOT}canvas/`,
]
const PROFILE_AND_TEMPLATE_IDS: ReadonlySet<string> = new Set([
  'level-project',
  'platformer',
  'topdown-rpg',
  'blank',
])
/** The one file that may import a profile: the registration list. */
const REGISTRATION_FILE = `${CORE_ROOT}profiles/app-profiles.ts`
/**
 * Also allowed to import a profile: the package's entries, which only re-export (`./level-export` hands a game's build
 * the content exporter), and test helpers, which build a project from a profile's own templates.
 */
const PROFILE_IMPORTERS: readonly string[] = ['entries/', 'testing/']

/**
 * Every path prefix a rule above is written against. A rule whose prefix matches no file checks nothing, so the real-tree
 * test asserts each one finds a file: a move that leaves a prefix behind turns that test red instead of passing on air.
 */
export const RULE_PREFIXES: readonly string[] = [
  ...PURE_PREFIXES,
  ...PURE_SHARED_PREFIXES,
  ...GENERIC_PREFIXES,
  `${CORE_ROOT}profiles/`,
  REGISTRATION_FILE,
  ...PROFILE_IMPORTERS,
]

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

/** The trees to walk for one file: its program, or for a component its two scripts and its markup. */
function treesOf(file: string, code: string): readonly Node[] | string {
  if (!file.endsWith('.svelte')) {
    const parsed = parseSync(file, code)
    if (parsed.errors.length > 0) return parsed.errors.map((error) => error.message).join('; ')
    return [parsed.program as unknown as Node]
  }
  try {
    const component = parseSvelte(code, { modern: true, filename: file }) as unknown as {
      readonly module?: { readonly content: Node } | null
      readonly instance?: { readonly content: Node } | null
      readonly fragment: Node
    }
    return [component.module?.content, component.instance?.content, component.fragment].filter(isNode)
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

function factsOf(file: string, code: string): Facts | string {
  const trees = treesOf(file, code)
  if (typeof trees === 'string') return trees
  const imports: { specifier: string; typeOnly: boolean }[] = []
  const globals = new Set<string>()
  const strings = new Set<string>()
  const source = (node: Node): string | undefined => {
    const from = node.source
    return isNode(from) && typeof from.value === 'string' ? from.value : undefined
  }
  const visit = (node: Node, parent: Node | null, key: string): void => {
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
    } else if (node.type === 'Text' && typeof node.data === 'string') {
      // Markup text and static attribute values (`class="blank"`).
      strings.add(node.data)
    }
  }
  for (const tree of trees) walk(tree, null, '', visit)
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

/** `profiles/<name>/…` is inside a profile; `profiles/profile.ts` (the interface) is shared and beside them. */
function profileOf(file: string): string | undefined {
  if (!file.startsWith(`${CORE_ROOT}profiles/`)) return undefined
  const parts = file.slice(CORE_ROOT.length).split('/')
  return parts.length >= 3 ? parts[1] : undefined
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
    const area = GENERIC_PREFIXES.find((prefix) => file.startsWith(prefix))
    const pure = isPure(file)
    const report = (rule: Rule, message: string): void => {
      violations.push({ file, rule, message })
    }
    const facts = factsOf(file, code)
    if (typeof facts === 'string') {
      report('parse-error', facts)
      continue
    }
    if (pure && file.endsWith('.svelte')) report('pure-imports', 'the core holds no component')
    const edges: string[] = []
    graph.set(file, edges)
    for (const { specifier, typeOnly } of facts.imports) {
      if (!specifier.startsWith('.')) {
        if (pure && !PURE_PACKAGES.has(specifier)) {
          report('pure-imports', `${specifier}: the core imports only ${[...PURE_PACKAGES].join(' and ')}`)
        }
        continue
      }
      if (pure && specifier.endsWith('.svelte')) {
        report('pure-imports', `${specifier}: the core imports no component`)
        continue
      }
      const target = resolveRelative(file, specifier, files)
      if (target === undefined) {
        // A stylesheet, an image: not source, so not ours to resolve. A `.ts` or `.svelte` path that is missing is.
        if (/\.[a-z]+(\?.*)?$/i.test(specifier) && !/\.(ts|svelte)$/.test(specifier)) {
          if (pure) report('pure-imports', `${specifier}: the core imports no asset or component`)
        } else {
          report('unresolved-import', `${specifier} resolves to no file under src/`)
        }
        continue
      }
      if (!typeOnly) edges.push(target)
      // The core runs with no host, so the code it runs has to be core too; a type from elsewhere is erased.
      if (pure && !typeOnly && !isPureOrShared(target)) {
        report('pure-imports', `${specifier}: the core imports code only from the core`)
      }
      const profile = profileOf(target)
      if (profile === undefined) continue
      const own = profileOf(file)
      if (own !== undefined && own !== profile) {
        report('profile-isolation', `${specifier}: the ${own} profile imports the ${profile} profile`)
      } else if (
        own === undefined &&
        file !== REGISTRATION_FILE &&
        !PROFILE_IMPORTERS.some((root) => file.startsWith(root))
      ) {
        report(
          'profiles-from-app-only',
          `${specifier}: only ${REGISTRATION_FILE}, the entries and test helpers import a profile`,
        )
      }
    }
    if (pure) {
      for (const name of [...facts.globals].sort()) {
        report('pure-globals', `${name}: the core has no DOM, clock, timer or randomness`)
      }
    }
    if (area !== undefined) {
      for (const id of [...PROFILE_AND_TEMPLATE_IDS].sort()) {
        if (facts.strings.has(id))
          report('no-profile-ids', `"${id}": ${area} works for every profile and template`)
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
