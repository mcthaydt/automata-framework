// The test-move codemod (core and 2D refactor plan, task 3.2; spec section 3.4).
//
// It moves a package's tests from beside their sources (`src/a/b.parity.test.ts`) into the package's `tests/` folder,
// where the folder says what kind a test is (`tests/browser/a/b.test.ts`), and rewrites the relative imports the move
// would break. `planMoves` decides everything and touches nothing; `applyPlan` does the file work, so a dry run prints
// the same plan a real run carries out.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, posix, relative } from 'node:path'
import { parseSync } from 'oxc-parser'

export type Kind = 'unit' | 'browser' | 'bench' | 'slow' | 'fixtures' | 'e2e'
export type Environment = 'node' | 'jsdom'

export interface MoveConfig {
  /** Absolute path of the package root (the folder with `package.json`, `src/` and `e2e/`). */
  readonly root: string
  /** What the package's `tests/unit` project runs in (the preset's `environment` option). */
  readonly environment: Environment
  /** Unit tests under these folders (from the root) run in the other environment. */
  readonly otherEnvironment?: readonly string[]
  /**
   * Test files (from the root) that keep their qualifier because dropping it would land two files on one name
   * (`keys.analog.test.ts` beside `keys.test.ts`).
   */
  readonly keepQualifier?: readonly string[]
}

export interface Move {
  readonly from: string
  readonly to: string
  readonly kind: Kind
  /** The new first line, when the file's environment differs from the package's default. */
  readonly directive?: string
}

export interface Plan {
  readonly moves: readonly Move[]
  /** Files whose new text differs from their old text, keyed by their new path (or old path, if they stay). */
  readonly rewrites: ReadonlyMap<string, string>
  /** Moved files that locate other files at run time (`import.meta.dirname`, `new URL(...)`): check these by eye. */
  readonly needsEyes: readonly string[]
  /** Files left in `src/` because something that stays imports them (a published test helper). */
  readonly stayed: readonly string[]
}

// --- the suffix table ---------------------------------------------------------------------------------------------
// A test's qualifier (the part between the name and `.test.ts`) decides its folder. Every qualifier in the
// repository has a row, and an unknown one stops the run, so a new suffix cannot slip through unplaced.

/** Where each qualifier sends a test. `jsdom` also puts the environment directive on it. */
const QUALIFIER_KIND: Readonly<Record<string, { kind: Kind; environment?: Environment }>> = {
  // A DOM test runs in jsdom.
  dom: { kind: 'unit', environment: 'jsdom' },
  // These need a real browser engine (layout, a renderer, the same bytes in every engine).
  layout: { kind: 'browser' },
  parity: { kind: 'browser' },
  browser: { kind: 'browser' },
  golden: { kind: 'browser' },
  // The one example whose smoke test boots the demo in Chromium.
  smoke: { kind: 'browser' },
  // Timings run by `pnpm bench` only.
  bench: { kind: 'bench' },
  // Node tests that drive a real Chromium; left out of the unit gate, run by their package's `test:slow`.
  slow: { kind: 'slow' },
  // The qualifiers below only said which part of a package a test covers; the folder it sits in says that now.
  contract: { kind: 'unit' },
  integration: { kind: 'unit' },
  build: { kind: 'unit' },
  analog: { kind: 'unit' },
  devices: { kind: 'unit' },
}

/** Role suffixes (`move.schema.ts` is tested by `move.schema.test.ts`) stay: they name the file under test. */
const ROLE_QUALIFIERS: ReadonlySet<string> = new Set([
  'component',
  'command',
  'event',
  'resource',
  'system',
  'plugin',
  'manager',
  'schema',
  'migration',
  'content',
  'generator',
  'extension',
  'svelte',
])

const TEST_FILE = /^(?<name>.+?)(?<qualifiers>(?:\.[a-z][a-z-]*)*)\.test\.(?<ext>ts|svelte)$/

interface Placement {
  kind: Kind
  environment: Environment | undefined
  /** The file's base name in its new folder. */
  name: string
}

/** Decide where one test file goes, from its name alone. */
function place(base: string, keepQualifier: boolean): Placement {
  const match = TEST_FILE.exec(base)
  if (!match?.groups) throw new Error(`move-tests: ${base} is not a test file name`)
  const { name = '', qualifiers = '', ext = '' } = match.groups
  if (ext === 'svelte') return { kind: 'fixtures', environment: undefined, name: base }
  let kind: Kind = 'unit'
  let environment: Environment | undefined
  const kept: string[] = []
  for (const qualifier of qualifiers.split('.').filter(Boolean)) {
    const row = QUALIFIER_KIND[qualifier]
    if (row) {
      if (row.kind !== 'unit') kind = row.kind
      environment = row.environment ?? environment
      if (keepQualifier) kept.push(qualifier)
    } else if (ROLE_QUALIFIERS.has(qualifier)) {
      kept.push(qualifier)
    } else {
      throw new Error(
        `move-tests: ${base} has the qualifier "${qualifier}", which has no row in QUALIFIER_KIND`,
      )
    }
  }
  return { kind, environment, name: `${[name, ...kept].join('.')}.test.${ext}` }
}

