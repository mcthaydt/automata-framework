import { journeyProject } from '@mcthaydt/automata-editor-kit/journey-project'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { svelteTesting } from '@testing-library/svelte/vite'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

// Five projects (editor suite spec §12):
// - unit: the headless core and the shell's models in Node: no Svelte, no DOM.
// - dom: Svelte components in jsdom through Testing Library (states and behaviour, no snapshots). `*.dom.test.ts`.
// - layout: the production CSS in real Chromium, WebKit and Firefox at the sizes of spec §10. `*.layout.test.ts`.
// - canvas: the Pixi stages (`*.canvas.test.ts`) in Chromium and WebKit with WebGL2, pixels read back. `EDS_VISUALS=1`
//   makes the review-image tests write their PNGs.
// - journeys: WebKit in an iPad context, real pointers, the real stage. `*.journey.test.ts`.
// The Svelte plugins sit on the projects that mount components, as in editor-2d.
// Only the package's bare entry: `/locale` and the other subpaths stay the package's own.
const contentAlias = [
  {
    find: /^@mcthaydt\/automata-content$/,
    replacement: new URL('./src/shims/content-browser.ts', import.meta.url).pathname,
  },
]

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
        // The Studio loads the figures package, which takes a few things from the content package (the shim).
        resolve: { conditions: ['browser'], alias: contentAlias },
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
        // The figures package takes a few things from the content package, whose entry reaches Node built-ins (the shim).
        resolve: { conditions: ['browser'], alias: contentAlias },
        // Every dependency the canvas tests load is bundled before the first test: one found mid-run makes Vite reload
        // the page and the run fails.
        optimizeDeps: {
          entries: ['src/**/*.canvas.test.ts'],
          include: ['pixi.js', 'svelte/store', '@testing-library/svelte'],
        },
        test: {
          name: 'canvas',
          include: ['src/**/*.canvas.test.ts'],
          provide: { writeVisuals: process.env['EDS_VISUALS'] === '1' },
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }, { browser: 'webkit' }],
          },
        },
      },
      // The iPad journeys (the kit's EDK.6b harness): WebKit with touch and a 2× screen, over the real stage.
      {
        ...journeyProject(playwright),
        plugins: [svelte(), svelteTesting()],
        resolve: { conditions: ['browser'], alias: contentAlias },
      },
    ],
  },
})
