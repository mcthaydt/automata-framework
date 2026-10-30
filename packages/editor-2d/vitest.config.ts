import { svelte } from '@sveltejs/vite-plugin-svelte'
import { svelteTesting } from '@testing-library/svelte/vite'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

// Five projects (2D editor spec §14):
// - unit: the headless core (schema and codec round trips, grids, tools, commands, checks, the app's models and
//   controllers) runs in Node, with no renderer.
// - dom: Svelte components in jsdom through Testing Library (states and behavior, no snapshots). `*.dom.test.ts`.
// - layout: the production CSS in real Chromium, WebKit and Firefox at the sizes of spec §12. `*.layout.test.ts`
//   (EDK.6a).
// - canvas: the Pixi canvas (`*.canvas.test.ts`, ED2D.4c3b) in Chromium with WebGL2: pixels read back, the texture
//   manager, context loss and the canvas component. `ED2D_VISUALS=1` makes the review-image test write its PNGs.
// - browsers: the golden files (`*.parity.test.ts`), which run in Node with `unit` and again in Chromium, WebKit and
//   Firefox, where the auto-tile hashes have to come out the same (spec G-d).
//
// The Svelte plugins sit on the two projects that mount components, not at the top: a plugin set at the top reaches
// every project, and the testing package's `browser` condition would make the code parser of the architecture test
// load its WebAssembly build in Node.
export default defineConfig({
  test: {
    projects: [
      {
        // The headless layers import no component, so there is no Svelte plugin here (see above).
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.dom.test.ts', 'src/**/*.layout.test.ts', 'src/**/*.canvas.test.ts'],
        },
      },
      {
        plugins: [svelte(), svelteTesting()],
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['src/**/*.dom.test.ts'],
          setupFiles: ['./src/vitest-setup.ts'],
          css: true,
        },
      },
      {
        plugins: [svelte(), svelteTesting()],
        // Svelte's client build: the fixtures mount through the testing package.
        resolve: { conditions: ['browser'] },
        test: {
          name: 'layout',
          include: ['src/**/*.layout.test.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }, { browser: 'webkit' }, { browser: 'firefox' }],
          },
        },
      },
      {
        plugins: [svelte(), svelteTesting()],
        resolve: { conditions: ['browser'] },
        // Every dependency the canvas tests load is bundled before the first test: one found mid-run makes Vite reload
        // the page, and the run fails. Listing the test files as entries lets Vite find them all up front.
        optimizeDeps: {
          entries: ['src/**/*.canvas.test.ts'],
          include: ['pixi.js', 'svelte/store', '@testing-library/svelte'],
        },
        test: {
          name: 'canvas',
          include: ['src/**/*.canvas.test.ts'],
          provide: { writeVisuals: process.env['ED2D_VISUALS'] === '1' },
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
      {
        test: {
          name: 'browsers',
          include: ['src/**/*.parity.test.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }, { browser: 'webkit' }, { browser: 'firefox' }],
          },
        },
      },
    ],
  },
})
