import { defineTests } from '@automata/vitest-preset'
import { svelteTesting } from '@testing-library/svelte/vite'

// The editors' models and components run in jsdom through Testing Library (`unit`); their layout runs in a real browser.
export default defineTests({
  environment: 'jsdom',
  svelte: true,
  plugins: [svelteTesting()],
  setupFiles: ['./tests/vitest-setup.ts'],
  css: true,
  // Layout runs in Chromium; WebKit and Firefox are not runnable where this is built (the plan's log says which ran).
  browserProjects: [{ name: 'layout', folder: 'layout', engines: ['chromium'] }],
})
