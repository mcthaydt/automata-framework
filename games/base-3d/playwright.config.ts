import { base3dDevPort, demoHostOrigin, demoHostPort } from '@mcthaydt/examples-runner/host/ports'
import { defineJourneys } from '@mcthaydt/playwright-preset'
import { devices } from '@playwright/test'
import { JOURNEY_TIMEOUT_MS } from './e2e/budget.ts'
import { gameBuildPath, gamePort, gameUrl } from './e2e/origin.ts'

// The base 3D game's journeys: `pnpm test:e2e` in this folder, not in the 2D gate; the 3D workflow runs them
// (.github/workflows/3d.yml), with the 3D examples' own journeys (examples/3d).

const reuse = process.env.CI === undefined

export default defineJourneys({
  timeout: JOURNEY_TIMEOUT_MS,
  projects: [
    // The base 3D game is landscape only (M3.7b): a phone held sideways at the 844 × 390 the game is sized for.
    {
      name: 'base-3d',
      testDir: 'e2e',
      use: { ...devices['Pixel 7 landscape'], viewport: { width: 844, height: 390 } },
    },
    // The same game from its Vite dev server, in Chromium and WebKit (the Owner's iPad is WebKit).
    {
      name: 'base-3d-dev',
      testDir: 'tests/e2e-dev',
      use: { ...devices['Pixel 7 landscape'], viewport: { width: 844, height: 390 } },
    },
    {
      name: 'base-3d-dev-webkit',
      testDir: 'tests/e2e-dev',
      use: { ...devices['iPad (gen 7) landscape'] },
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
      command: `pnpm exec vite --configLoader runner --strictPort --port ${base3dDevPort}`,
      url: `http://localhost:${base3dDevPort}/`,
      reuseExistingServer: reuse,
    },
    {
      command: 'pnpm --filter @mcthaydt/examples-runner e2e:host',
      url: `${demoHostOrigin}/`,
      env: { AF_E2E_DEMO_HOST_PORT: String(demoHostPort) },
      reuseExistingServer: reuse,
    },
  ],
})
