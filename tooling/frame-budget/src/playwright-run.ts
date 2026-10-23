import { devices, type PlaywrightTestConfig } from '@playwright/test'
import { stressPort, stressUrl } from './origin.ts'

type Project = NonNullable<PlaywrightTestConfig['projects']>[number]

// Full Chromium in its new headless mode keeps the GPU; Playwright's default headless shell rasterizes WebGL
// through SwiftShader and measures software, not the game (FloorFifty ac72660, playwright.config.ts `gpuChromium`).
const gpuChromium = (device: string): NonNullable<Project['use']> => ({
  ...devices[device],
  channel: 'chromium',
})

/**
 * The probe's projects: phone first (AGENTS.md), then a desktop window, each its own project so a failure names
 * the size it failed at (FloorFifty's frame-budget projects at ac72660).
 */
const frameBudgetProjects: Project[] = [
  { name: 'frame-budget-phone', testDir: 'tooling/frame-budget/e2e', use: gpuChromium('Pixel 7') },
  {
    name: 'frame-budget-desktop',
    testDir: 'tooling/frame-budget/e2e',
    use: { ...gpuChromium('Desktop Chrome'), viewport: { width: 1280, height: 720 } },
  },
]

type Env = Readonly<Record<string, string | undefined>>

/**
 * How many workers the journeys start. Playwright's default is half the cores, which on the Owner's Mac (three CI
 * runners on one M1) is about four browsers per job, and three jobs at once left every failure a 30 s timeout
 * (hub, 2026-10-23). So CI gets two workers, a developer keeps Playwright's default (`undefined`), and
 * `AF_E2E_WORKERS` overrides both. A value that is not a positive integer throws: `Number('two')` would reach
 * Playwright as `NaN`.
 */
export function e2eWorkers(env: Env): number | undefined {
  const requested = env.AF_E2E_WORKERS
  if (requested === undefined || requested === '') return env.CI ? 2 : undefined
  const workers = Number(requested)
  if (!Number.isInteger(workers) || workers < 1)
    throw new Error(`AF_E2E_WORKERS must be a positive integer, got "${requested}"`)
  return workers
}

/**
 * What `playwright.config.ts` runs. By default the browser journeys, with `e2eWorkers` workers. With
 * `AF_FRAME_BUDGET=1` the frame-budget projects alone, one worker and one server: a probe needs the GPU to itself
 * (AGENTS.md), and FloorFifty measured a p95 of 46.1 ms beside three other WebGL clients against 17.9 ms alone on the
 * same build. The stress server is never reused, so the probe always measures this checkout's fresh production
 * build.
 */
export function selectRun(env: Env, journeys: PlaywrightTestConfig): PlaywrightTestConfig {
  if (env.AF_FRAME_BUDGET !== '1') {
    const workers = e2eWorkers(env)
    return workers === undefined ? journeys : { ...journeys, workers }
  }
  return {
    ...journeys,
    projects: frameBudgetProjects,
    webServer: [
      {
        command: 'pnpm --filter @mcthaydt/frame-budget e2e:stress',
        url: stressUrl,
        env: { AF_FRAME_BUDGET_PORT: String(stressPort) },
        reuseExistingServer: false,
      },
    ],
    workers: 1,
  }
}
