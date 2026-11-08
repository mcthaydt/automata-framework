import { defineTests } from '@automata/vitest-preset'
import { svelteTesting } from '@testing-library/svelte/vite'

// The editors' models and components run in jsdom through Testing Library (`unit`).
export default defineTests({
  environment: 'jsdom',
  svelte: true,
  plugins: [svelteTesting()],
  setupFiles: ['./tests/vitest-setup.ts'],
})
