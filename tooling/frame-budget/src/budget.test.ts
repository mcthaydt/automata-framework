import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkFiles, checkFrameBudget } from './budget.ts'

const read = (path: string): unknown => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const repoBudget = read('../budget.json')
const setBudget = read('./fixtures/budget-set.json')
const within = read('./fixtures/result-within.json') as Record<string, unknown>
const overBudget = read('./fixtures/result-over-budget.json')
const swiftshader = read('./fixtures/result-swiftshader.json')

const withEnvironment = (changes: Record<string, unknown>): unknown => ({
  ...within,
  environment: { ...(within.environment as object), ...changes },
})

describe('checkFrameBudget', () => {
  it('fails closed with UNSET while the repository has no budget (set from the first GPU-runner run)', () => {
    const verdict = checkFrameBudget(repoBudget, [within])
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

  it('never compares a software-rendered result (SwiftShader, llvmpipe), with or without a budget', () => {
    expect(checkFrameBudget(setBudget, [swiftshader]).verdict).toBe('not-comparable')
    const llvmpipe = withEnvironment({ gpu: 'llvmpipe (LLVM 17.0.6, 256 bits)' })
    expect(checkFrameBudget(setBudget, [llvmpipe]).verdict).toBe('not-comparable')
    expect(checkFrameBudget(repoBudget, [swiftshader]).lines.join('\n')).toContain('software renderer')
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
