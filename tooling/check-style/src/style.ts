import { existsSync, statSync } from 'node:fs'
import { basename, join, relative, sep } from 'node:path'
import { parseSync } from 'oxc-parser'
import { planCommentFindings } from './plan-comments.ts'

// Naming discipline: kebab-case file names, and role suffixes that match what the file
// exports, in both directions. Replaces automata-template's S_/C_/M_ prefixes.
// Note: namespace-qualified (ns.defineSystem) and aliased (import { defineSystem as ds }) factories are not recognized.
// Call define* directly.

export type StyleRule =
  | 'file-name'
  | 'role-suffix'
  | 'role-mismatch'
  | 'role-missing'
  | 'role-split'
  | 'parse-error'
  | 'no-html'
  | 'platform-chrome'
  | 'file-length'
  | 'plan-comment'
  | 'broken-link'
  | 'test-src-chain'

export interface StyleFinding {
  readonly file: string
  readonly rule: StyleRule
  readonly message: string
  /** 1-based, for rules that point into the file (the Svelte rules); 0 when unknown. */
  readonly line?: number
}

/**
 * The longest a non-test source file may be (a huge file is hard to review). Past it, split the file by
 * responsibility. Counted as text lines, so a trailing newline does not add one.
 */
export const MAX_SOURCE_LINES = 600

export const ROLES: ReadonlySet<string> = new Set([
  'component',
  'system',
  'command',
  'event',
  'resource',
  'plugin',
  'manager',
  'schema',
  'migration',
  'content',
  'generator',
  'extension',
])

/** define* factory -> the role suffix its exported results require. */
const DEFINE_ROLE: Readonly<Record<string, string>> = {
  defineComponent: 'component',
  defineSystem: 'system',
  defineCommand: 'command',
  defineEvent: 'event',
  defineResource: 'resource',
  definePlugin: 'plugin',
  defineContentSchema: 'content',
  defineContentGenerator: 'generator',
  defineExtension: 'extension',
}
const FACTORY_FOR: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(DEFINE_ROLE).map(([fn, role]) => [role, fn]),
)

const NAME_RE = /^([a-z0-9]+(?:-[a-z0-9]+)*)(?:\.([a-z]+))?\.ts$/

type Node = { type: string; [k: string]: unknown }

/** Strip type wrappers: as const, satisfies T, non-null (!), parenthesized. */
function unwrap(node: Node | null): Node | null {
  if (!node) return null
  if (
    node.type === 'TSAsExpression' ||
    node.type === 'TSSatisfiesExpression' ||
    node.type === 'TSNonNullExpression' ||
    node.type === 'ParenthesizedExpression'
  ) {
    return unwrap((node.expression as Node) || null)
  }
  return node
}

/** Check if a node (after unwrap) is a call to a known define* factory. */
function factoryOf(node: Node | null): string | undefined {
  const call = unwrap(node)
  if (call?.type !== 'CallExpression') return undefined
  const callee = call.callee as Node & { name?: string }
  if (callee.type !== 'Identifier' || !callee.name) return undefined
  return Object.hasOwn(DEFINE_ROLE, callee.name) ? callee.name : undefined
}

/** Every node under `node`, not entering a nested function (its returns are its own). */
function returnedValues(node: Node | null, out: (Node | null)[]): void {
  if (!node || typeof node !== 'object') return
  if (node.type === 'ReturnStatement') {
    out.push((node.argument as Node | null) ?? null)
    return
  }
  for (const [key, child] of Object.entries(node)) {
    if (key === 'parent' || child === null || typeof child !== 'object') continue
    for (const item of Array.isArray(child) ? child : [child]) {
      const sub = item as Node
      if (typeof sub.type !== 'string') continue
      if (
        sub.type === 'FunctionDeclaration' ||
        sub.type === 'FunctionExpression' ||
        sub.type === 'ArrowFunctionExpression'
      )
        continue
      returnedValues(sub, out)
    }
  }
}

/** The define* factory a returned value holds: the call itself, or an object literal with one as a member. */
function factoryHeldBy(value: Node | null): string | undefined {
  const direct = factoryOf(value)
  if (direct !== undefined) return direct
  const object = unwrap(value)
  if (object?.type !== 'ObjectExpression') return undefined
  for (const member of object.properties as Node[]) {
    const held = member.type === 'Property' ? factoryOf(member.value as Node) : undefined
    if (held !== undefined) return held
  }
  return undefined
}

/**
 * The define* factory a function builds: every value it returns is that factory's call, or an object with that call
 * as a member (`createCutscenes(options)` returning `{ plugin: definePlugin(...) }`). A function that sometimes returns
 * anything else is not one.
 */
