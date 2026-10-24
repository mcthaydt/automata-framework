import { defineConfig, devices } from '@playwright/test'
import * as contentDemo from './examples/content/hot-reload/e2e/origin.ts'
import * as physicsDemo from './examples/physics/bodies-2d/e2e/origin.ts'
import { demoPort, demoUrl } from './examples/ui/primitives/e2e/origin.ts'
import * as base2d from './games/emberwick/e2e/origins.ts'
import { gameBuildPath, gamePort, gameUrl, hostOrigin, hostPort } from './games/placeholder/e2e/origins.ts'
import { INPUT_MATRIX } from './packages/testing/src/e2e/input-matrix.ts'
import {
  demoHostOrigin,
  demoHostPort,
  examplesPort,
  runnerFixturesPort,
} from './tooling/examples-runner/host/ports.ts'
import { selectRun } from './tooling/frame-budget/src/playwright-run.ts'

// Browser journeys for every AF example (ship spec §3.7): `pnpm test:e2e [playwright args]`. CI runs them
// nightly and on request (`automata-ship test-remote <spec>`). Each example adds a project and the servers it
// needs. Playwright exits non-zero when no test matches, so a journey run that selects nothing is red.
//
// `AF_FRAME_BUDGET=1` (`pnpm test:frame-budget`) swaps every journey for the frame-budget projects alone
// (tooling/frame-budget, PRODUCT.7): a performance probe needs the GPU to itself, so it never runs inside the
// default selection and the journeys never run beside it.

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

const EXAMPLES_SMOKE = ['examples/e2e/*.e2e.ts', 'tooling/examples-runner/e2e/*.e2e.ts']
const MATRIX_SPEC = 'examples/e2e/input-matrix.e2e.ts'

// The input × form-factor matrix (M4.10, M4 spec §9.1): a project per cell, in the cell's engine and viewport, with a
// touch screen for the touch cells. The spec reads its cell from the project's metadata.
const matrixProjects = INPUT_MATRIX.map((cell) => ({
  name: `matrix-${cell.id}`,
  testDir: '.',
  testMatch: MATRIX_SPEC,
  metadata: { cell },
  use: {
    browserName: cell.engine,
    viewport: cell.viewport,
    ...(cell.device === 'touch' ? { hasTouch: true, isMobile: cell.engine !== 'firefox' } : {}),
  },
}))

const journeys = defineConfig({
  testMatch: '**/*.e2e.ts',
  forbidOnly: process.env.CI !== undefined,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: { trace: 'retain-on-failure' },
  projects: [
    // Phone first (AGENTS.md, Responsive UI).
    { name: 'placeholder', testDir: 'games/placeholder/e2e', use: { ...devices['Pixel 7'] } },
    { name: 'base-2d', testDir: 'games/emberwick/e2e', use: { ...devices['Pixel 7'] } },
    // A landscape phone at the compact height every layout must hold (780 × 270, AGENTS.md).
    {
      name: 'base-2d-compact',
      testDir: 'games/emberwick/e2e',
      use: { ...devices['Pixel 7 landscape'], viewport: { width: 780, height: 270 } },
    },
    { name: 'ui-primitives', testDir: 'examples/ui/primitives/e2e', use: { ...devices['Pixel 7'] } },
    // The one-file examples (EX spec §5) and the runner's own stub example, each under the fake host: a phone,
    // then the compact landscape height.
    {
      name: 'examples',
      testDir: '.',
      testMatch: EXAMPLES_SMOKE,
      testIgnore: MATRIX_SPEC,
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'examples-compact',
      testDir: '.',
      testMatch: EXAMPLES_SMOKE,
      testIgnore: MATRIX_SPEC,
      use: { ...devices['Pixel 7 landscape'], viewport: { width: 780, height: 270 } },
    },
    // The feature demos on base-2d, each under the shared fake host (tooling/examples-runner/host).
    {
      name: 'demos',
      testDir: 'examples',
      testMatch: ['content/*/e2e/*.e2e.ts', 'physics/*/e2e/*.e2e.ts'],
      use: { ...devices['Pixel 7'] },
    },
    ...matrixProjects,
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
      command: 'pnpm --filter @mcthaydt/examples-runner e2e:host',
      url: `${demoHostOrigin}/`,
      env: { AF_E2E_DEMO_HOST_PORT: String(demoHostPort) },
      reuseExistingServer: process.env.CI === undefined,
    },
    {
      command: 'pnpm --filter @af-examples/examples e2e:examples',
      url: `http://localhost:${examplesPort}/`,
      env: { AF_E2E_EXAMPLES_PORT: String(examplesPort) },
      reuseExistingServer: process.env.CI === undefined,
    },
    {
      command: 'pnpm --filter @mcthaydt/examples-runner e2e:fixtures',
      url: `http://localhost:${runnerFixturesPort}/`,
      env: { AF_E2E_EXAMPLES_PORT: String(runnerFixturesPort) },
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
      // The dev server, for the hot-reload check. Never reused: it must compile this run's copy of content/.
      command: 'pnpm --filter @af-examples/content-hot-reload e2e:dev',
      url: contentDemo.devUrl,
      env: { AF_E2E_DEMO_PORT: String(contentDemo.devPort) },
      reuseExistingServer: false,
    },
  ],
})

export default selectRun(process.env, journeys)
