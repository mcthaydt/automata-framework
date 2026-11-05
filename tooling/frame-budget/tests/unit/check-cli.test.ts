import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'

// `pnpm budget:frame`, as the nightly job runs it. That job takes whatever runner it gets: a software renderer must
// not turn it red, but nothing else may pass quietly.
const cli = fileURLToPath(new URL('../../src/check-cli.ts', import.meta.url))
const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url))
const made: string[] = []
afterAll(() => {
  for (const dir of made) rmSync(dir, { recursive: true, force: true })
})

/**
 * Runs the check over a results folder holding copies of the named fixtures. `budget` is a fixture's name, or the
 * text of a budget file; left out, the repository's own budget.json is used.
 */
function run(results: readonly string[], budget?: string): { code: number | null; out: string } {
  const dir = mkdtempSync(join(tmpdir(), 'af-frame-budget-'))
  made.push(dir)
  for (const name of results) copyFileSync(fixture(name), join(dir, name))
  const args = [cli, dir]
  if (budget !== undefined) {
    const file = join(dir, 'budget')
    if (budget.endsWith('.json')) copyFileSync(fixture(budget), file)
    else writeFileSync(file, budget)
    args.push(file)
  }
  const done = spawnSync(process.execPath, args, { encoding: 'utf8' })
  return { code: done.status, out: done.stdout }
}

describe('budget:frame exit codes', () => {
  it('exits 0 and says skipped when every result was drawn by a software renderer', () => {
    const done = run(['result-swiftshader.json'], 'budget-set.json')
    expect(done.out).toContain('skipped: drawn by a software renderer')
    expect(done.out).toContain('frame budget: SKIPPED')
    expect(done.code).toBe(0)
  })

  it('exits 0 on a result within its budget, and 1 on one over it', () => {
    expect(run(['result-within.json'], 'budget-set.json').code).toBe(0)
    const over = run(['result-over-budget.json'], 'budget-set.json')
    expect(over.out).toContain('OVER')
    expect(over.code).toBe(1)
  })

  it('exits 1 while the budget is unset, even for a software renderer', () => {
    const unset = '{"status":"unset","note":"No frame budget yet."}'
    const hardware = run(['result-within.json'], unset)
    expect(hardware.out).toContain('UNSET')
    expect(hardware.code).toBe(1)
    expect(run(['result-swiftshader.json'], unset).code).toBe(1)
  })

  it('exits 1 with no results, and with a budget file that is not valid', () => {
    const none = run([], 'budget-set.json')
    expect(none.out).toContain('INVALID')
    expect(none.code).toBe(1)
    expect(run(['result-swiftshader.json'], '{"status":"broken"}').code).toBe(1)
  })
})
