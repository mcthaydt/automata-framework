import { demoHostOrigin, demoHostPort, examples3dPort } from '@automata/examples-runner/host/ports'
import { defineJourneys } from '@automata/playwright-preset'
import { devices } from '@playwright/test'

// The 3D examples' journeys (render3d and figures): `pnpm test:e2e` in this folder, run by the 3D
// workflow (.github/workflows/3d.yml), never by the 2D gate. Chromium, and WebKit because the Owner's iPad
// is WebKit; headless Firefox has no WebGL here. Each example is framed by the shared fake host.

const reuse = process.env.CI === undefined

export default defineJourneys({
  projects: [
    { name: 'examples-3d', testDir: 'tests/e2e', use: devices['Pixel 7 landscape'] },
    { name: 'examples-3d-webkit', testDir: 'tests/e2e', use: devices['iPhone 14 landscape'] },
  ],
  webServer: [
    {
      command: 'pnpm --filter @automata/examples-runner e2e:host',
      url: `${demoHostOrigin}/`,
      env: { AF_E2E_DEMO_HOST_PORT: String(demoHostPort) },
      reuseExistingServer: reuse,
    },
    {
      command: 'pnpm e2e:examples',
      url: `http://localhost:${examples3dPort}/`,
      env: { AF_E2E_EXAMPLES_PORT: String(examples3dPort) },
      reuseExistingServer: reuse,
    },
  ],
})
