import { defineTests } from '@automata/vitest-preset'
import { svelteTesting } from '@testing-library/svelte/vite'

// Most of narrative is sim code that runs in Node; only the dialogue box draws, so its tests name jsdom on their first
// line (`// @vitest-environment jsdom`) and the layout test runs in real browsers.
export default defineTests({
  svelte: true,
  plugins: [svelteTesting()],
  setupFiles: ['./tests/vitest-setup.ts'],
  optimizeDeps: ['@automata/sim', 'zod'],
  // The golden replay runs in Chromium, WebKit and Firefox, and in Node too: the sim's hash is the same in four engines.
  alsoInNode: ['tests/browser/shared/**/*.test.ts'],
})
