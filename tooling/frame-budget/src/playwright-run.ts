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

/**
 * What `playwright.config.ts` runs. By default the browser journeys, unchanged. With `AF_FRAME_BUDGET=1` the
 * frame-budget projects alone, one worker and one server: a probe needs the GPU to itself (AGENTS.md), and
 * FloorFifty measured a p95 of 46.1 ms beside three other WebGL clients against 17.9 ms alone on the same build.
 * The stress server is never reused, so the probe always measures this checkout's fresh production build.
 */
export function selectRun(
  env: Readonly<Record<string, string | undefined>>,
  journeys: PlaywrightTestConfig,
): PlaywrightTestConfig {
  if (env.AF_FRAME_BUDGET !== '1') return journeys
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
