// The examples catalog: every `<module>/<module>-<name>.ts` under the examples folder, its
// header, and every rule it breaks. The runner serves the entries, the smoke and parity tests loop over them,
// and catalog.test.ts fails on any problem, so adding an example adds one file and no test.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseSync } from 'oxc-parser'
import { type Header, parseHeader } from './header.ts'

/** raylib's modules, the catalog's sections. Plus modules live in mcthaydt/automata-plus. */
export const CORE_MODULES: readonly string[] = [
  'core',
  'shapes',
  'textures',
  'text',
  'audio',
  'render',
  'sim',
  'content',
  'ui',
  // The 3D runtime is free (M3R-D20): its examples are core, though its package stays unpublished while D-1 stands.
  'render3d',
  // Procedural characters, drawn only by render3d, so private with it (M3R-D7) and core like it.
  'figures',
]
export const PLUS_MODULES: readonly string[] = ['physics', 'net', 'feel', 'post']

/** Code lines an example may have, not counting its header, blank lines or comment-only lines. */
export const CODE_LINE_BUDGET = 100

export interface CatalogEntry {
  /** Absolute path of the file. */
  readonly file: string
  /** Path from the examples folder, with `/` separators. */
  readonly path: string
  readonly module: string
  /** The part after `<module>-`. */
  readonly name: string
  /** `<module>-<name>`. */
  readonly id: string
  /** Where the runner serves it: `/<module>/<name>/`. */
  readonly url: string
  /** Absent when the header does not parse (its problems say why). */
  readonly header?: Header
  /** `<module>/<module>-<name>.png`, when the shot exists and the Owner approved it (screenshots-approved.json). */
  readonly screenshot?: string
  readonly codeLines: number
  readonly imports: readonly string[]
  /** Every rule the file breaks; empty when it is a valid example. */
  readonly problems: readonly string[]
}

export interface CatalogOptions {
  /** The delivery plan whose ticked rows end a `Pending:` (default docs/archive/02-master-delivery-plan.md). */
  readonly deliveryPlan?: string
  /** The folder of workspace packages whose declared exports are public entries (default packages/). */
  readonly packagesDir?: string
}

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
const EXAMPLE_PATH = /^([a-z0-9]+)\/\1-([a-z0-9]+(?:-[a-z0-9]+)*)\.ts$/
// Folders under the examples folder that never hold examples.
const SKIPPED_DIRS: ReadonlySet<string> = new Set(['node_modules', 'dist', 'e2e', 'resources', '__goldens__'])
const ROOT_FILES: ReadonlySet<string> = new Set(['vite.config.ts', 'playwright.config.ts'])
// The core umbrella: every core verb an example uses comes through it.
const UMBRELLA = '@automata/framework'
// Zod is AF's only schema language: every command takes a Zod schema, and no core package re-exports `z`. It stays
// a public import: re-exporting `z` would tie an example's schema library to the umbrella's pinned copy.
const SCHEMA_LANGUAGE = 'zod'
/**
 * The packages that are extensions rather than core: an example shows one by importing its
 * published entry. Every other `@automata/*` package is core or tooling, and is reached through the
 * umbrella. A new extension package fails the catalog until it is listed here, which is when to decide its tier.
 */
const EXTENSION_PACKAGES: ReadonlySet<string> = new Set(['@automata/physics'])
/**
 * Extensions that stay private for now, whose entries examples may still import: `@automata/3d` is built on the
 * closed `@pixi/3d` beta and is published when Pixi 3D is (M3R-D7). The website's playground leaves
 * its examples out (`playgroundCatalog`), because it is public.
 */
const UNPUBLISHED_EXTENSIONS: ReadonlySet<string> = new Set(['@automata/3d'])

/** Whether an import names an unpublished extension's entry. */
export const isUnpublishedExtension = (specifier: string): boolean =>
  [...UNPUBLISHED_EXTENSIONS].some((name) => specifier === name || specifier.startsWith(`${name}/`))
