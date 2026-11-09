// The names of the projects AF's code was first proven in. AF is standalone (Owner, 2026-10-31): the text it publishes names
// none of them; where code came from is recorded only in docs/provenance/sources.md. The names live here, in private tooling, and
// nowhere that ships. A finding says the file, the line and which entry matched, never the name.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

export interface SourceName {
  readonly pattern: RegExp
  /** One way the name is written, for tests to plant. */
  readonly sample: string
}

export const SOURCE_NAMES: readonly SourceName[] = [
  { pattern: /floor[\s_-]?fifty/i, sample: 'FloorFifty' },
  { pattern: /the[\s_-]last[\s_-]light/i, sample: 'The Last Light' },
  { pattern: /pixijs3d[\s_-]?experiment/i, sample: 'PixiJS3D_Experiment_001' },
  { pattern: /figure[\s_-]?builder/i, sample: 'FigureBuilder' },
  { pattern: /legacy[\s_-]?v2/i, sample: 'LegacyV2' },
]

/** The folders under `docs/` that are records: they name the source projects as evidence, by design. */
const RECORD_FOLDERS: ReadonlySet<string> = new Set(['adr', 'archive', 'provenance', 'refactor'])

/** Every `.md` file below `dir`, skipping `node_modules` and, under `docs/`, the record folders (the ADRs cite where each decision came from). */
function markdownBelow(dir: string, skip: ReadonlySet<string> = new Set()): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const path = join(dir, entry.name)
      if (entry.isDirectory())
        return entry.name === 'node_modules' || skip.has(entry.name) ? [] : markdownBelow(path)
      return entry.name.endsWith('.md') ? [path] : []
    })
}

/**
 * The text AF publishes or a reader opens: each package's changelog and README, the root README, the agent package
 * (its skills and the generated API reference, which copies doc comments) and `docs/` (the cheatsheet among them)
 * outside the record folders.
 */
function publishedSurfaces(root: string): string[] {
  const packages = join(root, 'packages')
  const perPackage = existsSync(packages)
    ? readdirSync(packages, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .flatMap((entry) => ['CHANGELOG.md', 'README.md'].map((name) => join(packages, entry.name, name)))
    : []
  return [
    ...perPackage,
    join(root, 'README.md'),
    ...markdownBelow(join(root, 'agents')),
    ...markdownBelow(join(root, 'docs'), RECORD_FOLDERS),
  ].filter(existsSync)
}

/** `file:line: names a source project (entry N)` for each line that names one, files in path order. */
export function findSourceNames(root: string): string[] {
  const findings: string[] = []
  for (const file of publishedSurfaces(root).sort()) {
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((text, index) => {
      SOURCE_NAMES.forEach((entry, entryIndex) => {
        if (entry.pattern.test(text))
          findings.push(
            `${relative(root, file)}:${index + 1}: names a source project (entry ${entryIndex + 1})`,
          )
      })
    })
  }
  return findings
}
