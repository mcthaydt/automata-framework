// One API index run: read the published .d.ts, write the four files and the cheatsheet, then check doc comments
// against the baseline and the committed cheatsheet against the one the index renders. The files are written
// even when a check fails, so the findings can be read in context.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkDocs } from './baseline.ts'
import { cheatsheet } from './cheatsheet.ts'
import { entryPoints, MissingTypesError } from './entry-points.ts'
import { extractExports } from './extract.ts'
import { apiJson, apiReference, indexVersion, llmsFullText } from './render.ts'

export interface RunOptions {
  /** The repository root holding the workspace packages. */
  readonly root: string
  /** Where the four files and `cheatsheet.md` are written. */
  readonly out: string
  /** The `llms-full.txt` corpus, relative to `root`. */
  readonly corpus: readonly string[]
  /** The JSON list of export ids that may still be undocumented. A missing file is an empty list. */
  readonly baseline: string
  /**
   * The committed cheatsheet (PRODUCT.3). With `write`, it is rewritten from the index; without, a missing or
   * different page is a finding, like an undocumented export.
   */
  readonly cheatsheet?: { readonly file: string; readonly write: boolean }
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
  const page = cheatsheet(exports)
  writeFileSync(join(options.out, 'cheatsheet.md'), page)

  const baseline = readBaseline(options.baseline)
  const { undocumented, stale } = checkDocs(exports, baseline)
  const report = [
    `${exports.length} exports from ${entries.length} entry points at ${indexVersion(exports)}; ${baseline.length - stale.length} undocumented (baseline)`,
    `wrote api.json, api.md, llms-api.txt, llms-full.txt and cheatsheet.md to ${options.out}`,
  ]
  let staleCheatsheet = false
  if (options.cheatsheet?.write) {
    writeFileSync(options.cheatsheet.file, page)
    report.push(`wrote ${options.cheatsheet.file}`)
  } else if (options.cheatsheet !== undefined) {
    const { file } = options.cheatsheet
    staleCheatsheet = !existsSync(file) || readFileSync(file, 'utf8') !== page
    if (staleCheatsheet) {
      report.push(
        `${file} is stale: it is not the page the API index renders. Run pnpm cheatsheet and commit it.`,
      )
    }
  }
  if (undocumented.length > 0) {
    report.push(
      'These exports have no doc comment. Add one (new exports arrive documented):',
      ...undocumented,
    )
  }
  if (stale.length > 0) {
    report.push(`These entries are documented or gone. Delete them from ${options.baseline}:`, ...stale)
  }
  const failed = undocumented.length > 0 || stale.length > 0 || staleCheatsheet
  return { exitCode: failed ? 1 : 0, report }
}
