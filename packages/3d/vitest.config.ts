import { svelte } from '@sveltejs/vite-plugin-svelte'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'
import type { BrowserCommand } from 'vitest/node'
import type { FigureLibrary } from './src/features/figures/figure/build.ts'
import type { fixtureFigures } from './src/testing/fixture-library.ts'

// `unit`: the parsers, the views' maths, the figures' rig, genes and content checks, the no-eval shim's pin and the
// bundle guard: pure functions on Node. `browsers`: the renderer on a real WebGL2 context and the figures' goldens
// again in Chromium, WebKit and Firefox (`*.parity.test.ts`), so they hold in four engines; the unit project runs the
// same golden checks in Node. Headless Firefox in this container has no WebGL, so those cases skip there and the GPU
// runner runs them. The solve bench measures and never asserts, so it is no part of the gate (`pnpm bench`).
//
// Svelte compiles the runtime's screens, which the renderer's tests reach through `@automata/framework`.
//
// `figureFixture` compiles the fixture content in Node (the content compiler reads files) and hands a browser page
// its library; build() itself then runs in the page. The fixture loads through the project's Vite module runner,
// which resolves the workspace's TypeScript sources (this config is loaded by Node, which does not).
const figureFixture: BrowserCommand<[], FigureLibrary> = async (ctx) => {
  const fixture = await ctx.project.import<{ fixtureFigures: typeof fixtureFigures }>(
    './src/testing/fixture-library.ts',
  )
  return (await fixture.fixtureFigures()).library
}

export default defineConfig({
  plugins: [svelte()],
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.parity.test.ts', 'src/**/*.bench.test.ts'],
        },
      },
      { test: { name: 'bench', environment: 'node', include: ['src/**/*.bench.test.ts'] } },
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
