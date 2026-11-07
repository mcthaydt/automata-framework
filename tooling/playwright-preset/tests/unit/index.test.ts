import { describe, expect, it } from 'vitest'
import { defineJourneys, e2eWorkers, sizes } from '#src/index.ts'

describe('sizes: where every 2D journey runs', () => {
  it('has a phone, the 780 × 270 compact height and an iPad', () => {
    expect(Object.keys(sizes)).toEqual(['phone', 'compact', 'ipad'])
    expect(sizes.compact.viewport).toEqual({ width: 780, height: 270 })
    expect(sizes.ipad.viewport.width).toBeGreaterThan(sizes.phone.viewport.width)
  })
})

// One Mac M1 runs three CI jobs at once (hub, 2026-10-23: load average up to 115, every failure a 30 s timeout), and
// Playwright's default of half the cores per job is four browsers each. CI therefore gets two workers; a developer
// keeps Playwright's default, and AF_E2E_WORKERS overrides both.
describe('e2eWorkers: the journeys’ worker count', () => {
  it('is two on CI and Playwright’s own default (undefined) elsewhere', () => {
    expect(e2eWorkers({ CI: 'true' })).toBe(2)
    expect(e2eWorkers({ CI: '1' })).toBe(2)
    expect(e2eWorkers({})).toBeUndefined()
  })

  it('takes AF_E2E_WORKERS over CI, and an empty AF_E2E_WORKERS counts as unset', () => {
    expect(e2eWorkers({ CI: 'true', AF_E2E_WORKERS: '4' })).toBe(4)
    expect(e2eWorkers({ AF_E2E_WORKERS: '1' })).toBe(1)
    expect(e2eWorkers({ CI: 'true', AF_E2E_WORKERS: '' })).toBe(2)
    expect(e2eWorkers({ AF_E2E_WORKERS: '' })).toBeUndefined()
  })

  it('refuses a worker count that is not a positive integer, instead of handing NaN to Playwright', () => {
    for (const value of ['0', '-1', '1.5', 'two', '2 workers'])
      expect(() => e2eWorkers({ AF_E2E_WORKERS: value }), value).toThrow(/AF_E2E_WORKERS/)
  })
})

describe('defineJourneys: the settings every config shares', () => {
  it('matches `.e2e.ts` files, runs files in parallel and keeps the trace of a failure', () => {
    const config = defineJourneys({}, {})
    expect(config.testMatch).toEqual(['**/*.e2e.ts', '**/*.test.ts'])
    expect(config.fullyParallel).toBe(true)
    expect(config.use?.trace).toBe('retain-on-failure')
  })

  it('on CI: one retry, no `test.only`, two workers and an HTML report', () => {
    const config = defineJourneys({}, { CI: 'true' })
    expect(config.retries).toBe(1)
    expect(config.forbidOnly).toBe(true)
    expect(config.workers).toBe(2)
    expect(config.reporter).toEqual([['list'], ['html', { open: 'never' }]])
  })

  it('on a developer machine: no retries, `test.only` allowed and Playwright’s default worker count', () => {
    const config = defineJourneys({}, {})
    expect(config.retries).toBe(0)
    expect(config.forbidOnly).toBe(false)
    expect(config).not.toHaveProperty('workers')
  })

  it('lets a config override a shared setting and add its own projects', () => {
    const config = defineJourneys({ retries: 3, projects: [{ name: 'one' }] }, { CI: 'true' })
    expect(config.retries).toBe(3)
    expect(config.projects?.map((project) => project.name)).toEqual(['one'])
  })
})
