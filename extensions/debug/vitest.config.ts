import { defineTests } from '@automata/vitest-preset'
import { svelteTesting } from '@testing-library/svelte/vite'

// Debug is presentation only: no sim entry and no golden. `unit` runs the components in jsdom through Testing Library, and
// the release bundle test builds a fixture with Vite from inside Node. `browser` lays the overlay out in real Chromium,
// which jsdom cannot do.
export default defineTests({
  environment: 'jsdom',
  svelte: true,
  plugins: [svelteTesting()],
  setupFiles: ['./tests/vitest-setup.ts'],
  browsers: ['chromium'],
  testTimeout: 90_000,
})
