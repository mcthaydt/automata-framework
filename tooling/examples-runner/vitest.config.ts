import { fileURLToPath } from 'node:url'
import { goldenCommands } from '@automata/sim/testing/commands'
import { defineTests } from '@automata/vitest-preset'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

// Node runs every unit test, including the examples' golden replays (tests/browser/examples.test.ts); the browser
// project replays the same goldens in Chromium, WebKit and Firefox. tests/fixtures/ holds example
// files, not tests.
export default defineTests({
  // An example's default export is a whole game (`defineGame`), whose default screens are Svelte components.
  svelte: true,
  alsoInNode: ['tests/browser/**/*.test.ts'],
  // Goldens are read in a browser through this command (browsers read goldens, never write them), from anywhere in
  // the repository: the examples' goldens sit in examples/2d/__goldens__, outside this package.
  browserCommands: goldenCommands({ root: repoRoot }),
  // The sim's dependencies, pre-bundled up front. No discovery: the dependency scan would follow the parity test's
  // globs into pending examples, whose imports do not resolve yet, give up, and reload the page mid-run.
  // An example's game also brings PixiJS, whose CommonJS dependencies (eventemitter3, earcut) a browser can only
  // import pre-bundled.
  optimizeDeps: ['koota', 'zod', '@automata/framework > pixi.js'],
})