function factoryBuiltBy(fn: Node | null): string | undefined {
  if (
    fn?.type !== 'FunctionDeclaration' &&
    fn?.type !== 'FunctionExpression' &&
    fn?.type !== 'ArrowFunctionExpression'
  )
    return undefined
  const body = fn.body as Node
  const values: (Node | null)[] = []
  if (body.type === 'BlockStatement') returnedValues(body, values)
  else values.push(body)
  const factories = values.map(factoryHeldBy)
  const first = factories[0]
  return first !== undefined && factories.every((f) => f === first) ? first : undefined
}

/** Factory names of every `export const X = defineY(...)` / `export default defineY(...)` / `const X = defineY(...); export { X }` in the file. */
function exportedFactories(program: Node, functions: boolean): string[] {
  const out: string[] = []
  const constMap = new Map<string, string>() // name -> factory

  // First pass: build map of top-level const declarations
  for (const stmt of program.body as Node[]) {
    if (stmt.type === 'VariableDeclaration') {
      for (const d of stmt.declarations as Node[]) {
        const name = (d.id as Node & { name?: string }).name
        if (name) {
          const f = factoryOf(d.init as unknown as Node)
          if (f) constMap.set(name, f)
        }
      }
    }
  }

  // Second pass: find exports
  for (const stmt of program.body as Node[]) {
    if (stmt.type === 'ExportNamedDeclaration') {
      const decl = stmt.declaration as Node | null
      // export const X = defineY(...), or export const makeX = (...) => defineY(...)
      if (decl?.type === 'VariableDeclaration') {
        for (const d of decl.declarations as Node[]) {
          const f =
            factoryOf(d.init as unknown as Node) ??
            (functions ? factoryBuiltBy(d.init as Node | null) : undefined)
          if (f) out.push(f)
        }
      }
      // export function makeX(...) { return defineY(...) }
      if (functions && decl?.type === 'FunctionDeclaration') {
        const f = factoryBuiltBy(decl)
        if (f) out.push(f)
      }
      // export { X, Y } - resolve via constMap
      const specifiers = stmt.specifiers as Node[] | undefined
      if (specifiers) {
        for (const spec of specifiers) {
          const localName = (spec.local as Node & { name?: string }).name
          if (localName && constMap.has(localName)) {
            out.push(constMap.get(localName) as string)
          }
        }
      }
    } else if (stmt.type === 'ExportDefaultDeclaration') {
      // export default X where X is an identifier
      const decl = stmt.declaration as Node | null
      if (decl?.type === 'Identifier') {
        const name = (decl as Node & { name?: string }).name
        if (name && constMap.has(name)) {
          out.push(constMap.get(name) as string)
        }
      } else {
        // export default defineY(...)
        const f = factoryOf(decl)
        if (f) out.push(f)
      }
    }
  }
  return out
}

export interface CheckOptions {
  /** A game's `src/`: paths under it may group the sim by role. Package roots omit it. */
  readonly gameRoot?: string
  /** Flag comments that cite the plan that asked for the code. Off until a package's comments are rewritten. */
  readonly planComments?: boolean
}

export function checkFile(file: string, code: string, options: CheckOptions = {}): StyleFinding[] {
  const plan = options.planComments === true ? planCommentFindings(file, code) : []
  return [...lengthFindings(file, code), ...namingFindings(file, code, options), ...plan]
}

// A game root names its sim files for the role they hold: the plural of the five sim roles, plus
// `state` for the plugin. Derived from DEFINE_ROLE so the roles stay listed once.
const GAME_ROLE_FACTORY: ReadonlyMap<string, string> = new Map([
  ...['component', 'command', 'event', 'resource', 'system'].map(
    (role) => [`${role}s`, FACTORY_FOR[role] as string] as const,
  ),
  ['state', 'definePlugin'],
])
/** Role paths that hold no define* result; `main` is a file only, the others may grow into folders. */
const GAME_PLAIN_ROLES: ReadonlySet<string> = new Set(['constants', 'views', 'main'])
const GAME_PLAIN_FOLDERS: ReadonlySet<string> = new Set(['constants', 'views'])
/** The role path a factory's results belong in, for messages: defineSystem -> systems. */
const GAME_PATH_FOR: ReadonlyMap<string, string> = new Map(
  [...GAME_ROLE_FACTORY].map(([path, factory]) => [factory, path]),
)

/** `role-split`: a role is a file or a folder, never both. Checked once per game root. */
export function checkGameRoot(dir: string): StyleFinding[] {
  const findings: StyleFinding[] = []
  for (const role of [...GAME_ROLE_FACTORY.keys(), ...GAME_PLAIN_FOLDERS]) {
    const file = join(dir, `${role}.ts`)
    const folder = join(dir, role)
    if (existsSync(file) && existsSync(folder) && statSync(folder).isDirectory()) {
      findings.push({
        file,
        rule: 'role-split',
        message: `${role}.ts and ${role}/ both exist; move ${role}.ts into ${role}/`,
      })
    }
  }
  return findings
}

