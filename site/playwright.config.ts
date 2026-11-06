import { defineConfig, devices } from '@playwright/test'

// QB.3 browser gates. They run against the prerendered build (`pnpm build` first) and a folder of planted fixtures,
// each on its own port. 4650–4659 are this suite's ports; override them when another checkout uses them.
export const SITE_PORT = Number(process.env.QB_SITE_PORT ?? 4650)
export const FIXTURE_PORT = Number(process.env.QB_FIXTURE_PORT ?? 4651)

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
    { command: `node --import tsx scripts/serve-static.ts build ${SITE_PORT}`, url: `http://127.0.0.1:${SITE_PORT}/`, reuseExistingServer: false },
    { command: `node --import tsx scripts/serve-static.ts tests/e2e/fixtures ${FIXTURE_PORT}`, url: `http://127.0.0.1:${FIXTURE_PORT}/good.html`, reuseExistingServer: false },
  ],
})
