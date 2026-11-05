import { demoHostOrigin, demoHostPort, examplesPort } from '@mcthaydt/examples-runner/host/ports'
import { defineJourneys } from '@mcthaydt/playwright-preset'
import { devices } from '@playwright/test'
import { gameBuildPath, gamePort, gameUrl } from './e2e/origin.ts'

// The 3D journeys: `pnpm test:e2e` in this folder. The base 3D game and the 3D examples (render3d-*, figures-*)
// run here, not in the 2D gate; the 3D and editors workflow runs them (.github/workflows/3d-and-editors.yml).

const reuse = process.env.CI === undefined

export default defineJourneys({
  projects: [
    // The base 3D game is landscape only (M3.7b): a phone held sideways at the 844 × 390 the game is sized for.
    {
      name: 'base-3d',
      testDir: 'e2e',
      use: { ...devices['Pixel 7 landscape'], viewport: { width: 844, height: 390 } },
    },
    // The 3D examples (render3d, and figures since M3.5d) in WebKit too (M3.4a): headless Firefox here has no WebGL.
    {
      name: 'examples-webkit',
      testDir: '../../examples/e2e',
      testMatch: ['render3d-*.e2e.ts', 'figures-*.e2e.ts'],
      use: { ...devices['iPhone 14 landscape'] },
    },
  ],
  webServer: [
    {
      // Framed by the shared demo host (AF_E2E_HOST_ORIGIN is the origin its CSP lets frame it).
      command: 'pnpm e2e:game',
      url: gameUrl,
      env: {
        AF_E2E_PREVIEW_PORT: String(gamePort),
        AF_E2E_GAME_PATH: gameBuildPath,
        AF_E2E_HOST_ORIGIN: demoHostOrigin,
      },
      reuseExistingServer: reuse,
    },
    {
      command: 'pnpm --filter @mcthaydt/examples-runner e2e:host',
      url: `${demoHostOrigin}/`,
      env: { AF_E2E_DEMO_HOST_PORT: String(demoHostPort) },
      reuseExistingServer: reuse,
    },
    {
      command: 'pnpm --filter @af-examples/examples e2e:examples',
      url: `http://localhost:${examplesPort}/`,
      env: { AF_E2E_EXAMPLES_PORT: String(examplesPort) },
      reuseExistingServer: reuse,
    },
  ],
})
