// The examples catalog (EX spec §2, §5, §7): every `<module>/<module>-<name>.ts` under the examples folder, its
// header, and every rule it breaks. The runner serves the entries, the smoke and parity tests loop over them,
// and catalog.test.ts fails on any problem, so adding an example adds one file and no test.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseSync } from 'oxc-parser'
import { type Header, parseHeader } from './header.ts'

/** raylib's modules, mapped in the PRODUCT spec §7. Plus modules live in mcthaydt/automata-plus. */
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
  readonly codeLines: number
  readonly imports: readonly string[]
  /** Every rule the file breaks; empty when it is a valid example. */
  readonly problems: readonly string[]
}

export interface CatalogOptions {
  /** The delivery plan whose ticked rows end a `Pending:` (default docs/02-master-delivery-plan.md). */
  readonly deliveryPlan?: string
  /** The folder of workspace packages whose declared exports are public entries (default packages/). */
  readonly packagesDir?: string
}

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
const EXAMPLE_PATH = /^([a-z0-9]+)\/\1-([a-z0-9]+(?:-[a-z0-9]+)*)\.ts$/
// Folders under the examples folder that never hold examples.
const SKIPPED_DIRS: ReadonlySet<string> = new Set(['node_modules', 'dist', 'e2e', 'resources', '__goldens__'])
const ROOT_FILES: ReadonlySet<string> = new Set(['vite.config.ts'])
// The core umbrella (PRODUCT.2); until it exists, the catalog also accepts the core packages' own entries.
const UMBRELLA = '@mcthaydt/automata'

/** Every `.ts` file under `root`, skipping tooling folders and nested packages (the old demos, until EX.4). */
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

/** Every specifier a published `@mcthaydt/automata*` package declares in `exports`. */
function publicEntries(packagesDir: string): Set<string> {
  const entries = new Set([UMBRELLA])
  for (const dir of readdirSync(packagesDir)) {
    const manifestPath = join(packagesDir, dir, 'package.json')
    if (!existsSync(manifestPath)) continue
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      name: string
      private?: boolean
      exports?: Record<string, unknown>
    }
    if (manifest.private === true || !manifest.name.startsWith(UMBRELLA)) continue
    for (const key of Object.keys(manifest.exports ?? {}))
      entries.add(key === '.' ? manifest.name : `${manifest.name}/${key.slice(2)}`)
  }
  return entries
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

function importProblem(specifier: string, entries: ReadonlySet<string>): string | undefined {
  if (specifier.startsWith('.') || specifier.startsWith('/')) return `import "${specifier}" is relative`
  if (!entries.has(specifier)) return `import "${specifier}" is not a public entry`
  return undefined
}

export function readCatalog(root: string, options: CatalogOptions = {}): CatalogEntry[] {
  const entries = publicEntries(options.packagesDir ?? join(repoRoot, 'packages'))
  const tasks = deliveryTasks(options.deliveryPlan ?? join(repoRoot, 'docs/02-master-delivery-plan.md'))
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
      // `Pending:` names every open task whose verbs the example needs (`Pending: DX.2, DX.2b`).
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
      const problem = importProblem(specifier, entries)
      if (problem !== undefined) problems.push(problem)
    }
    const screenshot = path.replace(/\.ts$/, '.png')
    if (existsSync(join(root, screenshot)) && approved[screenshot] === undefined)
      problems.push(`${screenshot} is not in screenshots-approved.json`)

    return {
      file,
      path,
      module,
      name,
      id,
      url: `/${module}/${name}/`,
      ...(header === undefined ? {} : { header }),
      codeLines,
      imports,
      problems,
    }
  })
}
