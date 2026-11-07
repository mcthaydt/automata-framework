import {
  demoHostOrigin,
  demoHostPort,
  examplesPort,
  runnerFixturesPort,
} from '@automata/examples-runner/host/ports'
import { defineJourneys, sizes } from '@automata/playwright-preset'
import { INPUT_MATRIX } from '@automata/tools/e2e'
import { devices } from '@playwright/test'
import * as contentDemo from './content/hot-reload/tests/e2e/origin.ts'
import { demoPort, demoUrl } from './ui/primitives/tests/e2e/origin.ts'

// The 2D one-file examples' browser journeys (EX spec §5): `pnpm test:e2e` in this folder. The 3D examples are their
// own package (examples/3d), with their own journeys.
//
// The journeys emulate the phone's CSS size at a device-pixel ratio of 1 (CI.E2E2). Headless Chromium composites in
// software, so every frame of a rendering example blocks the page's main thread on a ReadPixels of the whole
// canvas, and each action waits about one frame. At the Pixel 7's 2.625 the canvas is 728×1678 and a frame costs
// ~200 ms; at 1 it is 412×948, about a third of the pixels. Measured with 2 workers on 4 CPUs: display-policy D-b
// went from 30.9 s (past its 30 s budget) to 8.8 s, core-saves' conflict journey from 35.3 s to 13.8 s. The
// journeys check DOM state, not pixel density; the renderer's own resolution rules keep their unit and parity
// tests, and the games' journeys keep the phone's ratio. ANGLE's SwiftShader backend (--use-angle=swiftshader) also
// removes the readback, but the 3D examples stop drawing under it and a reload waits seconds on the old WebGL
// context's teardown, so it is not used.
const PIXEL_RATIO = { deviceScaleFactor: 1 }
const phone = { ...devices['Pixel 7'], ...PIXEL_RATIO }
const compact = { ...sizes.compact, ...PIXEL_RATIO }

const MATRIX_SPEC = 'input-matrix.test.ts'
const RUNNER_TESTS = '../../tooling/examples-runner/tests/e2e'
const PLAYGROUND = 'playground-*.test.ts'

// The input × form-factor matrix (M4.10, M4 spec §9.1): a project per cell, in the cell's engine and viewport, with a
// touch screen for the touch cells. The spec reads its cell from the project's metadata.
const matrixProjects = INPUT_MATRIX.map((cell) => ({
  name: `matrix-${cell.id}`,
  testDir: 'tests/e2e',
  testMatch: MATRIX_SPEC,
  metadata: { cell },
  use: {
    browserName: cell.engine,
    viewport: cell.viewport,
    ...(cell.device === 'touch' ? { hasTouch: true, isMobile: cell.engine !== 'firefox' } : {}),
  },
}))

const reuse = process.env.CI === undefined

export default defineJourneys({
  projects: [
    // Phone first (AGENTS.md, Responsive UI), then the compact landscape height.
    { name: 'examples', testDir: 'tests/e2e', testIgnore: [MATRIX_SPEC], use: phone },
    { name: 'examples-compact', testDir: 'tests/e2e', testIgnore: [MATRIX_SPEC], use: compact },
    // The runner's own stub example under the same fake host, and its index page (tooling/examples-runner). Its
    // playground journeys need the playground's servers, so they run from the runner's own config.
    { name: 'runner', testDir: RUNNER_TESTS, testIgnore: PLAYGROUND, use: phone },
    { name: 'runner-compact', testDir: RUNNER_TESTS, testIgnore: PLAYGROUND, use: compact },
    // The feature demos on Emberwick, each under the shared fake host (tooling/examples-runner/host).
    { name: 'demos', testDir: 'content', testMatch: '*/tests/e2e/*.test.ts', use: devices['Pixel 7'] },
    { name: 'ui-primitives', testDir: 'ui/primitives/tests/e2e', use: devices['Pixel 7'] },
    ...matrixProjects,
  ],
  webServer: [
    {
      command: `pnpm --filter @af-examples/ui-primitives e2e:demo --port ${demoPort}`,
      url: demoUrl,
      reuseExistingServer: reuse,
    },
    {
      command: 'pnpm --filter @automata/examples-runner e2e:host',
      url: `${demoHostOrigin}/`,
      env: { AF_E2E_DEMO_HOST_PORT: String(demoHostPort) },
      reuseExistingServer: reuse,
    },
    {
      command: 'pnpm e2e:examples',
      url: `http://localhost:${examplesPort}/`,
      env: { AF_E2E_EXAMPLES_PORT: String(examplesPort) },
      reuseExistingServer: reuse,
    },
    {
      command: 'pnpm --filter @automata/examples-runner e2e:fixtures',
      url: `http://localhost:${runnerFixturesPort}/`,
      env: { AF_E2E_EXAMPLES_PORT: String(runnerFixturesPort) },
      reuseExistingServer: reuse,
    },
    {
      command: 'pnpm --filter @af-examples/content-hot-reload e2e:demo',
      url: contentDemo.url,
      env: { AF_E2E_DEMO_PORT: String(contentDemo.port) },
      reuseExistingServer: reuse,
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
