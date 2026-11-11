import { defineTests } from '@automata/vitest-preset'
import { svelteTesting } from '@testing-library/svelte/vite'

// The pieces are DOM, so their unit tests name jsdom on their first line (`// @vitest-environment jsdom`) and the
// layout tests run in real browsers, at the phone sizes the HUD is designed for.
export default defineTests({
  svelte: true,
  plugins: [svelteTesting()],
  setupFiles: ['./tests/vitest-setup.ts'],
  optimizeDeps: ['@automata/sim', 'zod'],
})