// --- planning -----------------------------------------------------------------------------------------------------

const slash = (path: string): string => path.split('\\').join('/')

/** Import specifiers in a TypeScript file: static, re-exported and dynamic, with their text spans. */
function specifierSpans(file: string, code: string): { start: number; end: number; value: string }[] {
  const { module } = parseSync(file, code)
  const spans: { start: number; end: number; value: string }[] = []
  const add = (request: { value: string; start: number; end: number } | undefined): void => {
    // The span includes the quotes; the edit keeps them.
    if (request) spans.push({ start: request.start + 1, end: request.end - 1, value: request.value })
  }
  for (const entry of module.staticImports) add(entry.moduleRequest)
  for (const exported of module.staticExports)
    for (const entry of exported.entries) add(entry.moduleRequest ?? undefined)
  for (const dynamic of module.dynamicImports) {
    const quoted = /^(['"`])(.*)\1$/s.exec(code.slice(dynamic.moduleRequest.start, dynamic.moduleRequest.end))
    if (quoted?.[2] !== undefined)
      spans.push({
        start: dynamic.moduleRequest.start + 1,
        end: dynamic.moduleRequest.end - 1,
        value: quoted[2],
      })
  }
  return spans
}

/** Specifiers that parsing does not report: mocks, `new URL(..., import.meta.url)`, and Svelte `<script>` imports. */
const EXTRA_SPECIFIERS: readonly RegExp[] = [
  /\bvi\.(?:mock|doMock|unmock|doUnmock|importActual|importMock)\(\s*(['"])(?<value>\.{1,2}\/[^'"]*)\1/g,
  /\bnew URL\(\s*(['"])(?<value>\.{1,2}\/[^'"]*)\1\s*,\s*import\.meta\.url/g,
]
const SVELTE_SPECIFIERS: readonly RegExp[] = [
  /\bfrom\s*(['"])(?<value>\.{1,2}\/[^'"]*)\1/g,
  /\bimport\s*(['"])(?<value>\.{1,2}\/[^'"]*)\1/g,
]

function extraSpans(
  code: string,
  patterns: readonly RegExp[],
): { start: number; end: number; value: string }[] {
  const spans: { start: number; end: number; value: string }[] = []
  for (const pattern of patterns)
    for (const match of code.matchAll(pattern)) {
      const value = match.groups?.value
      if (value === undefined) continue
      // The value sits right after its opening quote, which is the last quote before it in the match.
      const start = match.index + match[0].lastIndexOf(value, match[0].length - 1)
      spans.push({ start, end: start + value.length, value })
    }
  return spans
}

/** The relative specifiers of a file, each with the span of its text. */
function relativeSpecifiers(file: string, code: string): { start: number; end: number; value: string }[] {
  const all = file.endsWith('.svelte')
    ? extraSpans(code, SVELTE_SPECIFIERS)
    : [...specifierSpans(file, code), ...extraSpans(code, EXTRA_SPECIFIERS)]
  const seen = new Set<number>()
  return all
    .filter((span) => span.value.startsWith('./') || span.value.startsWith('../'))
    .filter((span) => (seen.has(span.start) ? false : (seen.add(span.start), true)))
}

/**
 * The file a specifier names (an absolute path), and the part of its name the specifier left out: `''` when it
 * wrote the whole name, `.ts` when it left off the extension, `/index.ts` when it named a folder. Null when nothing
 * on disk matches. A rewritten specifier leaves out the same part, so a package that imports without extensions
 * keeps doing so.
 */
function resolveTarget(
  from: string,
  specifier: string,
  exists: (path: string) => boolean,
): { target: string; omitted: string } | null {
  const [path = ''] = specifier.split('?')
  const base = join(dirname(from), path)
  for (const omitted of ['', '.ts', '/index.ts'])
    if (exists(`${base}${omitted}`)) return { target: `${base}${omitted}`, omitted }
  return null
}

/** Run the codemod over one package's files, without touching disk. `files` are absolute paths. */
export function planMoves(
  config: MoveConfig,
  files: readonly string[],
  read: (path: string) => string = (path) => readFileSync(path, 'utf8'),
): Plan {
  const root = config.root
  const src = join(root, 'src')
  const underRoot = (path: string): string => slash(relative(root, path))
  const keep = new Set((config.keepQualifier ?? []).map((path) => join(root, path)))
  const otherEnvironment = (config.otherEnvironment ?? []).map((path) => join(root, path))

  // 1. Decide every move from file names.
  const moves = new Map<string, Move>()
  for (const file of files) {
    const rel = underRoot(file)
    const base = posix.basename(rel)
    if (rel.startsWith('src/') && /\.test\.(?:ts|svelte)$/.test(base)) {
      const placement = place(base, keep.has(file))
      const wanted =
        placement.environment ??
        (otherEnvironment.some((dir) => file.startsWith(`${dir}/`))
          ? config.environment === 'node'
            ? 'jsdom'
            : 'node'
          : config.environment)
      const needsDirective = placement.kind === 'unit' && wanted !== config.environment
      moves.set(file, {
        from: file,
        to: join(root, 'tests', placement.kind, posix.relative('src', dirname(rel)), placement.name),
        kind: placement.kind,
        ...(needsDirective ? { directive: `// @vitest-environment ${wanted}` } : {}),
      })
    } else if (rel.startsWith('e2e/')) {
      // Journeys and their helpers move together; a journey's `.e2e.ts` becomes `.test.ts`.
      const inside = rel.slice('e2e/'.length).replace(/\.e2e\.ts$/, '.test.ts')
      moves.set(file, { from: file, to: join(root, 'tests', 'e2e', inside), kind: 'e2e' })
    }
  }

  // 2. A file that stays and imports a moved file pins it in place (a published test helper uses a test host
  //    component). Repeat until nothing more is pinned, since a pinned file can pin what it imports.
  const known = new Set(files)
  const exists = (path: string): boolean => known.has(path)
  const stayed: string[] = []
  for (let changed = true; changed; ) {
    changed = false
    for (const file of files) {
      if (moves.has(file) || !/\.(?:ts|svelte)$/.test(file)) continue
      for (const span of relativeSpecifiers(file, read(file))) {
        const resolved = resolveTarget(file, span.value, exists)
        if (resolved && moves.has(resolved.target)) {
          moves.delete(resolved.target)
          stayed.push(underRoot(resolved.target))
          changed = true
        }
      }
    }
  }

  // 3. Names that collide stop the run, with both files named.
  const landed = new Map<string, string>()
  for (const move of moves.values()) {
    const earlier = landed.get(move.to)
    if (earlier)
      throw new Error(
        `move-tests: ${underRoot(earlier)} and ${underRoot(move.from)} both become ${underRoot(move.to)}; ` +
          'list one in keepQualifier',
      )
    landed.set(move.to, move.from)
  }

  // 4. Rewrite the relative specifiers of every moved file.
  const rewrites = new Map<string, string>()
  const needsEyes: string[] = []
  for (const move of moves.values()) {
    let code = read(move.from)
    const edits = relativeSpecifiers(move.from, code)
      .map((span) => {
        const resolved = resolveTarget(move.from, span.value, exists)
        if (!resolved) return null
        const query = span.value.includes('?') ? `?${span.value.split('?').slice(1).join('?')}` : ''
        const landed = moves.get(resolved.target)?.to ?? resolved.target
        // A moved test keeps its extension; a source file's specifier leaves out what it left out before.
        const landedAt =
          resolved.omitted && landed.endsWith(resolved.omitted)
            ? landed.slice(0, -resolved.omitted.length)
            : landed
        // Code under src/ is reached through the package's alias; a moved test or any other file, relatively.
        const next = landedAt.startsWith(`${src}/`)
          ? `#src/${slash(relative(src, landedAt))}`
          : slash(relative(dirname(move.to), landedAt)).replace(/^(?!\.)/, './')
        return { ...span, next: `${next}${query}` }
      })
      .filter((edit) => edit !== null)
      .sort((a, b) => b.start - a.start)
    for (const edit of edits) code = code.slice(0, edit.start) + edit.next + code.slice(edit.end)
    if (move.directive && !code.includes('@vitest-environment')) code = `${move.directive}\n${code}`
    if (/import\.meta\.(?:dirname|url)|__dirname|process\.cwd\(\)/.test(code))
      needsEyes.push(underRoot(move.to))
    rewrites.set(move.to, code)
  }
  return { moves: [...moves.values()], rewrites, needsEyes, stayed }
}

// --- applying -----------------------------------------------------------------------------------------------------

/** Add `"imports": { "#src/*": "./src/*" }` to the package's package.json, keeping its other keys in order. */
function withImportsAlias(text: string): string {
  const json = JSON.parse(text) as Record<string, unknown>
  if ((json.imports as Record<string, string> | undefined)?.['#src/*'] === './src/*') return text
  const entries = Object.entries(json)
  // Right after "exports" when there is one, else after "type".
  const after =
    entries.findIndex(([key]) => key === 'exports') + 1 || entries.findIndex(([key]) => key === 'type') + 1
  entries.splice(after, 0, ['imports', { ...(json.imports as object | undefined), '#src/*': './src/*' }])
  return `${JSON.stringify(Object.fromEntries(entries), null, 2)}\n`
}

export interface Mover {
  /** Move a file, keeping history (`git mv`); tests pass a plain rename. */
  move(from: string, to: string): void
}

/** Carry out a plan: move the files, write their new text, add the `#src` alias. */
export function applyPlan(config: MoveConfig, plan: Plan, mover: Mover): void {
  for (const move of plan.moves) {
    mkdirSync(dirname(move.to), { recursive: true })
    mover.move(move.from, move.to)
    writeFileSync(move.to, plan.rewrites.get(move.to) ?? '')
  }
  const packageJson = join(config.root, 'package.json')
  if (existsSync(packageJson)) writeFileSync(packageJson, withImportsAlias(readFileSync(packageJson, 'utf8')))
}
