import { describe, expect, it } from 'vitest'
import { stressPort } from '#src/origin.ts'
import { frameBudgetRun } from '#src/playwright-run.ts'

const shared = { testMatch: '**/*.e2e.ts', retries: 0 }

describe('frameBudgetRun: the frame-budget probe alone', () => {
  it('keeps the shared settings and swaps in only the frame-budget projects, one worker, this checkout’s own build', () => {
    const run = frameBudgetRun(shared)
    expect(run.testMatch).toBe('**/*.e2e.ts')
    expect(run.retries).toBe(0)
    expect(run.projects?.map((project) => project.name)).toEqual([
      'frame-budget-phone',
      'frame-budget-desktop',
    ])
    for (const project of run.projects ?? []) {
      expect(project.testDir).toBe('tests/e2e')
      // Full Chromium in new headless keeps the GPU; Playwright's default headless shell draws WebGL through
      // SwiftShader (FloorFifty ac72660 playwright.config.ts, `gpuChromium`).
      expect(project.use?.channel).toBe('chromium')
    }
    expect(run.workers).toBe(1)
    expect(run.webServer).toEqual([
      {
        command: 'pnpm e2e:stress',
        url: `http://localhost:${stressPort}/`,
        env: { AF_FRAME_BUDGET_PORT: String(stressPort) },
        reuseExistingServer: false,
      },
    ])
  })

  it('stays at one worker even when the shared settings ask for more', () => {
    expect(frameBudgetRun({ ...shared, workers: 4 }).workers).toBe(1)
  })
})