const AUTOMATA_PACKAGE = /^(@automata\/[a-z0-9-]+)(?:\/|$)/

interface PublicEntries {
  /** Every specifier an example may import: the umbrella, Zod and the published extensions' entries. */
  readonly entries: ReadonlySet<string>
  /** The names of the `@automata/*` packages in the workspace, private ones too. */
  readonly packages: ReadonlySet<string>
}

/** Every `.ts` file under `root`, skipping tooling folders and nested packages (the old demos). */
function exampleFiles(root: string, dir = root): string[] {
  const files: string[] = []
  for (const item of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(dir, item.name)
    if (item.isDirectory()) {
      if (SKIPPED_DIRS.has(item.name) || item.name.startsWith('.')) continue
      if (existsSync(join(path, 'package.json'))) continue
      files.push(...exampleFiles(root, path))
    } else if (item.name.endsWith('.ts') && !(dir === root && ROOT_FILES.has(item.name))) files.push(path)
  }
  return files
}

/** The umbrella, Zod and every specifier a published or unpublished extension package declares in `exports`. */
function publicEntries(packagesDir: string): PublicEntries {
  const entries = new Set([UMBRELLA, SCHEMA_LANGUAGE])
  const packages = new Set<string>()
  for (const dir of readdirSync(packagesDir)) {
    const manifestPath = join(packagesDir, dir, 'package.json')
    if (!existsSync(manifestPath)) continue
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      name: string
      private?: boolean
      exports?: Record<string, unknown>
    }
    // Every workspace package but the umbrella itself, which is always a public entry.
    if (!manifest.name.startsWith('@automata/') || manifest.name === UMBRELLA) continue
    packages.add(manifest.name)
    const published = manifest.private !== true && EXTENSION_PACKAGES.has(manifest.name)
    if (!published && !UNPUBLISHED_EXTENSIONS.has(manifest.name)) continue
    for (const key of Object.keys(manifest.exports ?? {}))
      entries.add(key === '.' ? manifest.name : `${manifest.name}/${key.slice(2)}`)
  }
  return { entries, packages }
}

/** Task IDs in the delivery plan, and which of them are ticked. */
function deliveryTasks(planPath: string): Map<string, boolean> {
  const tasks = new Map<string, boolean>()
  for (const match of readFileSync(planPath, 'utf8').matchAll(/^\| \[( |x)\] \| ([A-Za-z0-9.-]+) —/gm))
    tasks.set(match[2] as string, match[1] === 'x')
  return tasks
}

/** The task IDs a `Pending:` line lists, comma-separated; none when the example is not pending. */
export function pendingTasks(header: Header): string[] {
  return (header.pending ?? '')
    .split(',')
    .map((task) => task.trim())
    .filter((task) => task !== '')
}

/** Lines that are code: after the header, not blank and not only a comment. */
function countCodeLines(source: string, headerLines: number): number {
  let count = 0
  let inBlock = false
  for (const raw of source.split('\n').slice(headerLines)) {
    const line = raw.trim()
    if (inBlock) {
      if (line.includes('*/')) inBlock = false
      continue
    }
    if (line === '' || line.startsWith('//')) continue
    if (line.startsWith('/*')) {
      inBlock = !line.includes('*/')
      continue
    }
    count++
  }
  return count
}

function importsOf(file: string, source: string): string[] {
  const imports: string[] = []
  for (const statement of parseSync(file, source).program.body) {
    const from = (statement as { source?: { value?: unknown } | null }).source?.value
    if (typeof from === 'string') imports.push(from)
  }
  return imports
}

/**
 * Why an import is not allowed, if it is not. A core package is reached through the umbrella, whatever the path
 * into it. A pending example may import an `@automata/*` package the workspace does not have yet: its
 * pending task adds it. Once the example is no longer pending, the package must exist and declare the entry.
 */
