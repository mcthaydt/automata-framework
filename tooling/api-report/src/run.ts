// One API report run (PRODUCT spec §2 F6): generate every core package's report from source, then either
// write them (`update`) or check them: each committed report must equal the generated one, and every break
// against the base branch's report must be declared by a changeset. The CLI supplies git and the files.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { apiBreaks, describeBreak, undeclaredBreaks } from './breaks.ts'
import { corePackages, NOT_CORE } from './core-packages.ts'
import { extractApi } from './extract.ts'
import { parseReport, renderReport } from './report.ts'

/** Where the committed reports live, relative to the repository root. */
export const REPORTS_DIR = 'tooling/api-report/reports'

export interface RunOptions {
  readonly root: string
  readonly reportsDir: string
  readonly update: boolean
  readonly changesets: Readonly<Record<string, string>>
  /** The base branch's report text by file name, undefined when it has none. Omitted: no break check. */
  readonly baseReport?: (file: string) => string | undefined
  readonly notCore?: Readonly<Record<string, string>>
}

export interface RunResult {
  /** 0 clean (or written), 1 a stale report or an undeclared break. */
  readonly exitCode: 0 | 1
  readonly report: readonly string[]
}

export function runApiReport(options: RunOptions): RunResult {
  const packages = corePackages(options.root, options.notCore ?? NOT_CORE)
  const apis = extractApi(packages)
  const generated = new Map(packages.map((pkg, index) => [`${pkg.folder}.api.md`, apis[index]]))
  const existing = existsSync(options.reportsDir)
    ? readdirSync(options.reportsDir).filter((file) => file.endsWith('.api.md'))
    : []

  if (options.update) {
    mkdirSync(options.reportsDir, { recursive: true })
    for (const file of existing) if (!generated.has(file)) rmSync(join(options.reportsDir, file))
    for (const [file, api] of generated)
      if (api !== undefined) writeFileSync(join(options.reportsDir, file), renderReport(api))
    return { exitCode: 0, report: [`wrote ${generated.size} API reports to ${options.reportsDir}`] }
  }

  const stale: string[] = []
  for (const [file, api] of generated) {
    const path = join(options.reportsDir, file)
    if (api === undefined || !existsSync(path) || readFileSync(path, 'utf8') !== renderReport(api))
      stale.push(file)
  }
  for (const file of existing) if (!generated.has(file)) stale.push(file)

  const breaks = options.baseReport === undefined ? [] : collectBreaks(generated, options.baseReport)
  const versions = Object.fromEntries(packages.map((pkg) => [pkg.name, pkg.version]))
  const undeclared = undeclaredBreaks(breaks, options.changesets, versions)

  const report = [
    `${generated.size} core packages; ${breaks.length} API breaks against the base, ${undeclared.length} undeclared`,
  ]
  if (stale.length > 0) {
    report.push(
      'These API reports do not match the source. Run `pnpm api-report --update` and review the diff:',
      ...stale.sort(),
    )
  }
  if (undeclared.length > 0) {
    report.push(
      'These API breaks are undeclared. Add a changeset for the package: before 1.0 a patch with a `BREAKING:` line, from 1.0 a major:',
      ...undeclared.map(describeBreak),
    )
  }
  return { exitCode: stale.length > 0 || undeclared.length > 0 ? 1 : 0, report }
}

function collectBreaks(
  generated: ReadonlyMap<string, ReturnType<typeof extractApi>[number] | undefined>,
  baseReport: (file: string) => string | undefined,
) {
  return [...generated].flatMap(([file, api]) => {
    const base = baseReport(file)
    // A package with no report on the base branch is new: nothing it had can have broken.
    return base === undefined || api === undefined ? [] : apiBreaks(parseReport(base), api)
  })
}
