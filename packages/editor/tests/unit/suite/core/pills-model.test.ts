import { describe, expect, test } from 'vitest'
import { checksPill, problemWords } from '#src/features/suite/core/pills-model.ts'
import type { CheckReport } from '#src/shared/kit/ports/suite-ports.ts'

const run = (
  check: string,
  status: CheckReport['status'],
  extra: Partial<CheckReport> = {},
): CheckReport => ({
  check,
  status,
  findings: [],
  ...extra,
})

describe('the checks pill', () => {
  test('idle with no run, running while checks run', () => {
    expect(checksPill({ running: false, checks: [] })).toMatchObject({
      tone: 'neutral',
      label: 'No checks run',
      count: 0,
    })
    expect(checksPill({ running: true, checks: [run('lint', 'pass')] })).toMatchObject({
      tone: 'running',
      label: 'Checks running',
    })
  })

  test('the worst status wins: pass, warn, error and fail', () => {
    expect(checksPill({ running: false, checks: [run('a', 'pass'), run('b', 'pass')] })).toMatchObject({
      tone: 'pass',
      label: 'Checks pass',
      count: 2,
    })
    expect(checksPill({ running: false, checks: [run('a', 'pass'), run('b', 'warn')] })).toMatchObject({
      tone: 'warn',
      label: 'b warns',
      count: 1,
    })
    expect(checksPill({ running: false, checks: [run('a', 'error'), run('b', 'warn')] })).toMatchObject({
      tone: 'error',
      label: 'a could not run',
    })
  })

  test('an after check failing is red with the failing check first and its finding for Locate (EDS-h)', () => {
    const finding = { path: 'content/tuning.toml', line: 2, severity: 'error' as const, message: 'too fast' }
    const pill = checksPill({
      running: false,
      checks: [run('fair', 'pass'), run('lint', 'fail', { findings: [finding] }), run('speed', 'fail')],
    })
    expect(pill).toMatchObject({ tone: 'fail', label: 'lint failed', count: 2, icon: 'checks' })
    expect(pill.items.map((item) => [item.id, item.tone])).toEqual([
      ['lint', 'fail'],
      ['speed', 'fail'],
      ['fair', 'pass'],
    ])
    expect(pill.items[0]?.finding).toEqual(finding)
  })
})

describe('what the header says of the checks', () => {
  // Spec 7.4: one short phrase for each state the checks can be in, the findings counted one by one.
  const finding: CheckReport['findings'][number] = { severity: 'error', message: 'wrong', path: 'a.toml' }
  const words = (running: boolean, checks: CheckReport[]) => problemWords(checksPill({ running, checks }))

  test('checking, not checked yet, no problems and could not check', () => {
    expect(words(true, [])).toBe('Checking…')
    expect(words(false, [])).toBe('Not checked yet')
    expect(words(false, [run('a', 'pass')])).toBe('No problems')
    expect(words(false, [run('a', 'error')])).toBe("Couldn't check")
  })

  test('warnings and failures say how many findings, one by one', () => {
    expect(words(false, [run('a', 'warn', { findings: [finding] })])).toBe('1 problem')
    expect(
      words(false, [
        run('a', 'fail', { findings: [finding, finding] }),
        run('b', 'warn', { findings: [finding] }),
      ]),
    ).toBe('3 problems')
  })

  test('a check that failed without a finding is still one problem', () => {
    expect(words(false, [run('a', 'fail')])).toBe('1 problem')
  })
})
