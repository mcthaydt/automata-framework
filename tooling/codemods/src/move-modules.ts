// The module-move codemod (core and 2D refactor plan, task 4.2; spec section 3.3).
//
// It plans the move of whole source folders from several packages into the four new ones, by a map written once
// (`docs/refactor/move-map.json`): which file goes where, and which new public entry every old one becomes. It
// rewrites what the move breaks: relative imports (in moved files and in files that import them), the `#src/…` alias
// in tests, and bare imports of the old packages in every other workspace package, splitting one import in two when
// its names now come from two entries. `planModules` decides everything and touches nothing; `applyModulePlan` does
// the file work, so a dry run prints the plan a real run carries out.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { parseSync } from 'oxc-parser'
import { extraSpans, MOCK_SPECIFIERS, resolveTarget, specifierSpans, stringRanges } from '#src/move-tests.ts'

export interface MoveRow {
  /** A file or a folder, from the repository root. The longest row that contains a file decides where it goes. */
  readonly from: string
  readonly to: string
}

/** Where an old public entry goes: one new entry, or one new entry with some names sent to others. */
export type EntryTarget = string | { readonly to: string; readonly names?: Readonly<Record<string, string>> }

export interface MoveMap {
  /** The package folders being merged or emptied (`packages/runtime`): every file under their `src/` and `tests/` must have a row. */
  readonly sources: readonly string[]
  readonly moves: readonly MoveRow[]
  /** Old specifier (`@mcthaydt/automata-ui/testing`) → new entry. Matched exactly. */
  readonly entries: Readonly<Record<string, EntryTarget>>
}

export interface ModuleMove {
  readonly from: string
  readonly to: string
}

export interface ModulePlan {
  readonly moves: readonly ModuleMove[]
  /** Files dropped because another file with the same text lands on the same path (one `setup.ts` for two packages). */
  readonly removed: readonly string[]
  /** Files whose text changes, keyed by the path the text is written to (the new path for a moved file). */
  readonly rewrites: ReadonlyMap<string, string>
  /** Files under a source package that no row covers. A run with any of these stops. */
  readonly unmapped: readonly string[]
  /** Files that would land on one path with different text. A run with any of these stops. */
  readonly clashes: readonly { to: string; from: readonly string[] }[]
  /** The names each other workspace file imports from an old entry (the surface report, S4). */
  readonly surface: readonly { consumer: string; from: string; names: readonly string[] }[]
  /** Imports of an old package from a file that moves into the package that old package becomes: not rewritten. */
  readonly intra: readonly { file: string; from: string; names: readonly string[] }[]
}

// --- where a file goes ----------------------------------------------------------------------------------------------

const TEST_KINDS = ['unit', 'browser', 'bench', 'slow', 'fixtures', 'e2e'] as const
const slash = (path: string): string => path.split('\\').join('/')
const within = (path: string, folder: string): boolean => path === folder || path.startsWith(`${folder}/`)

/** `packages/runtime/src/x.ts` → `packages/runtime`: the first two segments of a repository path. */
const packageOf = (root: string, path: string): string => {
  const [a = '', b = ''] = slash(relative(root, path)).split('/')
  return join(root, a, b)
}

/** The package folder a new public specifier names: `@mcthaydt/automata-sim/testing` → `packages/sim`. */
function folderOfSpecifier(specifier: string): string | undefined {
  const match = /^@mcthaydt\/automata(?:-([a-z0-9-]+))?(?:\/|$)/.exec(specifier)
  return match ? `packages/${match[1] ?? 'automata'}` : undefined
}

