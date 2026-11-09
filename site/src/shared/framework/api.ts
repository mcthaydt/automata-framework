import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { repositoryRoot } from './root.ts'

// The framework's API index (`pnpm api-index`, tooling/api-index) as the API pages, their search and the agents' text
// files read it: generated from the published packages' declarations after `pnpm build`, read here at build time.

export interface ApiEntry {
  name: string
  kind: string
  doc: string
  signature: string
}
export interface ApiEntryPoint {
  path: string
  entries: ApiEntry[]
}
export interface ApiPackage {
  name: string
  slug: string
  entryPoints: ApiEntryPoint[]
}
export interface ApiReference {
  version: string
  packages: ApiPackage[]
}
export interface ApiSearchRow {
  name: string
  kind: string
  package: string
  summary: string
}

const slugOf = (name: string): string => name.replace(/^@automata\//, '')

export function parseApiReference(markdown: string): ApiReference {
  const lines = markdown.split('\n')
  const version = /^# Automata API reference, version (\S+)$/.exec(lines[0] ?? '')?.[1]
  if (!version) throw new Error('the API reference does not start with its version line')
  const packages: ApiPackage[] = []
  let entryPoint: ApiEntryPoint | undefined
  let entry: ApiEntry | undefined
  let doc: string[] = []
  let code: string[] | undefined
  const finish = () => {
    if (entry) entry.doc = doc.join('\n').trim()
    entry = undefined
    doc = []
  }
  for (const line of lines.slice(1)) {
    if (code) {
      if (line === '```') {
        if (entry && entry.signature === '') entry.signature = code.join('\n')
        code = undefined
      } else code.push(line)
      continue
    }
    const pkg = /^## `(@automata\/[a-z0-9-]+)`$/.exec(line)
    const point = /^### `import \{ … \} from '([^']+)'`$/.exec(line)
    const head = /^#### `([^`]+)` \(([^)]+)\)$/.exec(line)
    if (pkg) {
      finish()
      entryPoint = undefined
      packages.push({ name: pkg[1], slug: slugOf(pkg[1]), entryPoints: [] })
    } else if (point) {
      finish()
      const owner = packages[packages.length - 1]
      if (!owner) throw new Error(`entry point ${point[1]} is outside a package`)
      entryPoint = { path: point[1], entries: [] }
      owner.entryPoints.push(entryPoint)
    } else if (head) {
      finish()
      if (!entryPoint) throw new Error(`${head[1]} is outside an entry point`)
      entry = { name: head[1], kind: head[2], doc: '', signature: '' }
      entryPoint.entries.push(entry)
    } else if (line.startsWith('```') && entry) code = []
    else if (entry) doc.push(line)
  }
  finish()
  return { version, packages }
}

/** The first sentence of a doc comment, for a search result. */
export const summaryOf = (doc: string): string => {
  const first =
    doc
      .split(/\n\s*\n/)[0]
      ?.replace(/\s+/g, ' ')
      .trim() ?? ''
  const end = first.search(/\.(\s|$)/)
  return end < 0 ? first : first.slice(0, end + 1)
}

/** Everything the site publishes from the index: the parsed reference, its search rows and the two text files. */
export interface ApiIndex {
  readonly reference: ApiReference
  readonly search: ApiSearchRow[]
  /** The documentation corpus followed by the whole reference (`/llms-full.txt`). */
  readonly llmsFull: string
  /** The whole reference (`/llms-api.txt`). */
  readonly llmsApi: string
}

/** The index `pnpm api-index` wrote. Missing, it stops the build and says which command writes it. */
export function readApiIndex(root: string = repositoryRoot): ApiIndex {
  const dist = join(root, 'tooling/api-index/dist')
  const read = (name: string): string => {
    if (!existsSync(join(dist, name)))
      throw new Error(`tooling/api-index/dist/${name} is missing: run pnpm build and pnpm api-index`)
    return readFileSync(join(dist, name), 'utf8')
  }
  const llmsApi = read('llms-api.txt')
  const reference = parseApiReference(llmsApi)
  const search = reference.packages.flatMap((pkg) =>
    pkg.entryPoints.flatMap((point) =>
      point.entries.map((e) => ({
        name: e.name,
        kind: e.kind,
        package: pkg.slug,
        summary: summaryOf(e.doc),
      })),
    ),
  )
  return { reference, search, llmsFull: read('llms-full.txt'), llmsApi }
}
