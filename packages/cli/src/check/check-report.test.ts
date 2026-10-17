import { describe, expect, it } from 'vitest'
import {
  type CheckReport,
  exitCodeFor,
  formatText,
  reportOf,
  type StepResult,
  toJson,
} from './check-report.ts'

const pass = (name: StepResult['name']): StepResult => ({
  name,
  ok: true,
  ms: 5,
  findings: [],
  toolError: false,
})
const finding = { file: 'src/sim/a.ts', line: 3, col: 7, rule: 'import', message: 'import of "effect"' }
const failed: StepResult = { name: 'boundaries', ok: false, ms: 9, findings: [finding], toolError: false }
const missing: StepResult = {
  name: 'test',
  ok: false,
  ms: 1,
  findings: [
    { file: '', line: 0, col: 0, rule: 'tool-missing', message: 'vitest not found; install vitest' },
  ],
  toolError: true,
}

describe('check report', () => {
  it('is ok only when every step is ok', () => {
    expect(reportOf([pass('boundaries'), pass('typecheck')]).ok).toBe(true)
    expect(reportOf([pass('typecheck'), failed]).ok).toBe(false)
  })

  it('prints exactly the spec JSON shape, with a tool error as a finding', () => {
    const json = JSON.parse(toJson(reportOf([failed, missing])))
    expect(json).toEqual({
      ok: false,
      steps: [
        { name: 'boundaries', ok: false, ms: 9, findings: [finding] },
        { name: 'test', ok: false, ms: 1, findings: [missing.findings[0]] },
      ],
    })
  })

  it('exits 0 on a pass, 1 on findings and 2 on any tool error', () => {
    expect(exitCodeFor(reportOf([pass('boundaries')]))).toBe(0)
    expect(exitCodeFor(reportOf([pass('boundaries'), failed]))).toBe(1)
    expect(exitCodeFor(reportOf([failed, missing]))).toBe(2)
  })

  it('an empty report is not a pass', () => {
    const empty: CheckReport = reportOf([])
    expect(empty.ok).toBe(false)
    expect(exitCodeFor(empty)).toBe(2)
  })

  it('formats each step and its findings for people', () => {
    const text = formatText(reportOf([pass('typecheck'), failed]))
    expect(text).toContain('pass  typecheck (5 ms)')
    expect(text).toContain('FAIL  boundaries (9 ms)')
    expect(text).toContain('src/sim/a.ts:3:7  import  import of "effect"')
    expect(text).toContain('automata check: 1 finding')
  })
})
