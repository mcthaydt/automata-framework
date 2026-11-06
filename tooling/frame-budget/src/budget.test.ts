import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { BudgetFile, checkFiles, checkFrameBudget, FrameBudgetResult, isSoftwareGpu } from './budget.ts'

const read = (path: string): unknown => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const repoBudget = read('../budget.json')
const unsetBudget = { status: 'unset', note: 'No frame budget yet.' }
const setBudget = read('./fixtures/budget-set.json')
const within = read('./fixtures/result-within.json') as Record<string, unknown>
const overBudget = read('./fixtures/result-over-budget.json')
const swiftshader = read('./fixtures/result-swiftshader.json')

const withEnvironment = (changes: Record<string, unknown>): unknown => ({
  ...within,
  environment: { ...(within.environment as object), ...changes },
})

describe('checkFrameBudget', () => {
  it('fails closed with UNSET while a repository has no budget (set from the first GPU-runner run)', () => {
    const verdict = checkFrameBudget(unsetBudget, [within])
    expect(verdict.verdict).toBe('unset')
    expect(verdict.lines.join('\n')).toContain('UNSET')
  })

  it('fails on a planted over-budget result, naming the project and each metric over', () => {
    const verdict = checkFrameBudget(setBudget, [overBudget])
    expect(verdict.verdict).toBe('over')
    expect(verdict.lines).toEqual([
      'OVER frame-budget-phone: work p95 12.50 ms/frame (budget 6.00 ms)',
      'OVER frame-budget-phone: interval p95 33.40 ms/frame (budget 20.00 ms)',
    ])
  })

  it('passes a result within its budget', () => {
    const verdict = checkFrameBudget(setBudget, [within])
    expect(verdict.verdict).toBe('pass')
    expect(verdict.lines).toEqual([
      'ok frame-budget-phone: work p95 4.00 ms/frame (budget 6.00 ms), interval p95 16.90 ms/frame (budget 20.00 ms)',
    ])
  })

  it('never compares a software-rendered result (SwiftShader, llvmpipe): when all are software, it is skipped', () => {
    const llvmpipe = withEnvironment({ gpu: 'llvmpipe (LLVM 17.0.6, 256 bits)' })
    const skipped = checkFrameBudget(setBudget, [llvmpipe])
    expect(skipped.verdict).toBe('skipped')
    expect(skipped.lines).toEqual([
      'skipped: drawn by a software renderer (llvmpipe (LLVM 17.0.6, 256 bits)), so the frame budget cannot be measured here',
    ])
    expect(checkFrameBudget(setBudget, [swiftshader]).verdict).toBe('skipped')
  })

  it('does not let a software renderer hide a budget that is unset or a result that is broken', () => {
    const unset = checkFrameBudget(unsetBudget, [swiftshader])
    expect(unset.verdict).toBe('unset')
    expect(unset.lines.join('\n')).toContain('software renderer')
    expect(checkFrameBudget({ status: 'broken' }, [swiftshader]).verdict).toBe('invalid')
    expect(checkFrameBudget(setBudget, [swiftshader, { nonsense: true }]).verdict).toBe('invalid')
  })

  it('still calls a software result next to a hardware one not comparable, since only an all-software run is skipped', () => {
    const mixed = checkFrameBudget(setBudget, [swiftshader, within])
    expect(mixed.verdict).toBe('not-comparable')
  })

  it('refuses a budget recorded on a software renderer', () => {
    const softwareBudget = { ...(setBudget as object), gpu: 'SwiftShader Device' }
    const verdict = checkFrameBudget(softwareBudget, [within])
    expect(verdict.verdict).toBe('invalid')
    expect(verdict.lines.join('\n')).toContain('budget was recorded on a software renderer')
  })

  it('does not compare a result from another GPU than the budget was recorded on', () => {
    const verdict = checkFrameBudget(setBudget, [withEnvironment({ gpu: 'ANGLE (AMD, Radeon 780M)' })])
    expect(verdict.verdict).toBe('not-comparable')
    expect(verdict.lines.join('\n')).toContain('ANGLE (AMD, Radeon 780M)')
  })

  it('counts a metric that was not measured (null in JSON, from NaN) as invalid, never a pass', () => {
    const empty = { ...within, workMs: { count: 0, mean: null, p50: null, p95: null, p99: null, max: null } }
    const verdict = checkFrameBudget(setBudget, [empty])
    expect(verdict.verdict).toBe('invalid')
    expect(verdict.lines.join('\n')).toContain('work p95 was not measured')
  })

  it('is invalid when a budgeted project has no result, or a result has no budget', () => {
    const desktop = { ...within, project: 'frame-budget-desktop' }
    expect(checkFrameBudget(setBudget, [desktop]).lines).toEqual([
      'INVALID frame-budget-desktop: no budget recorded for this project',
      'INVALID frame-budget-phone: no result for this budgeted project',
    ])
  })

  it('is invalid with no results or a malformed result or budget', () => {
    expect(checkFrameBudget(setBudget, []).verdict).toBe('invalid')
    expect(checkFrameBudget(setBudget, [{ project: 'x' }]).verdict).toBe('invalid')
    expect(checkFrameBudget({ status: 'maybe' }, [within]).verdict).toBe('invalid')
  })
})

