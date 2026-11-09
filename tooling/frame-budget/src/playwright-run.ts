import { devices, type PlaywrightTestConfig } from '@playwright/test'
import { stressPort, stressUrl } from './origin.ts'

type Project = NonNullable<PlaywrightTestConfig['projects']>[number]

// Full Chromium in its new headless mode keeps the GPU; Playwright's default headless shell rasterizes WebGL
// through SwiftShader and measures software, not the game.
const gpuChromium = (device: string): NonNullable<Project['use']> => ({
  ...devices[device],
  channel: 'chromium',
})

/**
 * The probe's projects: phone first (AGENTS.md), then a desktop window, each its own project so a failure names
 * the size it failed at.
 */
const frameBudgetProjects: Project[] = [
  { name: 'frame-budget-phone', testDir: 'tests/e2e', use: gpuChromium('Pixel 7') },
  {
    name: 'frame-budget-desktop',
    testDir: 'tests/e2e',
    use: { ...gpuChromium('Desktop Chrome'), viewport: { width: 1280, height: 720 } },
  },
  // The 3D look: Wick in a room with every core pass on, on a Pixel 7 and in a window the size of an iPad's.
  { name: 'frame-budget-3d-phone', testDir: 'tests/e2e', use: gpuChromium('Pixel 7') },
  {
    name: 'frame-budget-3d-ipad',
    testDir: 'tests/e2e',
    use: { ...gpuChromium('Desktop Chrome'), viewport: { width: 1194, height: 834 } },
  },
]

/**
 * What `playwright.config.ts` runs: the frame-budget projects, one worker and one server. A probe needs the GPU to
 * itself (AGENTS.md), and a p95 measured beside three other WebGL clients was 46.1 ms against 17.9 ms
 * alone on the same build. The stress server is never reused, so the probe always measures this checkout's fresh
 * production build. `journeys` carries the settings every config shares (`defineJourneys`).
 */
export function frameBudgetRun(journeys: PlaywrightTestConfig): PlaywrightTestConfig {
  return {
    ...journeys,
    projects: frameBudgetProjects,
    webServer: [
      {
        command: 'pnpm e2e:stress',
        url: stressUrl,
        env: { AF_FRAME_BUDGET_PORT: String(stressPort) },
        reuseExistingServer: false,
      },
    ],
    workers: 1,
  }
}