function makeDestination(root: string, map: MoveMap): (file: string) => string | undefined {
  const rows = map.moves
    .map((row) => ({ from: join(root, row.from), to: join(root, row.to) }))
    .sort((a, b) => b.from.length - a.from.length)
  const lookup = (path: string): string | undefined => {
    const row = rows.find((candidate) => within(path, candidate.from))
    return row && join(row.to, path.slice(row.from.length))
  }
  const sources = map.sources.map((source) => join(root, source))
  return (file) => {
    // An explicit row wins, test folders included.
    const direct = lookup(file)
    if (direct) return direct
    // Otherwise a test goes where the source file it tests went: tests/<kind>/<dir>/<name>.test.ts is the test of
    // src/<dir>/<name>.ts, and lands in the new package's tests/<kind>/<the new folder, minus a leading features/>/.
    const source = sources.find((candidate) => within(file, candidate))
    if (!source) return undefined
    const parts = slash(relative(source, file)).split('/')
    const [folder, kind, ...rest] = parts
    if (folder !== 'tests' || !TEST_KINDS.includes(kind as (typeof TEST_KINDS)[number]) || rest.length === 0)
      return undefined
    const name = rest.at(-1) as string
    if (!/\.test\.(?:ts|svelte)$/.test(name)) return undefined
    const testedName = name.replace(/\.test\.svelte$/, '.svelte').replace(/\.test\.ts$/, '.ts')
    const tested = lookup(join(source, 'src', ...rest.slice(0, -1), testedName))
    if (!tested) return undefined
    const newPackage = packageOf(root, tested)
    const inner = slash(relative(join(newPackage, 'src'), dirname(tested))).replace(/^features(?:\/|$)/, '')
    return join(newPackage, 'tests', kind as string, inner, name)
  }
}

// --- reading specifiers ----------------------------------------------------------------------------------------------

interface Occurrence {
  readonly start: number
  readonly end: number
  readonly value: string
}

