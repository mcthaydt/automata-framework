import { defineConfig, devices } from '@playwright/test'
import * as base2d from './examples/base-2d/e2e/origins.ts'
import { gameBuildPath, gamePort, gameUrl, hostOrigin, hostPort } from './examples/placeholder/e2e/origins.ts'

// Browser journeys for every AF example (ship spec §3.7): `pnpm test:e2e [playwright args]`. CI runs them
// nightly and on request (`automata-ship test-remote <spec>`). Each example adds a project and the servers it
// needs. Playwright exits non-zero when no test matches, so a journey run that selects nothing is red.

const ports = {
  AF_E2E_PREVIEW_PORT: String(gamePort),
  AF_E2E_SERVER_PORT: String(hostPort),
  AF_E2E_GAME_PATH: gameBuildPath,
}
const base2dPorts = {
  AF_E2E_PREVIEW_PORT: String(base2d.gamePort),
  AF_E2E_SERVER_PORT: String(base2d.hostPort),
  AF_E2E_GAME_PATH: base2d.gameBuildPath,
}

export default defineConfig({
  testMatch: '**/*.e2e.ts',
  forbidOnly: process.env.CI !== undefined,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: { trace: 'retain-on-failure' },
  projects: [
    // Phone first (AGENTS.md, Responsive UI).
    { name: 'placeholder', testDir: 'examples/placeholder/e2e', use: { ...devices['Pixel 7'] } },
    { name: 'base-2d', testDir: 'examples/base-2d/e2e', use: { ...devices['Pixel 7'] } },
    // A landscape phone at the compact height every layout must hold (780 × 270, AGENTS.md).
    {
      name: 'base-2d-compact',
      testDir: 'examples/base-2d/e2e',
      use: { ...devices['Pixel 7 landscape'], viewport: { width: 780, height: 270 } },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @af-examples/placeholder e2e:game',
      url: gameUrl,
      env: ports,
      reuseExistingServer: process.env.CI === undefined,
    },
    {
      command: 'pnpm --filter @af-examples/placeholder e2e:host',
      url: `${hostOrigin}/`,
      env: ports,
      reuseExistingServer: process.env.CI === undefined,
    },
    {
      command: 'pnpm --filter @af-examples/base-2d e2e:game',
      url: base2d.gameUrl,
      env: base2dPorts,
      reuseExistingServer: process.env.CI === undefined,
    },
    {
      command: 'pnpm --filter @af-examples/base-2d e2e:host',
      url: `${base2d.hostOrigin}/`,
      env: base2dPorts,
      reuseExistingServer: process.env.CI === undefined,
    },
  ],
})