function importProblem(
  specifier: string,
  publicImports: PublicEntries,
  pending: boolean,
): string | undefined {
  if (specifier.startsWith('.') || specifier.startsWith('/')) return `import "${specifier}" is relative`
  if (publicImports.entries.has(specifier)) return undefined
  const packageName = AUTOMATA_PACKAGE.exec(specifier)?.[1]
  if (
    packageName !== undefined &&
    publicImports.packages.has(packageName) &&
    !EXTENSION_PACKAGES.has(packageName)
  )
    return `import "${specifier}" is a core package; core is imported through "${UMBRELLA}"`
  if (pending && packageName !== undefined && !publicImports.packages.has(packageName)) return undefined
  return `import "${specifier}" is not a public entry`
}

export function readCatalog(root: string, options: CatalogOptions = {}): CatalogEntry[] {
  const publicImports = publicEntries(options.packagesDir ?? join(repoRoot, 'packages'))
  const tasks = deliveryTasks(
    options.deliveryPlan ?? join(repoRoot, 'docs/archive/02-master-delivery-plan.md'),
  )
  const approvedPath = join(root, 'screenshots-approved.json')
  const approved = existsSync(approvedPath)
    ? (JSON.parse(readFileSync(approvedPath, 'utf8')) as Record<string, string>)
    : {}

  return exampleFiles(root).map((file) => {
    const path = relative(root, file).replaceAll('\\', '/')
    const source = readFileSync(file, 'utf8')
    const problems: string[] = []
    const match = EXAMPLE_PATH.exec(path)
    const module = match?.[1] ?? path.split('/')[0] ?? ''
    const name = match?.[2] ?? path.split('/').pop()?.replace(/\.ts$/, '') ?? ''
    if (match === null) problems.push('must be <module>/<module>-<name>.ts')
    const known = CORE_MODULES.includes(module) || PLUS_MODULES.includes(module)
    if (!known) problems.push(`"${module}" is not a module`)
    const id = `${module}-${name}`

    const parsed = parseHeader(source)
    const header = Array.isArray(parsed) ? undefined : parsed
    if (Array.isArray(parsed))
      for (const error of parsed) problems.push(`line ${error.line}: ${error.message}`)
    if (header !== undefined) {
      const fileId = path.split('/').pop()?.replace(/\.ts$/, '') ?? ''
      if (match !== null && header.name !== fileId)
        problems.push(`the title line names "${header.name}", not "${fileId}"`)
      if (known && header.tier !== (CORE_MODULES.includes(module) ? 'core' : 'plus'))
        problems.push(`Tier: ${header.tier} does not match the ${module} module`)
      // `Pending:` names every open task whose verbs the example needs (`Pending: <task ids>`).
      const waitingFor = pendingTasks(header)
      for (const task of waitingFor) {
        const ticked = tasks.get(task)
        const remove = waitingFor.length === 1 ? 'remove the Pending line' : 'remove it from the Pending line'
        if (ticked === undefined) problems.push(`Pending: ${task} is not a task in the delivery plan`)
        else if (ticked) problems.push(`Pending: ${task} is ticked in the delivery plan; ${remove}`)
      }
    }

    const codeLines = countCodeLines(source, header?.lines ?? 0)
    if (codeLines > CODE_LINE_BUDGET)
      problems.push(`${codeLines} code lines, over the budget of ${CODE_LINE_BUDGET}`)
    const imports = importsOf(file, source)
    for (const specifier of imports) {
      const problem = importProblem(specifier, publicImports, header?.pending !== undefined)
      if (problem !== undefined) problems.push(problem)
    }
    const screenshot = path.replace(/\.ts$/, '.png')
    const hasShot = existsSync(join(root, screenshot))
    if (hasShot && approved[screenshot] === undefined)
      problems.push(`${screenshot} is not in screenshots-approved.json`)

    return {
      file,
      path,
      module,
      name,
      id,
      url: `/${module}/${name}/`,
      ...(header === undefined ? {} : { header }),
      ...(hasShot && approved[screenshot] !== undefined ? { screenshot } : {}),
      codeLines,
      imports,
      problems,
    }
  })
}
