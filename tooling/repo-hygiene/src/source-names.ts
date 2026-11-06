// The names of the projects AF's code was first proven in. AF is standalone (Owner, 2026-10-31): the text it publishes names
// none of them; where code came from is recorded only in docs/provenance/sources.md. The names live here, in private tooling, and
// nowhere that ships. A finding says the file, the line and which entry matched, never the name.
//
// Two reaches. Every entry is kept off the published surfaces (changelogs, READMEs, agent skills). An entry whose rewrite has
// landed (`everywhere`) is also kept out of every other text file outside docs/: comments, tests, fixtures, scripts, configs and
// generated references, so it cannot creep back. The rest are still allowed in code until their area's rewrite lands; change
// an entry's scope to `everywhere` in the same change that removes its last mention.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

export interface SourceName {
  readonly pattern: RegExp
  /** One way the name is written, for tests to plant. */
  readonly sample: string
  /** `published`: kept off the published surfaces only. `everywhere`: kept out of all code and config too. */
  readonly scope: 'published' | 'everywhere'
}

export const SOURCE_NAMES: readonly SourceName[] = [
  { pattern: /floor[\s_-]?fifty/i, sample: 'FloorFifty', scope: 'everywhere' },
  { pattern: /the[\s_-]last[\s_-]light/i, sample: 'The Last Light', scope: 'published' },
  { pattern: /pixijs3d[\s_-]?experiment/i, sample: 'PixiJS3D_Experiment_001', scope: 'published' },
  { pattern: /figure[\s_-]?builder/i, sample: 'FigureBuilder', scope: 'published' },
  { pattern: /legacy[\s_-]?v2/i, sample: 'LegacyV2', scope: 'published' },
]

/**
 * The one place a finished entry may still appear: the folder the live staging VM keeps Caddy's environment in. The VM
 * owns that path, so renaming it is a move on the machine (the Owner's), not an edit here. Text on either side of it is checked.
 */
export const STAGING_VM_PATH = '/etc/floor-fifty/'

/** Every `.md` file below `dir`, skipping what is generated from doc comments (`reference/`) and `node_modules`. */
function markdownBelow(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const path = join(dir, entry.name)
      if (entry.isDirectory())
        return entry.name === 'node_modules' || entry.name === 'reference' ? [] : markdownBelow(path)
      return entry.name.endsWith('.md') ? [path] : []
    })
}

/** The published text: each package's changelog and README, the root README and the agent skills' own pages. */
function publishedSurfaces(root: string): string[] {
  const packages = join(root, 'packages')
  const perPackage = existsSync(packages)
    ? readdirSync(packages, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .flatMap((entry) => ['CHANGELOG.md', 'README.md'].map((name) => join(packages, entry.name, name)))
    : []
  return [...perPackage, join(root, 'README.md'), ...markdownBelow(join(root, 'agents'))].filter(existsSync)
}

/** Folders no text of ours lives in: installed or built output, caches, and docs/ (history, plans and the provenance record). */
const SKIPPED_FOLDERS: ReadonlySet<string> = new Set([
  '.git',
  '.turbo',
  '.svelte-kit',
  'node_modules',
  'dist',
  'build',
  'coverage',
  'test-results',
  'playwright-report',
  'docs',
])

/** This file holds the patterns themselves; it cannot be free of them. */
const PATTERN_FILE = join('tooling', 'repo-hygiene', 'src', 'source-names.ts')

/** Every file below `dir` that is not in a skipped folder, in path order. */
function filesBelow(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) return SKIPPED_FOLDERS.has(entry.name) ? [] : filesBelow(path)
      return entry.isFile() ? [path] : []
    })
}

/** The text of a file, or undefined for a binary file (a NUL byte in its first 8 KB) such as a vendored tarball. */
function readText(file: string): string | undefined {
  const bytes = readFileSync(file)
  return bytes.subarray(0, 8192).includes(0) ? undefined : bytes.toString('utf8')
}

/** `file:line: names a source project (entry N)` for each line that names one, files in path order. */
export function findSourceNames(root: string): string[] {
  const published = new Set(publishedSurfaces(root).map((file) => relative(root, file)))
  const everywhere = SOURCE_NAMES.some((entry) => entry.scope === 'everywhere')
  const candidates = everywhere
    ? [...filesBelow(root).map((file) => relative(root, file)), ...published]
    : [...published]
  const findings: string[] = []
  for (const name of [...new Set(candidates)].sort()) {
    if (name === PATTERN_FILE) continue
    const text = readText(join(root, name))
    if (text === undefined) continue
    text.split('\n').forEach((line, index) => {
      const checked = line.replaceAll(STAGING_VM_PATH, '')
      SOURCE_NAMES.forEach((entry, entryIndex) => {
        if (entry.scope === 'published' && !published.has(name)) return
        if (entry.pattern.test(checked))
          findings.push(`${name}:${index + 1}: names a source project (entry ${entryIndex + 1})`)
      })
    })
  }
  return findings
}
