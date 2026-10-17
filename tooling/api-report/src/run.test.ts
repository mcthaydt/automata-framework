import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { FIXTURE_EXCLUDED, FIXTURE_ROOT } from './fixture.ts'
import { runApiReport } from './run.ts'

const dirs: string[] = []
const reportsDir = () => {
  const dir = mkdtempSync(join(tmpdir(), 'api-report-'))
  dirs.push(dir)
  return dir
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const run = (dir: string, more: Partial<Parameters<typeof runApiReport>[0]> = {}) =>
  runApiReport({
    root: FIXTURE_ROOT,
    notCore: FIXTURE_EXCLUDED,
    reportsDir: dir,
    update: false,
    changesets: {},
    ...more,
  })

describe('runApiReport', () => {
  it('--update writes one report per core package, after which the check passes', () => {
    const dir = reportsDir()
    expect(run(dir, { update: true }).exitCode).toBe(0)
    expect(readdirSync(dir).sort()).toEqual(['alpha.api.md', 'beta.api.md'])
    expect(run(dir)).toMatchObject({ exitCode: 0 })
  })

  it('fails on a missing, stale or leftover report, naming the file', () => {
    const dir = reportsDir()
    run(dir, { update: true })
    writeFileSync(
      join(dir, 'beta.api.md'),
      readFileSync(join(dir, 'beta.api.md'), 'utf8').replace('number', 'string'),
    )
    writeFileSync(join(dir, 'gone.api.md'), '# @fx/gone API report\n')
    rmSync(join(dir, 'alpha.api.md'))
    const result = run(dir)
    expect(result.exitCode).toBe(1)
    expect(result.report.join('\n')).toMatch(/alpha\.api\.md[\s\S]*beta\.api\.md[\s\S]*gone\.api\.md/)
  })

  it('fails on an undeclared break against the base report, and passes once a changeset declares it', () => {
    const dir = reportsDir()
    run(dir, { update: true })
    // The planted break: the base branch's beta had an export that the source no longer has.
    const base = `${readFileSync(join(dir, 'beta.api.md'), 'utf8')}\n### \`volume\` (function)\n\n\`\`\`ts\nfunction volume(): number;\n\`\`\`\n`
    const baseReport = (file: string) => (file === 'beta.api.md' ? base : undefined)

    const failed = run(dir, { baseReport })
    expect(failed.exitCode).toBe(1)
    expect(failed.report).toContain('@fx/beta . volume: removed')

    // beta is 1.2.0, so only a major changeset declares it.
    const changesets = { 'beta.md': "---\n'@fx/beta': major\n---\n\nRemoves volume.\n" }
    expect(run(dir, { baseReport, changesets }).exitCode).toBe(0)
  })

  it('reports a break in a private package without asking for a changeset, which could not name it', () => {
    const dir = reportsDir()
    run(dir, { update: true })
    // alpha is private: check-changesets rejects a changeset naming it, so its breaks are shown, not gated.
    const base = `${readFileSync(join(dir, 'alpha.api.md'), 'utf8')}\n### \`volume\` (function)\n\n\`\`\`ts\nfunction volume(): number;\n\`\`\`\n`
    const result = run(dir, { baseReport: (file) => (file === 'alpha.api.md' ? base : undefined) })
    expect(result.exitCode).toBe(0)
    expect(result.report[0]).toBe('2 core packages; 1 API breaks against the base, 0 undeclared')
    expect(result.report).toContain('@fx/alpha ./sub volume: removed (private, so no changeset is needed)')
  })
})
