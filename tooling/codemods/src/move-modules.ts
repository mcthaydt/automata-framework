// The module-move codemod (core and 2D refactor plan, task 4.2; spec section 3.3).
//
// It plans the move of whole source folders from several packages into the four new ones, by a map written once
// (`docs/refactor/move-map.json`): which file goes where, and which new public entry every old one becomes. It
// rewrites what the move breaks: relative imports (in moved files and in files that import them), the `#src/…` alias
// in tests, and bare imports of the old packages in every other workspace package, splitting one import in two when
// its names now come from two entries. `planModules` decides everything and touches nothing; `applyModulePlan` does
// the file work, so a dry run prints the plan a real run carries out.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative } from 'node:path'
import { parseSync } from 'oxc-parser'
import { importedNames, namesFrom, type Occurrence, specifiersOf } from '#src/module-specifiers.ts'
import { resolveTarget } from '#src/move-tests.ts'

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
  // New packages each other workspace package now imports, with the old ones they replace (for its package.json).
  const manifestDirs = new Set(files.filter((file) => file.endsWith('/package.json')).map(dirname))
  const usage = new Map<string, Map<string, Set<string>>>()
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
          // An old package's import inside the package it is merged into: relative, to the file that defines each name.
          const relative = resolveIntra({ root, file, newFile, code, span, entry, read, exists, moves })
          if (relative === undefined) intra.push({ file: rel(file), from: span.value, names })
          else edits.push(relative)
          continue
        }
        if (!inSources(file)) {
          surface.push({ consumer: rel(file), from: span.value, names })
          // A package that is being merged away gets no package.json of its own.
          if (!sources.some((source) => within(file, source)))
            noteUsage(usage, manifestDirs, file, span.value, entry, names)
        }
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

  for (const [path, text] of manifestRewrites(usage, map, read)) rewrites.set(path, text)

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

// --- package.json of the other workspace packages --------------------------------------------------------------------

const DEPENDENCY_SECTIONS = [
  'dependencies',
  'peerDependencies',
  'optionalDependencies',
  'devDependencies',
] as const
/** `@mcthaydt/automata-ui/testing` → `@mcthaydt/automata-ui`. */
const packageNameOf = (specifier: string): string => specifier.split('/').slice(0, 2).join('/')

/** Remember that the package owning `file` now imports the entry `entry` in place of the old specifier `from`. */
function noteUsage(
  usage: Map<string, Map<string, Set<string>>>,
  manifestDirs: ReadonlySet<string>,
  file: string,
  from: string,
  entry: EntryTarget,
  names: readonly string[],
): void {
  let dir = dirname(file)
  while (!manifestDirs.has(dir) && dir !== dirname(dir)) dir = dirname(dir)
  if (!manifestDirs.has(dir)) return
  const targets =
    typeof entry === 'string'
      ? [entry]
      : [
          ...new Set([
            entry.to,
            ...names.map((name) => entry.names?.[name]).filter((to): to is string => to !== undefined),
          ]),
        ]
  const perPackage = usage.get(dir) ?? new Map<string, Set<string>>()
  for (const target of targets)
    perPackage.set(
      packageNameOf(target),
      (perPackage.get(packageNameOf(target)) ?? new Set()).add(packageNameOf(from)),
    )
  usage.set(dir, perPackage)
}

/**
 * The package.json text of each package that imported an old package: the old names out, the new ones it now
 * imports in, each in the section (`dependencies` before `devDependencies`) the old package it replaces was in.
 */
