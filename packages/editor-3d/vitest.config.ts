import { journeyInstance } from '@automata/editor/kit/journey-project'
import { defineTests } from '@automata/vitest-preset'
import { svelteTesting } from '@testing-library/svelte/vite'
import { playwright } from '@vitest/browser-playwright'

// `tests/unit` runs in Node unless a file's first line says `// @vitest-environment jsdom` (the component tests do): the
// headless layers, and Svelte components mounted through Testing Library. The browser tests are one project per folder of
// `tests/browser/` (the preset):
// - layout: the production CSS in real Chromium, WebKit and Firefox at the sizes the editor is used at.
// - canvas: the Plan view's Pixi renderer and the review images, in Chromium with WebGL2: pixels read back, resize and
//   context loss. `ED3D_VISUALS=1` makes the review-image tests write their PNGs.
// - journeys: the iPad journeys (WebKit with touch and a 2x screen), with real pointer events from a finger, a Pencil
//   and a palm.
const config = defineTests({
  environment: 'node',
  svelte: true,
  plugins: [svelteTesting()],
  setupFiles: ['./tests/setup.ts'],
  css: true,
  // The frame loads Pixi once a level opens; bundled up front, so a cold cache does not reload the page mid-run.
  optimizeDeps: ['pixi.js'],
  browserProjects: [
    { name: 'layout', folder: 'layout', engines: ['chromium', 'webkit', 'firefox'] },
    { name: 'canvas', folder: 'canvas', engines: ['chromium'] },
    {
      name: 'journeys',
      folder: 'journeys',
      engines: ['webkit', 'chromium'],
      instance: journeyInstance(playwright),
    },
  ],
})

export default {
  ...config,
  test: { ...config.test, provide: { writeVisuals: process.env['ED3D_VISUALS'] === '1' } },
}
