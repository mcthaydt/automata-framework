import { describe, expect, it } from 'vitest'
import { stressPort } from './origin.ts'
import { e2eWorkers, selectRun } from './playwright-run.ts'

const journeys = {
  testMatch: '**/*.e2e.ts',
  projects: [{ name: 'placeholder', testDir: 'examples/placeholder/e2e' }],
  webServer: [{ command: 'pnpm --filter @af-examples/placeholder e2e:game', url: 'http://localhost:1/' }],
}

describe('selectRun: journeys by default, the frame-budget probe alone on request', () => {
  it('leaves the default `pnpm test:e2e` selection exactly as it was, with no frame-budget project', () => {
    for (const env of [{}, { AF_FRAME_BUDGET: '0' }, { AF_FRAME_BUDGET: '' }]) {
      const run = selectRun(env, journeys)
      expect(run).toEqual(journeys)
      expect(run.projects?.map((project) => project.name)).not.toContain('frame-budget-phone')
    }
  })

  it('with AF_FRAME_BUDGET=1 runs only the frame-budget projects, one worker, against this checkout’s own build', () => {
    const run = selectRun({ AF_FRAME_BUDGET: '1' }, journeys)
    expect(run.testMatch).toBe('**/*.e2e.ts')
    expect(run.projects?.map((project) => project.name)).toEqual([
      'frame-budget-phone',
      'frame-budget-desktop',
    ])
    for (const project of run.projects ?? []) {
      expect(project.testDir).toBe('tooling/frame-budget/e2e')
      // Full Chromium in new headless keeps the GPU; Playwright's default headless shell draws WebGL through
      // SwiftShader (FloorFifty ac72660 playwright.config.ts, `gpuChromium`).
      expect(project.use?.channel).toBe('chromium')
    }
    expect(run.workers).toBe(1)
    expect(run.webServer).toEqual([
      {
        command: 'pnpm --filter @mcthaydt/frame-budget e2e:stress',
        url: `http://localhost:${stressPort}/`,
        env: { AF_FRAME_BUDGET_PORT: String(stressPort) },
        reuseExistingServer: false,
      },
    ])
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

  it('is applied to the journeys by selectRun, and never to the frame-budget probe’s one worker', () => {
    expect(selectRun({ CI: 'true' }, journeys).workers).toBe(2)
    expect(selectRun({ CI: 'true', AF_E2E_WORKERS: '3' }, journeys).workers).toBe(3)
    expect(selectRun({}, journeys).workers).toBeUndefined()
    expect(selectRun({ CI: 'true', AF_FRAME_BUDGET: '1', AF_E2E_WORKERS: '4' }, journeys).workers).toBe(1)
  })
})
