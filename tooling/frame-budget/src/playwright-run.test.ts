import { describe, expect, it } from 'vitest'
import { stressPort } from './origin.ts'
import { selectRun } from './playwright-run.ts'

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
