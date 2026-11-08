import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { examplesRunner } from './src/vite-plugin.ts'

// The runner over its own fixtures (tests/fixtures/examples): the stub example, run by the test stand-in for
// startGame, so the runner's smoke and parity paths are proven before any real example can run.
const fixture = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  plugins: [
    examplesRunner({
      root: fixture('./tests/fixtures/examples/'),
      start: fixture('./tests/fixtures/stub-start-game.ts'),
      catalog: { deliveryPlan: fixture('./tests/fixtures/catalog/delivery-plan.md') },
    }),
  ],
})
