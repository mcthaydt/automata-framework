import { defineTests } from '@automata/vitest-preset'
import { contentPlugin } from './vite.config.ts'

// Node runs the unit tests (a screen test says `jsdom` on its first line); the layout project runs the game's own
// screens with production CSS in the three browsers, and the sim project runs the whole sim (both the cases and the
// golden replay) in Chromium, WebKit and Firefox, and again in Node, so the sim is held to the cross-engine rule
// (AGENTS.md, determinism). Svelte compiles the ui panels the game package imports (ship-config.test.ts reads the
// game's input map).
export default defineTests({
  svelte: true,
  plugins: [contentPlugin()],
  optimizeDeps: ['zod'],
  browserProjects: [
    { name: 'layout', folder: 'layout', engines: ['chromium', 'webkit', 'firefox'] },
    { name: 'sim', folder: 'sim', engines: ['chromium', 'webkit', 'firefox'] },
  ],
  // The sim also runs in Node, the fourth engine.
  alsoInNode: ['tests/browser/sim/**/*.test.ts'],
})
