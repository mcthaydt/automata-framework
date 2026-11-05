import { defineJourneys } from '@mcthaydt/playwright-preset'
import { playgroundFrameOrigin, playgroundFramePort, playgroundOrigin, playgroundPort } from './host/ports.ts'

// The playground's journeys (the website's embedded player): `pnpm test:e2e` in this folder. The runner's own
// smoke run over its fixtures belongs to the examples' config (examples/playwright.config.ts).
const engines = ['chromium', 'webkit', 'firefox'] as const
const reuse = process.env.CI === undefined

export default defineJourneys({
  testDir: 'playground/e2e',
  projects: [
    // The feasibility proof (website playground spec, WEB.PLAY.1), in every engine the site supports and Firefox,
    // which the site's own suite does not run.
    ...engines.map((browserName) => ({
      name: `playground-${browserName}`,
      testMatch: 'feasibility.e2e.ts',
      use: { browserName },
    })),
    // The playground frame (WEB.PLAY.2): the runtime build runs an example its parent sends, in every engine.
    ...engines.map((browserName) => ({
      name: `playground-frame-${browserName}`,
      testMatch: ['frame.e2e.ts', 'examples.e2e.ts'],
      use: { browserName },
    })),
  ],
  webServer: [
    {
      // The site in miniature.
      command: 'pnpm e2e:playground',
      url: `${playgroundOrigin}/`,
      env: { AF_E2E_PLAYGROUND_PORT: String(playgroundPort) },
      reuseExistingServer: reuse,
    },
    {
      // Builds the runtime, then serves it with the frame pages.
      command: 'pnpm e2e:playground-frame',
      url: `${playgroundFrameOrigin}/`,
      env: { AF_E2E_PLAYGROUND_FRAME_PORT: String(playgroundFramePort) },
      reuseExistingServer: reuse,
    },
  ],
})
