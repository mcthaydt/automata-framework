import { defineTests } from '@automata/vitest-preset'
import { svelteTesting } from '@testing-library/svelte/vite'

// `unit` runs the badge and the overlay in jsdom through Testing Library; `browser` lays them out with production CSS at
// the reference sizes in real Chromium, WebKit and Firefox.
export default defineTests({
  environment: 'jsdom',
  svelte: true,
  plugins: [svelteTesting()],
  setupFiles: ['./tests/vitest-setup.ts'],
  css: true,
})