function manifestRewrites(
  usage: ReadonlyMap<string, ReadonlyMap<string, ReadonlySet<string>>>,
  map: MoveMap,
  read: (path: string) => string,
): Map<string, string> {
  // A name that is also a destination (`@mcthaydt/automata`) is not an old package, whatever entry it had.
  const newNames = new Set(
    Object.values(map.entries).map((entry) => packageNameOf(typeof entry === 'string' ? entry : entry.to)),
  )
  const oldNames = new Set(
    Object.keys(map.entries)
      .map(packageNameOf)
      .filter((name) => !newNames.has(name)),
  )
  const out = new Map<string, string>()
  for (const [dir, used] of usage) {
    const path = join(dir, 'package.json')
    const manifest = JSON.parse(read(path)) as Record<string, unknown>
    const sections = DEPENDENCY_SECTIONS.filter((name) => manifest[name] !== undefined)
    const sectionOf = (name: string): (typeof DEPENDENCY_SECTIONS)[number] | undefined =>
      sections.find((section) => (manifest[section] as Record<string, string>)[name] !== undefined)
    const added = new Map<string, { section: (typeof DEPENDENCY_SECTIONS)[number]; range: string }>()
    for (const [name, replaced] of used) {
      for (const old of replaced) {
        const section = sectionOf(old)
        if (!section) continue
        const range = (manifest[section] as Record<string, string>)[old] as string
        const kept = added.get(name)
        if (!kept || DEPENDENCY_SECTIONS.indexOf(section) < DEPENDENCY_SECTIONS.indexOf(kept.section))
          added.set(name, { section, range })
      }
    }
    let changed = false
    for (const section of sections) {
      const deps = { ...(manifest[section] as Record<string, string>) }
      for (const name of Object.keys(deps)) {
        if (oldNames.has(name) && !used.has(name)) {
          delete deps[name]
          changed = true
        }
      }
      for (const [name, where] of added) {
        if (where.section === section && deps[name] === undefined) {
          deps[name] = where.range
          changed = true
        }
      }
      manifest[section] = Object.fromEntries(Object.entries(deps).sort(([a], [b]) => a.localeCompare(b)))
    }
    if (changed) out.set(path, `${JSON.stringify(manifest, null, 2)}\n`)
  }
  return out
}

/** The file an old public entry (`@mcthaydt/automata-ui/testing`) was served from, or 'conditional' for a target choice. */
function oldEntryFile(
  root: string,
  specifier: string,
  read: (path: string) => string,
): string | 'conditional' | undefined {
  const match = /^(@mcthaydt\/automata(?:-[a-z0-9-]+)?)(\/.*)?$/.exec(specifier)
  const folder = folderOfSpecifier(specifier)
  if (!match || !folder) return undefined
  try {
    const exportsField = (
      JSON.parse(read(join(root, folder, 'package.json'))) as { exports?: Record<string, unknown> }
    ).exports
    const entry = exportsField?.[match[2] ? `.${match[2]}` : '.']
    if (typeof entry === 'string') return join(root, folder, entry)
    if (entry && typeof entry === 'object') {
      // A build-time choice between targets (the `automata-ruken` condition) stays a package entry.
      if (Object.keys(entry).some((key) => key.startsWith('automata-'))) return 'conditional'
      const plain = (entry as Record<string, unknown>).default ?? (entry as Record<string, unknown>).import
      if (typeof plain === 'string') return join(root, folder, plain)
    }
  } catch {
    // No package.json to read: nothing to resolve.
  }
  return undefined
}

/**
 * The module that defines `name`, found by following `entryFile`'s re-exports (`export { a } from`, `export *`,
 * `export { default as A } from`, and an exported name imported from elsewhere in the file). `imported` is the name
 * as that module exports it. Undefined when the trail leaves the repository's files or cannot be followed.
 */
