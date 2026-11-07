import { defineTests } from '@automata/vitest-preset'
import { svelteTesting } from '@testing-library/svelte/vite'

// `unit` runs each screen's states and behaviour in jsdom through Testing Library; `browser` runs the layout contract with
// production CSS in real Chromium, WebKit and Firefox at every reference size.
export default defineTests({
  environment: 'jsdom',
  svelte: true,
  plugins: [svelteTesting()],
  setupFiles: ['./tests/vitest-setup.ts'],
  css: true,
  testTimeout: 90_000,
})