/** Every module specifier in a file, with the span of its text (quotes excluded). */
function specifiersOf(file: string, code: string): Occurrence[] {
  const seen = new Set<number>()
  const unique = (spans: Occurrence[]): Occurrence[] =>
    spans.filter((span) => (seen.has(span.start) ? false : (seen.add(span.start), true)))
  if (file.endsWith('.svelte')) {
    const found: Occurrence[] = []
    for (const match of code.matchAll(/\b(?:from|import)\s*(['"])(?<value>[^'"\n]+)\1/g)) {
      const value = match.groups?.value ?? ''
      const start = match.index + match[0].lastIndexOf(value, match[0].length - 2)
      found.push({ start, end: start + value.length, value })
    }
    return unique(found)
  }
  const strings = stringRanges(file, code)
  return unique([...specifierSpans(file, code), ...extraSpans(code, MOCK_SPECIFIERS, 'module', strings)])
}

interface ImportedNames {
  readonly statement: { start: number; end: number; isType: boolean }
  readonly entries: readonly { imported: string; local: string; isType: boolean }[]
}

/** The named imports of the statements that import `specifier` (TypeScript only), with where each statement is. */
function importedNames(file: string, code: string, specifier: string): ImportedNames[] {
  if (file.endsWith('.svelte')) return []
  const { module } = parseSync(file, code)
  const found: ImportedNames[] = []
  for (const statement of module.staticImports) {
    if (statement.moduleRequest.value !== specifier) continue
    const entries = statement.entries.map((entry) => ({
      imported:
        entry.importName.kind === 'Name'
          ? (entry.importName.name as string)
          : entry.importName.kind === 'Default'
            ? 'default'
            : '*',
      local: entry.localName.value,
      isType: entry.isType,
    }))
    const isType =
      entries.length > 0 &&
      entries.every((entry) => entry.isType) &&
      /^\s*import\s+type\b/.test(code.slice(statement.start, statement.end))
    found.push({ statement: { start: statement.start, end: statement.end, isType }, entries })
  }
  return found
}

/** The names a file imports or re-exports from `specifier`; `*` for a namespace or `export *`. */
function namesFrom(file: string, code: string, specifier: string): string[] {
  if (file.endsWith('.svelte')) return ['*']
  const { module } = parseSync(file, code)
  const names = new Set<string>()
  for (const statement of module.staticImports)
    if (statement.moduleRequest.value === specifier)
      for (const entry of statement.entries)
        names.add(
          entry.importName.kind === 'Name'
            ? (entry.importName.name as string)
            : entry.importName.kind === 'Default'
              ? 'default'
              : '*',
        )
  for (const exported of module.staticExports)
    for (const entry of exported.entries)
      if (entry.moduleRequest?.value === specifier)
        names.add(entry.importName.kind === 'Name' ? (entry.importName.name as string) : '*')
  return [...names].sort()
}

// --- planning ------------------------------------------------------------------------------------------------------

const CODE_FILE = /\.(?:ts|svelte)$/

/** Plan the move, without touching disk. `files` are absolute paths of every tracked file. */
export function planModules(
  root: string,
  map: MoveMap,
  files: readonly string[],
  read: (path: string) => string = (path) => readFileSync(path, 'utf8'),
): ModulePlan {
  const destination = makeDestination(root, map)
  const sources = map.sources.map((source) => join(root, source))
  const inSources = (file: string): boolean =>
    sources.some((source) => within(file, join(source, 'src')) || within(file, join(source, 'tests')))
  const rel = (path: string): string => slash(relative(root, path))

  // 1. Decide every move; stop on files nothing covers and on two files with one destination.
  const moves = new Map<string, string>()
  const unmapped: string[] = []
  for (const file of files) {
    if (!inSources(file)) continue
    const to = destination(file)
    if (to === undefined) unmapped.push(file)
    else moves.set(file, to)
  }
  const landing = new Map<string, string[]>()
  for (const [from, to] of moves) landing.set(to, [...(landing.get(to) ?? []), from])
  // Two files with the same text on one path are one file: the first stays, the rest are removed. Different text is a clash.
  const removed: string[] = []
  const clashes: { to: string; from: string[] }[] = []
  for (const [to, from] of landing) {
    if (from.length < 2) continue
    const sorted = [...from].sort()
    if (new Set(sorted.map((file) => read(file))).size === 1) {
      for (const duplicate of sorted.slice(1)) {
        removed.push(duplicate)
        moves.delete(duplicate)
      }
    } else clashes.push({ to, from: sorted })
  }
  if (unmapped.length > 0 || clashes.length > 0)
    return { moves: [], removed: [], rewrites: new Map(), unmapped, clashes, surface: [], intra: [] }

  // 2. Rewrite the specifiers of every code file: the moved ones and the ones that import them.
  const known = new Set(files)
  const exists = (path: string): boolean => known.has(path)
  const rewrites = new Map<string, string>()
  const surface: ModulePlan['surface'][number][] = []
  const intra: ModulePlan['intra'][number][] = []
  for (const file of files) {
    if (!CODE_FILE.test(file)) continue
    const code = read(file)
    const newFile = moves.get(file) ?? file
    const edits: { start: number; end: number; text: string }[] = []
    for (const span of specifiersOf(file, code)) {
      const [path = '', ...queryParts] = span.value.split('?')
      const query = queryParts.length > 0 ? `?${queryParts.join('?')}` : ''
      let next: string | undefined
      if (span.value.startsWith('.')) {
        const resolved = resolveTarget(file, span.value, exists)
        if (!resolved) continue
        const target = moves.get(resolved.target) ?? resolved.target
        if (target === resolved.target && newFile === file) continue
        next = relativeSpecifier(newFile, target, path, resolved.target)
      } else if (span.value.startsWith('#src/')) {
        const oldPackage = sources.find((source) => within(file, source))
        if (!oldPackage) continue
        const oldTarget = join(oldPackage, 'src', path.slice('#src/'.length))
        const target = moves.get(oldTarget)
        if (!target) continue
        const newPackage = packageOf(root, newFile)
        next = within(target, join(newPackage, 'src'))
          ? `#src/${slash(relative(join(newPackage, 'src'), target))}`
          : relativeSpecifier(newFile, target, path, oldTarget)
      } else {
        const entry = map.entries[span.value]
        if (entry === undefined) continue
        const to = typeof entry === 'string' ? entry : entry.to
        const names = namesFrom(file, code, span.value)
        const movesInto = folderOfSpecifier(to)
        if (inSources(file) && movesInto && within(rel(newFile), movesInto)) {
          // An old package's import inside the package it is merged into: the build step makes it relative.
          intra.push({ file: rel(file), from: span.value, names })
          continue
        }
        if (!inSources(file)) surface.push({ consumer: rel(file), from: span.value, names })
        const split = typeof entry === 'string' ? undefined : splitEdit(file, code, span.value, entry)
        if (split) {
          edits.push(...split)
          continue
        }
        next = typeof entry === 'string' ? entry : (singleTarget(file, code, span.value, entry) ?? entry.to)
      }
      if (next !== undefined && `${next}${query}` !== span.value)
        edits.push({ start: span.start, end: span.end, text: `${next}${query}` })
    }
    let text = code
    for (const edit of edits.sort((a, b) => b.start - a.start))
      text = text.slice(0, edit.start) + edit.text + text.slice(edit.end)
    if (text !== code) rewrites.set(newFile, text)
  }

  return {
    moves: [...moves].map(([from, to]) => ({ from, to })).filter((move) => move.from !== move.to),
    removed,
    rewrites,
    unmapped,
    clashes,
    surface: surface.sort((a, b) => a.consumer.localeCompare(b.consumer) || a.from.localeCompare(b.from)),
    intra,
  }
}

/** The specifier from `importer` to `target`, written in the style of the old one (extension, folder import). */
function relativeSpecifier(
  importer: string,
  target: string,
  oldSpecifier: string,
  oldTarget: string,
): string {
  const toFolder =
    oldTarget.endsWith('/index.ts') && !oldSpecifier.endsWith('index.ts') && !oldSpecifier.endsWith('index')
  const omitsExtension = !toFolder && oldTarget.endsWith('.ts') && !/\.(?:ts|js)$/.test(oldSpecifier)
  let path = slash(relative(dirname(importer), toFolder ? dirname(target) : target))
  if (omitsExtension) path = path.replace(/\.ts$/, '')
  if (oldSpecifier.endsWith('.js')) path = path.replace(/\.ts$/, '.js')
  if (path === '') path = '.'
  return /^\.\.?(?:\/|$)/.test(path) ? path : `./${path}`
}

/** When every name an import takes goes to one entry, that entry (a mapping with `names` can still send all to one). */
function singleTarget(
  file: string,
  code: string,
  specifier: string,
  entry: Exclude<EntryTarget, string>,
): string | undefined {
  const statements = importedNames(file, code, specifier)
  const destinations = new Set(
    statements.flatMap((statement) =>
      statement.entries.length === 0
        ? [entry.to]
        : statement.entries.map((e) => entry.names?.[e.imported] ?? entry.to),
    ),
  )
  return destinations.size === 1 ? [...destinations][0] : undefined
}

/** Replace a statement whose names now come from two or more entries by one statement per entry. */
function splitEdit(
  file: string,
  code: string,
  specifier: string,
  entry: Exclude<EntryTarget, string>,
): { start: number; end: number; text: string }[] | undefined {
  const edits: { start: number; end: number; text: string }[] = []
  for (const { statement, entries } of importedNames(file, code, specifier)) {
    const groups = new Map<string, typeof entries>()
    for (const named of entries) {
      const to = entry.names?.[named.imported] ?? entry.to
      groups.set(to, [...(groups.get(to) ?? []), named])
    }
    if (groups.size < 2) continue
    const lines = [...groups].map(([to, named]) => {
      const list = named
        .map((n) => {
          const typed = n.isType && !statement.isType ? 'type ' : ''
          return n.imported === n.local ? `${typed}${n.local}` : `${typed}${n.imported} as ${n.local}`
        })
        .join(', ')
      return `import ${statement.isType ? 'type ' : ''}{ ${list} } from '${to}'`
    })
    edits.push({ start: statement.start, end: statement.end, text: lines.join('\n') })
  }
  return edits.length > 0 ? edits : undefined
}

// --- applying ------------------------------------------------------------------------------------------------------

export interface ModuleMover {
  /** Move a file, keeping history (`git mv`); tests pass a plain rename. */
  move(from: string, to: string): void
  /** Delete a file (`git rm`). */
  remove(path: string): void
}

/** Carry out a plan: move the files, then write the rewritten text of every file that changed. */
export function applyModulePlan(plan: ModulePlan, mover: ModuleMover): void {
  if (plan.unmapped.length > 0 || plan.clashes.length > 0)
    throw new Error('move-modules: the plan has unmapped files or clashes; fix the map first')
  for (const path of plan.removed) mover.remove(path)
  for (const move of plan.moves) {
    mkdirSync(dirname(move.to), { recursive: true })
    mover.move(move.from, move.to)
  }
  for (const [path, text] of plan.rewrites) {
    if (!existsSync(dirname(path))) mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, text)
  }
}
