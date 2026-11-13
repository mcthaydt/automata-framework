import { defineTests } from '@automata/vitest-preset'
import { setContentPlugin } from './src/entries/vite.ts'

// Node runs the unit tests, with the set's content compiled as a page gets it (`virtual:automata/content`) and its level
// file where an editor journey's copy would put it. The set draws in the 3D example runner, so it has no browser tests.
export default defineTests({
  // The umbrella's default screens are Svelte components, which the game definition imports.
  svelte: true,
  browsers: [],
  plugins: [setContentPlugin(process.env)],
  optimizeDeps: ['zod'],
})
