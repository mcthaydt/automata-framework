// One API index run: read the published .d.ts, write the four files and the cheatsheet, then check doc comments
// against the baseline and the committed outputs against what the index renders. The committed outputs are the
// cheatsheet, the agent package's API reference and its plugin version: one index makes all of them, so they cannot
// disagree. The files are written even when a check fails, so the findings can be read in context.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { checkDocs } from './baseline.ts'
import { cheatsheet } from './cheatsheet.ts'
import { entryPoints, MissingTypesError } from './entry-points.ts'
import { apiJson, apiReference, indexVersion, llmsFullText } from './render.ts'
import { indexRows } from './rows.ts'

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
   * The committed outputs. With `write`, each is rewritten from the index; without, a missing or different one is a
   * finding, like an undocumented export.
   */
  readonly committed?: CommittedOutputs
}

export interface CommittedOutputs {
  /** `docs/cheatsheet.md`. */
  readonly cheatsheet: string
  /** The agent package's `skills/automata-api/reference/api.md`: the index's `api.md`, byte for byte. */
  readonly agentReference: string
  /** The agent package's `plugin.json`, whose `version` must be the API's (Claude Code refreshes on a new version). */
  readonly pluginManifest: string
  readonly write: boolean
}

export interface RunResult {
  /** 0 written and documented, 1 doc findings, 2 tool error (nothing built). */
  readonly exitCode: 0 | 1 | 2
  readonly report: readonly string[]
}

/** Each committed file with the text the index wants in it. */
function committedTexts(
  committed: CommittedOutputs,
  pages: { readonly cheatsheet: string; readonly reference: string; readonly version: string },
): { readonly file: string; readonly text: string }[] {
  const manifest = JSON.parse(readFileSync(committed.pluginManifest, 'utf8')) as Record<string, unknown>
  return [
    { file: committed.cheatsheet, text: pages.cheatsheet },
    { file: committed.agentReference, text: pages.reference },
    {
      file: committed.pluginManifest,
      text: `${JSON.stringify({ ...manifest, version: pages.version }, null, 2)}\n`,
    },
  ]
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
  const exports = indexRows(entries)
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
  const stalePages: string[] = []
  if (options.committed !== undefined) {
    const pages = { cheatsheet: page, reference, version: indexVersion(exports) }
    for (const { file, text } of committedTexts(options.committed, pages)) {
      const current = existsSync(file) ? readFileSync(file, 'utf8') : undefined
      if (current === text) continue
      if (options.committed.write) {
        mkdirSync(dirname(file), { recursive: true })
        writeFileSync(file, text)
        report.push(`wrote ${file}`)
      } else {
        stalePages.push(file)
        report.push(
          `${file} is stale: it is not what the API index renders. Run pnpm api-index --write and commit it.`,
        )
      }
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
  const failed = undocumented.length > 0 || stale.length > 0 || stalePages.length > 0
  return { exitCode: failed ? 1 : 0, report }
}
