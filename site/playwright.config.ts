import { defineConfig, devices } from '@playwright/test'
import { claimPorts } from '../packages/tools/src/shared/ship/ports/free-ports.ts'

// QB.3 browser gates. They run against the prerendered build (`pnpm build` first) and a folder of planted fixtures,
// each on a free port claimed when the config loads (packages/tools free-ports.ts), so two jobs on one machine never meet
// on one.
const ports = claimPorts(['site-build', 'site-fixtures'])
export const SITE_PORT: number = ports['site-build']
export const FIXTURE_PORT: number = ports['site-fixtures']

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: process.env.QB_E2E_WORKERS ? Number(process.env.QB_E2E_WORKERS) : 2,
  reporter: [['list']],
  // Reduced motion for every suite: the site's motion (smooth scrolling, the page settle, Home's reveals) would otherwise
  // hold content back for half a second while a test checks the finished page. `motion.e2e.ts` asks for motion itself.
  use: { baseURL: `http://127.0.0.1:${SITE_PORT}`, trace: 'retain-on-failure', reducedMotion: 'reduce' },
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
