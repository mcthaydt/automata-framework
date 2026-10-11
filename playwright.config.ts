import { defineConfig, devices } from '@playwright/test'
import { gameOrigin, gamePort, hostOrigin, hostPort } from './examples/placeholder/e2e/origins.ts'

// Browser journeys for every AF example (ship spec §3.7): `pnpm test:e2e [playwright args]`. CI runs them
// nightly and on request (`automata-ship test-remote <spec>`). Each example adds a project and the servers it
// needs. Playwright exits non-zero when no test matches, so a journey run that selects nothing is red.

const ports = { AF_E2E_PREVIEW_PORT: String(gamePort), AF_E2E_SERVER_PORT: String(hostPort) }

export default defineConfig({
  testMatch: '**/*.e2e.ts',
  forbidOnly: process.env.CI !== undefined,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: { trace: 'retain-on-failure' },
  projects: [
    // Phone first (AGENTS.md, Responsive UI).
    { name: 'placeholder', testDir: 'examples/placeholder/e2e', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: 'pnpm --filter @af-examples/placeholder e2e:game',
      url: `${gameOrigin}/`,
      env: ports,
      reuseExistingServer: process.env.CI === undefined,
    },
    {
      command: 'pnpm --filter @af-examples/placeholder e2e:host',
      url: `${hostOrigin}/`,
      env: ports,
      reuseExistingServer: process.env.CI === undefined,
    },
  ],
})
