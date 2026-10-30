import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'
import type { BrowserCommand } from 'vitest/node'
import type { FigureLibrary } from './src/build/build.ts'
import type { fixtureFigures } from './src/testing/fixture-library.ts'

// figures is renderer-free (M3 spec §4.4): the rig, the genes and the content checks are pure functions, so they
// run on Node in the `unit` project. `browsers` runs the FigureBuilder goldens (`*.parity.test.ts`) again in
// Chromium, WebKit and Firefox, so they hold in four engines; build.test.ts runs the same checks in Node, so
// `unit` leaves the parity files out.
//
// `figureFixture` compiles the fixture content in Node (the content compiler reads files) and hands a browser
// page its library; build() itself then runs in the page. The fixture loads through the project's Vite module
// runner, which resolves the workspace's TypeScript sources (this config is loaded by Node, which does not).
const figureFixture: BrowserCommand<[], FigureLibrary> = async (ctx) => {
  const fixture = await ctx.project.import<{ fixtureFigures: typeof fixtureFigures }>(
    './src/testing/fixture-library.ts',
  )
  return (await fixture.fixtureFigures()).library
}

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.parity.test.ts'],
        },
      },
      {
        // Pre-bundle browser-side deps; on a cold cache Vite otherwise reloads test pages mid-run (A0 spec §11).
        optimizeDeps: { include: ['zod'] },
        test: {
          name: 'browsers',
          include: ['src/**/*.parity.test.ts'],
          browser: {
            enabled: true,
            commands: { figureFixture },
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }, { browser: 'webkit' }, { browser: 'firefox' }],
          },
        },
      },
    ],
  },
})
