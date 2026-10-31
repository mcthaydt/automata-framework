import { journeyProject } from '@mcthaydt/automata-editor-kit/journey-project'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { svelteTesting } from '@testing-library/svelte/vite'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

// Five projects (3D editor spec §12), the same split as editor-2d:
// - unit: the headless layers (format, codec, checks, model, views' math, the app's models and controllers) in Node,
//   with no renderer and no Svelte.
// - dom: Svelte components in jsdom through Testing Library (states and behavior, no snapshots). `*.dom.test.ts`.
// - layout: the production CSS in real Chromium, WebKit and Firefox at the sizes of spec §10, and the iPad journeys
//   (WebKit with touch and pen samples). `*.layout.test.ts`.
// - canvas: the Plan view's Pixi renderer (`*.canvas.test.ts`, ED3D.5d) in Chromium with WebGL2: pixels read back,
//   resize and context loss. `ED3D_VISUALS=1` makes the review-image test write its PNGs.
// - journeys: the iPad journeys (the kit's EDK.6b harness: WebKit with touch and a 2x screen), `*.journey.test.ts`, with
//   real pointer events from a finger, a Pencil and a palm (ED3D.11).
//
// The Svelte plugins sit on the two projects that mount components, not at the top, so the Node project never loads
// the Svelte compiler or a package's `browser` build.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: [
            'src/**/*.dom.test.ts',
            'src/**/*.layout.test.ts',
            'src/**/*.canvas.test.ts',
            'src/**/*.journey.test.ts',
          ],
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
        // The frame loads Pixi once a level opens; bundled up front, so a cold cache does not reload the page mid-run.
        optimizeDeps: { include: ['pixi.js'] },
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
        // the page and the run fails (editor-2d found this first). The test files as entries let Vite find them all.
        optimizeDeps: {
          entries: ['src/**/*.canvas.test.ts'],
          include: ['pixi.js'],
        },
        test: {
          name: 'canvas',
          include: ['src/**/*.canvas.test.ts'],
          provide: { writeVisuals: process.env['ED3D_VISUALS'] === '1' },
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
      // The Svelte plugins and the Pixi pre-bundle sit on the project, as on the other browser projects (see above).
      {
        ...journeyProject(playwright),
        plugins: [svelte(), svelteTesting()],
        optimizeDeps: { include: ['pixi.js'] },
      },
    ],
  },
})
