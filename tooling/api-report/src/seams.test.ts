import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { apiBreaks, undeclaredBreaks } from './breaks.ts'
import { parseReport } from './report.ts'
import { REPORTS_DIR, runApiReport } from './run.ts'
import { SEAMS } from './seams.ts'

const ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const reportsDir = join(ROOT, REPORTS_DIR)
const committed = readdirSync(reportsDir)
  .filter((file) => file.endsWith('.api.md'))
  .sort()
  .map((file) => ({ file, report: parseReport(readFileSync(join(reportsDir, file), 'utf8')) }))

describe('the committed API reports', () => {
  it('match the current source of every core package (run `pnpm api-report --update` after an API change)', () => {
    const result = runApiReport({ root: ROOT, reportsDir, update: false, changesets: {} })
    expect(result.report.filter((line) => line.includes('.api.md'))).toEqual([])
    expect(result.exitCode).toBe(0)
  }, 30_000)

  it.each(committed.map(({ file, report }) => [file, report] as const))(
    '%s: a planted removal of one export is an undeclared break',
    (_file, report) => {
      const entry = report.entries.find((candidate) => candidate.exports.length > 0)
      expect(entry).toBeDefined()
      if (entry === undefined) return
      const [removed] = entry.exports
      const planted = {
        entries: report.entries.map((candidate) =>
          candidate === entry ? { ...candidate, exports: candidate.exports.slice(1) } : candidate,
        ),
      }
      const breaks = apiBreaks(report, planted)
      expect(breaks).toEqual([
        { package: report.package, entryPoint: entry.entryPoint, name: removed?.name, change: 'removed' },
      ])
      expect(undeclaredBreaks(breaks, {}, { [report.package]: '0.0.1' })).toEqual(breaks)
    },
  )
})

describe('PRODUCT spec §2 F1: every core seam is reachable through a public exports entry', () => {
  const byPackage = new Map(committed.map(({ report }) => [report.package, report]))

  it.each(SEAMS.map((seam) => [`${seam.package}${seam.entryPoint.slice(1)} ${seam.name}`, seam] as const))(
    '%s',
    (_label, seam) => {
      const entry = byPackage
        .get(seam.package)
        ?.entries.find((candidate) => candidate.entryPoint === seam.entryPoint)
      const exported = entry?.exports.find((candidate) => candidate.name === seam.name)
      expect(exported, `${seam.name} is not exported from ${seam.package} ${seam.entryPoint}`).toBeDefined()
      for (const member of seam.members ?? [])
        expect(exported?.declaration).toMatch(new RegExp(`\\b${member}\\??[:(]`))
    },
  )
})