describe('checkFiles', () => {
  it('reads every *.json result in a folder, and a missing folder is invalid', () => {
    const dir = mkdtempSync(join(tmpdir(), 'frame-budget-'))
    try {
      const budgetPath = join(dir, 'budget.json')
      writeFileSync(budgetPath, JSON.stringify(setBudget))
      const results = join(dir, 'results')
      expect(checkFiles(budgetPath, results).verdict).toBe('invalid')
      // mkdtemp's folder doubles as a results folder holding only the planted over-budget result.
      const planted = mkdtempSync(join(tmpdir(), 'frame-budget-results-'))
      writeFileSync(join(planted, 'frame-budget-phone.json'), JSON.stringify(overBudget))
      expect(checkFiles(budgetPath, planted).verdict).toBe('over')
      rmSync(planted, { recursive: true, force: true })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

// The budget the Owner can veto (Orchestrator answer automata/inbox/2026-10-23-0248-hub-answers-website-filter.md,
// item 4): set from the lowest-noise run on the Mac, 25% over its p95, and labelled as measured under CI load.
describe("the repository's recorded budget", () => {
  /** The recorded budget and the results it was set from; a budget that is not set fails the test that asks. */
  function recorded() {
    const budget = BudgetFile.parse(repoBudget)
    if (budget.status !== 'set') throw new Error('tooling/frame-budget/budget.json is not set')
    const evidenceDir = fileURLToPath(new URL(`../../../${budget.evidence.result}`, import.meta.url))
    const evidence = readdirSync(evidenceDir)
      .filter((name) => name.endsWith('.json'))
      .sort()
      .map((name) => FrameBudgetResult.parse(JSON.parse(readFileSync(join(evidenceDir, name), 'utf8'))))
    return { budget, evidence }
  }

  it('is labelled as measured under CI load, so a quiet run can replace it', () => {
    expect(recorded().budget.note).toContain('measured under CI load')
  })

  it('comes from a hardware GPU, and every result in its evidence was measured on it at its commit', () => {
    const { budget, evidence } = recorded()
    expect(isSoftwareGpu(budget.gpu)).toBe(false)
    expect(evidence.map((result) => result.project)).toEqual(Object.keys(budget.projects).sort())
    for (const result of evidence) {
      expect(result.environment.gpu).toBe(budget.gpu)
      expect(result.environment.commit).toBe(budget.evidence.commit)
    }
  })

  it('is each p95 of the evidence times the headroom, rounded up to 0.01 ms', () => {
    const { budget, evidence } = recorded()
    // The small subtraction keeps 12.7499999... times 100 from rounding up to 12.76.
    const roundedUp = (p95: number | null): number =>
      Math.ceil((p95 as number) * budget.evidence.headroom * 100 - 1e-6) / 100
    for (const result of evidence) {
      expect(budget.projects[result.project]).toEqual({
        workMsP95: roundedUp(result.workMs.p95),
        intervalMsP95: roundedUp(result.intervalMs.p95),
      })
    }
  })

  it('passes its own evidence, so the nightly starts green on the Mac that measured it', () => {
    const { budget, evidence } = recorded()
    const outcome = checkFrameBudget(budget, evidence)
    expect(outcome.lines).toHaveLength(evidence.length)
    expect(outcome.verdict).toBe('pass')
  })
})
