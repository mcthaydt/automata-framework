// One API index run: read the published .d.ts, write the four files, then check doc comments against the
// baseline. The files are written even when the check fails, so the findings can be read in context.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkDocs } from './baseline.ts'
import { entryPoints, MissingTypesError } from './entry-points.ts'
import { extractExports } from './extract.ts'
import { apiJson, apiReference, indexVersion, llmsFullText } from './render.ts'

export interface RunOptions {
  /** The repository root holding the workspace packages. */
  readonly root: string
  /** Where the four files are written. */
  readonly out: string
  /** The `llms-full.txt` corpus, relative to `root`. */
  readonly corpus: readonly string[]
  /** The JSON list of export ids that may still be undocumented. A missing file is an empty list. */
  readonly baseline: string
}

export interface RunResult {
  /** 0 written and documented, 1 doc findings, 2 tool error (nothing built). */
  readonly exitCode: 0 | 1 | 2
  readonly report: readonly string[]
}

function readBaseline(file: string): string[] {
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as string[]) : []
}

export function runApiIndex(options: RunOptions): RunResult {
  let entries: ReturnType<typeof entryPoints>
  try {
    entries = entryPoints(options.root)
  } catch (error) {
    if (error instanceof MissingTypesError) return { exitCode: 2, report: [error.message] }
    throw error
  }
  const exports = extractExports(entries)
  const reference = apiReference(exports)
  mkdirSync(options.out, { recursive: true })
  writeFileSync(join(options.out, 'api.json'), apiJson(exports))
  writeFileSync(join(options.out, 'api.md'), reference)
  writeFileSync(join(options.out, 'llms-api.txt'), reference)
  writeFileSync(join(options.out, 'llms-full.txt'), llmsFullText(options.root, options.corpus, exports))

  const baseline = readBaseline(options.baseline)
  const { undocumented, stale } = checkDocs(exports, baseline)
  const report = [
    `${exports.length} exports from ${entries.length} entry points at ${indexVersion(exports)}; ${baseline.length - stale.length} undocumented (baseline)`,
    `wrote api.json, api.md, llms-api.txt and llms-full.txt to ${options.out}`,
  ]
  if (undocumented.length > 0) {
    report.push(
      'These exports have no doc comment. Add one (new exports arrive documented):',
      ...undocumented,
    )
  }
  if (stale.length > 0) {
    report.push(`These entries are documented or gone. Delete them from ${options.baseline}:`, ...stale)
  }
  return { exitCode: undocumented.length > 0 || stale.length > 0 ? 1 : 0, report }
}
