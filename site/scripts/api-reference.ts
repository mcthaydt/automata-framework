import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// M10.4: `llms-api.txt` (the complete generated reference, one `####` per export) as data for pages and search. One file per
// version is kept, so a new release adds a version and the older ones stay (`src/data/api-reference/<version>.json`).

export interface ApiEntry { name: string; kind: string; doc: string; signature: string }
export interface ApiEntryPoint { path: string; entries: ApiEntry[] }
export interface ApiPackage { name: string; slug: string; entryPoints: ApiEntryPoint[] }
export interface ApiReference { version: string; commit: string; packages: ApiPackage[] }
export interface ApiSearchRow { name: string; kind: string; package: string; summary: string }

const slugOf = (name: string): string => name.replace(/^@mcthaydt\//, '')

export function parseApiReference(markdown: string, commit: string): ApiReference {
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
    const pkg = /^## `(@mcthaydt\/[a-z0-9-]+)`$/.exec(line)
    const point = /^### `import \{ … \} from '([^']+)'`$/.exec(line)
    const head = /^#### `([^`]+)` \(([^)]+)\)$/.exec(line)
    if (pkg) { finish(); entryPoint = undefined; packages.push({ name: pkg[1], slug: slugOf(pkg[1]), entryPoints: [] }) }
    else if (point) {
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
  return { version, commit, packages }
}

/** The first sentence of a doc comment, for a search result. */
const summaryOf = (doc: string): string => {
  const first = doc.split(/\n\s*\n/)[0]?.replace(/\s+/g, ' ').trim() ?? ''
  const end = first.search(/\.(\s|$)/)
  return end < 0 ? first : first.slice(0, end + 1)
}

export function writeApiReference(markdown: string, commit: string, website: string): ApiReference {
  const reference = parseApiReference(markdown, commit)
  const search: ApiSearchRow[] = reference.packages.flatMap((pkg) =>
    pkg.entryPoints.flatMap((point) => point.entries.map((e) => ({ name: e.name, kind: e.kind, package: pkg.slug, summary: summaryOf(e.doc) }))),
  )
  for (const [folder, value] of [['api-reference', reference], ['api-search', search]] as const) {
    mkdirSync(join(website, 'src/data', folder), { recursive: true })
    writeFileSync(join(website, 'src/data', folder, `${reference.version}.json`), `${JSON.stringify(value)}\n`)
  }
  return reference
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const website = join(fileURLToPath(new URL('.', import.meta.url)), '..')
  const commit = JSON.parse(readFileSync(join(website, 'src/data/api-index.json'), 'utf8')).commit as string
  const reference = writeApiReference(readFileSync(join(website, 'static/llms-api.txt'), 'utf8'), commit, website)
  console.log(`Wrote the ${reference.version} API reference: ${reference.packages.length} packages.`)
}
