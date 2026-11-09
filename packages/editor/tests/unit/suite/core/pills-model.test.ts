import { describe, expect, test } from 'vitest'
import { checksPill, pillsToShow } from '#src/features/suite/core/pills-model.ts'
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

describe('the pills the top bar shows', () => {
  // The grandma audit (6.1): a pill that has nothing to say ("No checks run") is clutter a person cannot act on, so it
  // stays hidden until it means something.
  test('only the pills with something to say', () => {
    expect(pillsToShow([checksPill({ running: false, checks: [] })])).toEqual([])
    expect(pillsToShow([checksPill({ running: true, checks: [] })]).map((pill) => pill.label)).toEqual([
      'Checks running',
    ])
  })
})
