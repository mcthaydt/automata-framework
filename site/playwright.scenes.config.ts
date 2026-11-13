import { defineConfig, devices } from '@playwright/test'
import { claimPorts } from '../packages/tools/src/shared/ship/ports/free-ports.ts'

// The 3D example page, proved on fixtures: `pnpm test:e2e:scenes` builds the site from tests/fixtures/scene-examples
// (scripts/build-scene-fixture.ts, after a `pnpm build`) and runs tests/e2e/scene-examples.e2e.ts against it. The main
// suite (playwright.config.ts) runs against the real build, which has no 3D example, so it leaves that file out.
const ports = claimPorts(['site-scenes'])
export const SCENES_PORT: number = ports['site-scenes']

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: 'scene-examples.e2e.ts',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: 2,
  reporter: [['list']],
  use: { baseURL: `http://127.0.0.1:${SCENES_PORT}`, trace: 'retain-on-failure', reducedMotion: 'reduce' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], deviceScaleFactor: 1 } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], deviceScaleFactor: 1 } },
  ],
  webServer: {
    command: `node scripts/serve-static.ts build-scenes ${SCENES_PORT}`,
    url: `http://127.0.0.1:${SCENES_PORT}/`,
    reuseExistingServer: false,
  },
})