function lengthFindings(file: string, code: string): StyleFinding[] {
  const lineCount = code.endsWith('\n') ? code.split('\n').length - 1 : code.split('\n').length
  if (lineCount <= MAX_SOURCE_LINES) return []
  return [
    {
      file,
      rule: 'file-length',
      message: `${lineCount} lines; non-test source may have at most ${MAX_SOURCE_LINES}, so split it by responsibility`,
    },
  ]
}

function namingFindings(file: string, code: string, options: CheckOptions): StyleFinding[] {
  const name = basename(file)
  const finding = (rule: StyleRule, message: string): StyleFinding[] => [{ file, rule, message }]
  if (name === 'index.ts') return []
  // Svelte 5 rune modules must be named *.svelte.ts; that marker is Svelte's, not one of our roles.
  const m = NAME_RE.exec(name.replace(/\.svelte\.ts$/, '.ts'))
  if (!m)
    return finding('file-name', `"${name}" must be kebab-case, optionally with a role suffix (name.role.ts)`)
  const role = m[2]
  if (role !== undefined && !ROLES.has(role))
    return finding('file-name', `"${name}" has unknown role "${role}"`)

  const parsed = parseSync(file, code)
  if (parsed.errors.length > 0) return finding('parse-error', parsed.errors.map((e) => e.message).join('; '))
  const factories = exportedFactories(parsed.program as unknown as Node, role !== undefined)

  const gamePath = options.gameRoot === undefined ? undefined : gameRelativePath(options.gameRoot, file)
  if (gamePath !== undefined) {
    const game = gameRoleFindings(gamePath, role, factories)
    if (game !== undefined) return game.map((message) => ({ file, ...message }))
  }

  if (role === undefined) {
    const first = factories[0]
    if (first) {
      if (gamePath !== undefined) return finding('role-suffix', gameSuffixMessage(first))
      const suffix = Object.hasOwn(DEFINE_ROLE, first)
        ? DEFINE_ROLE[first as keyof typeof DEFINE_ROLE]
        : 'unknown'
      return finding('role-suffix', `exports a ${first} result, so the file must be named *.${suffix}.ts`)
    }
    return []
  }
  const factory = FACTORY_FOR[role]
  if (factory === undefined) return [] // manager, schema, migration: no define* factory to match
  if (factories.some((f) => f !== factory)) {
    return finding('role-mismatch', `a *.${role}.ts file may only export ${factory} results`)
  }
  if (!factories.includes(factory))
    return finding('role-missing', `a *.${role}.ts file must export at least one ${factory} result`)
  return []
}

/** The path below the game root split into segments, or undefined when the file is outside it. */
function gameRelativePath(gameRoot: string, file: string): readonly string[] | undefined {
  const path = relative(gameRoot, file)
  if (path === '' || path.startsWith('..')) return undefined
  return path.split(sep)
}

function gameSuffixMessage(factory: string): string {
  const suffix = DEFINE_ROLE[factory as keyof typeof DEFINE_ROLE] ?? 'unknown'
  const path = GAME_PATH_FOR.get(factory)
  if (path === undefined) return `exports a ${factory} result, so the file must be named *.${suffix}.ts`
  return `exports a ${factory} result, so it belongs in ${path}.ts (or ${path}/), or a file named *.${suffix}.ts`
}

type GameFinding = Omit<StyleFinding, 'file'>

/**
 * The game-root rules for a role path: a flat role file (`systems.ts`) or a file in a role folder
 * (`systems/goal.ts`). Returns undefined for any other path, which keeps today's suffix rules.
 */
function gameRoleFindings(
  path: readonly string[],
  suffix: string | undefined,
  factories: readonly string[],
): GameFinding[] | undefined {
  const top = path[0] as string
  const flat = path.length === 1
  const roleName = flat ? top.replace(/\.ts$/, '') : top
  if (flat && suffix !== undefined) return undefined
  const factory = GAME_ROLE_FACTORY.get(roleName)
  const where = flat ? `${roleName}.ts` : `a file in ${roleName}/`

  if (flat ? GAME_PLAIN_ROLES.has(roleName) : GAME_PLAIN_FOLDERS.has(roleName)) {
    if (suffix !== undefined) return undefined
    const first = factories[0]
    return first ? [{ rule: 'role-suffix', message: gameSuffixMessage(first) }] : []
  }
  if (factory === undefined) return undefined

  if (suffix !== undefined) {
    // A suffix inside a role folder is redundant but must match the folder's role.
    if (FACTORY_FOR[suffix] === factory) return undefined
    return [{ rule: 'file-name', message: `a *.${suffix}.ts file does not belong in ${roleName}/` }]
  }
  if (factories.some((f) => f !== factory))
    return [{ rule: 'role-mismatch', message: `${where} may only export ${factory} results` }]
  if (flat && !factories.includes(factory))
    return [{ rule: 'role-missing', message: `${where} must export at least one ${factory} result` }]
  return []
}
