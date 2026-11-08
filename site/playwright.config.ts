import { defineConfig, devices } from '@playwright/test'
import { portsFor } from '../packages/tools/src/shared/ship/ports/ports-for.ts'

// QB.3 browser gates. They run against the prerendered build (`pnpm build` first) and a folder of planted fixtures,
// each on its own port, 50 to 59 above the checkout's server port (portsFor, so AF_RUNNER_PORT_OFFSET moves them with
// the runner copy); override them when another checkout uses them.
const ports = portsFor(new URL('..', import.meta.url).pathname, process.env)
export const SITE_PORT = Number(process.env.QB_SITE_PORT ?? ports.server + 50)
export const FIXTURE_PORT = Number(process.env.QB_FIXTURE_PORT ?? ports.server + 51)

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: process.env.QB_E2E_WORKERS ? Number(process.env.QB_E2E_WORKERS) : 2,
  reporter: [['list']],
  use: { baseURL: `http://127.0.0.1:${SITE_PORT}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], deviceScaleFactor: 1 } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], deviceScaleFactor: 1 } },
  ],
  webServer: [
    // Never reuse a server: a process already on the port may belong to another checkout and serve another build.
    {
      command: `node scripts/serve-static.ts build ${SITE_PORT}`,
      url: `http://127.0.0.1:${SITE_PORT}/`,
      reuseExistingServer: false,
    },
    {
      command: `node scripts/serve-static.ts tests/e2e/fixtures ${FIXTURE_PORT}`,
      url: `http://127.0.0.1:${FIXTURE_PORT}/good.html`,
      reuseExistingServer: false,
    },
  ],
})
