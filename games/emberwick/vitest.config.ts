import { defineTests } from '@automata/vitest-preset'
import { contentPlugin } from './vite.config.ts'

// Node runs every unit test (a screen test says `jsdom` on its first line); the browser project runs the sim golden in
// Chromium, WebKit and Firefox, so the base's sim is held to the same cross-engine rule as automata-sim itself
// (AGENTS.md, determinism). Svelte compiles the ui primitives the game package and the runtime import.
export default defineTests({
  svelte: true,
  plugins: [contentPlugin()],
  optimizeDeps: ['koota', 'zod', 'pixi.js'],
  // The golden also runs in Node, the fourth engine.
  alsoInNode: ['tests/browser/**/*.test.ts'],
})