function resolveExport(
  file: string,
  name: string,
  read: (path: string) => string,
  exists: (path: string) => boolean,
  seen: Set<string> = new Set(),
): { file: string; imported: string } | undefined {
  const key = `${file}\0${name}`
  if (seen.has(key) || !/\.ts$/.test(file)) return undefined
  seen.add(key)
  const { module } = parseSync(file, read(file))
  const follow = (request: string, imported: string): { file: string; imported: string } | undefined => {
    const target = request.startsWith('.') ? resolveTarget(file, request, exists)?.target : undefined
    if (!target) return undefined
    return imported === 'default' || imported === '*'
      ? { file: target, imported }
      : resolveExport(target, imported, read, exists, seen)
  }
  for (const exported of module.staticExports)
    for (const entry of exported.entries) {
      if (entry.exportName.kind === 'None' || (entry.exportName.name ?? 'default') !== name) continue
      // `export { default as A } from` reports the name `default`; `export * as ns from` reports kind All.
      const importName = entry.importName.kind === 'All' ? '*' : (entry.importName.name as string | undefined)
      if (entry.moduleRequest)
        return importName === undefined ? undefined : follow(entry.moduleRequest.value, importName)
      // `export { a }` of a name imported in this file: follow the import. Otherwise this file declares it.
      const local = entry.localName.name ?? name
      for (const statement of module.staticImports)
        for (const imported of statement.entries)
          if (imported.localName.value === local) {
            const original =
              imported.importName.kind === 'Default'
                ? 'default'
                : imported.importName.kind === 'NamespaceObject'
                  ? '*'
                  : (imported.importName.name as string)
            return follow(statement.moduleRequest.value, original)
          }
      return { file, imported: local }
    }
  for (const exported of module.staticExports)
    for (const entry of exported.entries)
      if (entry.exportName.kind === 'None' && entry.moduleRequest) {
        const found = follow(entry.moduleRequest.value, name)
        if (found) return found
      }
  return undefined
}

interface IntraContext {
  readonly root: string
  readonly file: string
  readonly newFile: string
  readonly code: string
  readonly span: Occurrence
  readonly entry: EntryTarget
  readonly read: (path: string) => string
  readonly exists: (path: string) => boolean
  readonly moves: ReadonlyMap<string, string>
}

/** One edit that replaces an old-package import by relative imports of the files that define its names. */
function resolveIntra(context: IntraContext): { start: number; end: number; text: string } | undefined {
  const { root, file, newFile, code, span, read, exists, moves } = context
  const entryFile = oldEntryFile(root, span.value, read)
  if (entryFile === 'conditional') {
    // A public entry that stays a public entry (`./target`): the new specifier, not a relative path.
    return {
      start: span.start,
      end: span.end,
      text: typeof context.entry === 'string' ? context.entry : context.entry.to,
    }
  }
  if (entryFile === undefined) return undefined
  const statement = importedNames(file, code, span.value).find(
    (found) => found.statement.start <= span.start && span.start < found.statement.end,
  )
  if (!statement) return undefined
  const to = (target: string): string =>
    relativeSpecifier(newFile, moves.get(target) ?? target, `./${basename(target)}`, target)
  const { start, end, isType } = statement.statement
  if (statement.entries.length === 0) return { start, end, text: `import '${to(entryFile)}'` }
  const groups = new Map<string, { imported: string; local: string; isType: boolean }[]>()
  for (const named of statement.entries) {
    const found = named.imported === '*' ? undefined : resolveExport(entryFile, named.imported, read, exists)
    if (!found) return undefined
    const target = to(found.file)
    groups.set(target, [
      ...(groups.get(target) ?? []),
      { imported: found.imported, local: named.local, isType: named.isType },
    ])
  }
  const kind = isType ? 'import type' : 'import'
  const lines: string[] = []
  for (const [target, names] of groups) {
    const named = names.filter((n) => n.imported !== 'default')
    for (const n of names.filter((entry) => entry.imported === 'default'))
      lines.push(`${kind} ${n.local} from '${target}'`)
    if (named.length > 0) {
      const list = named
        .map(
          (n) =>
            `${n.isType && !isType ? 'type ' : ''}${n.imported === n.local ? n.local : `${n.imported} as ${n.local}`}`,
        )
        .join(', ')
      lines.push(`${kind} { ${list} } from '${target}'`)
    }
  }
  return { start, end, text: lines.join('\n') }
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
