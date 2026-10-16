import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { examplesRunner } from './src/vite-plugin.ts'

// The runner over its own fixtures (src/fixtures/examples): the stub example, run by the test stand-in for DX.2's
// startGame, so the runner's smoke and parity paths are proven before any real example can run (EX plan, EX.1).
const fixture = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  plugins: [
    examplesRunner({
      root: fixture('./src/fixtures/examples/'),
      start: fixture('./src/fixtures/stub-start-game.ts'),
      catalog: { deliveryPlan: fixture('./src/fixtures/catalog/delivery-plan.md') },
    }),
  ],
})
