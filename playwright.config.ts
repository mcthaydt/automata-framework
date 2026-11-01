import { defineConfig, devices } from '@playwright/test'
import * as contentDemo from './examples/content/hot-reload/e2e/origin.ts'
import { demoPort, demoUrl } from './examples/ui/primitives/e2e/origin.ts'
import * as base3d from './games/base-3d/e2e/origin.ts'
import * as base2d from './games/emberwick/e2e/origins.ts'
import { gameBuildPath, gamePort, gameUrl, hostOrigin, hostPort } from './games/placeholder/e2e/origins.ts'
import { INPUT_MATRIX } from './packages/testing/src/e2e/input-matrix.ts'
import {
  base3dDevPort,
  demoHostOrigin,
  demoHostPort,
  examplesPort,
  playgroundFrameOrigin,
  playgroundFramePort,
  playgroundOrigin,
  playgroundPort,
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

// The one-file examples' journeys emulate the phone's CSS size at a device-pixel ratio of 1 (CI.E2E2). Headless
// Chromium composites in software, so every frame of a rendering example blocks the page's main thread on a
// ReadPixels of the whole canvas, and each action waits about one frame. At the Pixel 7's 2.625 the canvas is 728×1678
// and a frame costs ~200 ms; at 1 it is 412×948, about a third of the pixels. Measured with 2 workers on 4 CPUs:
// display-policy D-b went from 30.9 s (past its 30 s budget) to 8.8 s, core-saves' conflict journey from 35.3 s to
// 13.8 s (docs/superpowers/plans/2026-10-31-ci-hardening.md). The journeys check DOM state, not pixel density; the
// renderer's own resolution rules keep their unit and parity tests, and the games' journeys keep the phone's ratio.
// ANGLE's SwiftShader backend (--use-angle=swiftshader) also removes the readback, but the 3D examples stop drawing
// under it and a reload waits seconds on the old WebGL context's teardown, so it is not used.
const EXAMPLES_PIXEL_RATIO = { deviceScaleFactor: 1 }

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
    // The base 3D game is landscape only (M3.7b): a phone held sideways at the 844 × 390 the game is sized for.
    {
      name: 'base-3d',
      testDir: 'games/base-3d/e2e',
      use: { ...devices['Pixel 7 landscape'], viewport: { width: 844, height: 390 } },
    },
    // The same game from its Vite dev server (journey J2), in Chromium and WebKit (the Owner's iPad is WebKit).
    {
      name: 'base-3d-dev',
      testDir: 'games/base-3d/e2e-dev',
      use: { ...devices['Pixel 7 landscape'], viewport: { width: 844, height: 390 } },
    },
    {
      name: 'base-3d-dev-webkit',
      testDir: 'games/base-3d/e2e-dev',
      use: { ...devices['iPad (gen 7) landscape'] },
    },
    { name: 'ui-primitives', testDir: 'examples/ui/primitives/e2e', use: { ...devices['Pixel 7'] } },
    // The one-file examples (EX spec §5) and the runner's own stub example, each under the fake host: a phone,
    // then the compact landscape height.
    {
      name: 'examples',
      testDir: '.',
      testMatch: EXAMPLES_SMOKE,
      testIgnore: MATRIX_SPEC,
      use: { ...devices['Pixel 7'], ...EXAMPLES_PIXEL_RATIO },
    },
    {
      name: 'examples-compact',
      testDir: '.',
      testMatch: EXAMPLES_SMOKE,
      testIgnore: MATRIX_SPEC,
      use: {
        ...devices['Pixel 7 landscape'],
        viewport: { width: 780, height: 270 },
        ...EXAMPLES_PIXEL_RATIO,
      },
    },
    // The 3D examples (render3d, and figures since M3.5d) in WebKit too (M3.4a): the other projects are Chromium,
    // and headless Firefox here has no WebGL.
    {
      name: 'examples-webkit',
      testDir: '.',
      testMatch: ['examples/e2e/render3d-*.e2e.ts', 'examples/e2e/figures-*.e2e.ts'],
      use: { ...devices['iPhone 14 landscape'] },
    },
    // The feature demos on base-2d, each under the shared fake host (tooling/examples-runner/host).
    {
      name: 'demos',
      testDir: 'examples',
      testMatch: ['content/*/e2e/*.e2e.ts'],
      use: { ...devices['Pixel 7'] },
    },
    ...matrixProjects,
    // The playground's feasibility proof (website playground spec, WEB.PLAY.1), in every engine the site supports
    // and Firefox, which the site's own suite does not run.
    ...(['chromium', 'webkit', 'firefox'] as const).map((browserName) => ({
      name: `playground-${browserName}`,
      testDir: 'tooling/examples-runner/playground/e2e',
      testMatch: 'feasibility.e2e.ts',
      use: { browserName },
    })),
    // The playground frame (WEB.PLAY.2): the runtime build runs an example its parent sends, in every engine.
    ...(['chromium', 'webkit', 'firefox'] as const).map((browserName) => ({
      name: `playground-frame-${browserName}`,
      testDir: 'tooling/examples-runner/playground/e2e',
      testMatch: ['frame.e2e.ts', 'examples.e2e.ts'],
      use: { browserName },
    })),
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
      // Framed by the shared demo host (AF_E2E_HOST_ORIGIN is the origin its CSP lets frame it).
      command: 'pnpm --filter @af-games/base-3d e2e:game',
      url: base3d.gameUrl,
      env: {
        AF_E2E_PREVIEW_PORT: String(base3d.gamePort),
        AF_E2E_GAME_PATH: base3d.gameBuildPath,
        AF_E2E_HOST_ORIGIN: demoHostOrigin,
      },
      reuseExistingServer: process.env.CI === undefined,
    },
    {
      command: `pnpm --filter @af-games/base-3d exec vite --configLoader runner --strictPort --port ${base3dDevPort}`,
      url: `http://localhost:${base3dDevPort}/`,
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
      // The dev server, for the hot-reload check. Never reused: it must compile this run's copy of content/.
      command: 'pnpm --filter @af-examples/content-hot-reload e2e:dev',
      url: contentDemo.devUrl,
      env: { AF_E2E_DEMO_PORT: String(contentDemo.devPort) },
      reuseExistingServer: false,
    },
    {
      // The playground's feasibility server (tooling/examples-runner/playground): the site in miniature.
      command: 'pnpm --filter @mcthaydt/examples-runner e2e:playground',
      url: `${playgroundOrigin}/`,
      env: { AF_E2E_PLAYGROUND_PORT: String(playgroundPort) },
      reuseExistingServer: process.env.CI === undefined,
    },
    {
      // The playground frame's server (WEB.PLAY.2): builds the runtime, then serves it with the frame pages.
      command: 'pnpm --filter @mcthaydt/examples-runner e2e:playground-frame',
      url: `${playgroundFrameOrigin}/`,
      env: { AF_E2E_PLAYGROUND_FRAME_PORT: String(playgroundFramePort) },
      reuseExistingServer: process.env.CI === undefined,
    },
  ],
})

export default selectRun(process.env, journeys)
