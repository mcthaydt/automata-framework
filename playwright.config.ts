import { defineConfig, devices } from '@playwright/test'
import * as base2d from './examples/base-2d/e2e/origins.ts'
import * as contentDemo from './examples/content/hot-reload/e2e/origin.ts'
import { demoHostOrigin, demoHostPort } from './examples/demo-host/ports.ts'
import * as hostDemo from './examples/host/lifecycle-and-saves/e2e/origin.ts'
import * as physicsDemo from './examples/physics/bodies-2d/e2e/origin.ts'
import { gameBuildPath, gamePort, gameUrl, hostOrigin, hostPort } from './examples/placeholder/e2e/origins.ts'
import * as runtimeDemo from './examples/runtime/boot-and-flow/e2e/origin.ts'
import { demoPort, demoUrl } from './examples/ui/primitives/e2e/origin.ts'

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
    { name: 'ui-primitives', testDir: 'examples/ui/primitives/e2e', use: { ...devices['Pixel 7'] } },
    // The feature demos on base-2d, each under the shared fake host (examples/demo-host).
    {
      name: 'demos',
      testDir: 'examples',
      testMatch: [
        'host/*/e2e/*.e2e.ts',
        'content/*/e2e/*.e2e.ts',
        'physics/*/e2e/*.e2e.ts',
        'runtime/*/e2e/*.e2e.ts',
      ],
      use: { ...devices['Pixel 7'] },
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
    {
      command: `pnpm --filter @af-examples/ui-primitives e2e:demo --port ${demoPort}`,
      url: demoUrl,
      reuseExistingServer: process.env.CI === undefined,
    },
    {
      command: 'pnpm --filter @af-examples/demo-host e2e:host',
      url: `${demoHostOrigin}/`,
      env: { AF_E2E_DEMO_HOST_PORT: String(demoHostPort) },
      reuseExistingServer: process.env.CI === undefined,
    },
    {
      command: 'pnpm --filter @af-examples/host-lifecycle-and-saves e2e:demo',
      url: hostDemo.url,
      env: { AF_E2E_DEMO_PORT: String(hostDemo.port) },
      reuseExistingServer: process.env.CI === undefined,
    },
    {
      command: 'pnpm --filter @af-examples/content-hot-reload e2e:demo',
      url: contentDemo.url,
      env: { AF_E2E_DEMO_PORT: String(contentDemo.port) },
      reuseExistingServer: process.env.CI === undefined,
    },
    {
      command: 'pnpm --filter @af-examples/physics-bodies-2d e2e:demo',
      url: physicsDemo.url,
      env: { AF_E2E_DEMO_PORT: String(physicsDemo.port) },
      reuseExistingServer: process.env.CI === undefined,
    },
    {
      command: 'pnpm --filter @af-examples/runtime-boot-and-flow e2e:demo',
      url: runtimeDemo.url,
      env: { AF_E2E_DEMO_PORT: String(runtimeDemo.port) },
      reuseExistingServer: process.env.CI === undefined,
    },
    {
      // The dev server, for the hot-reload check. Never reused: it must compile this run's copy of content/.
      command: 'pnpm --filter @af-examples/content-hot-reload e2e:dev',
      url: contentDemo.devUrl,
      env: { AF_E2E_DEMO_PORT: String(contentDemo.devPort) },
      reuseExistingServer: false,
    },
  ],
})
