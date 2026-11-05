import { defineTests } from '@mcthaydt/vitest-preset'
import { svelteTesting } from '@testing-library/svelte/vite'

// unit: defineGame, keys(), the default screens' states and focus, and startGame's boot, in jsdom.
// browser: the default screens' layout contract with production CSS at every reference size and variant (M1.6 spec
// §7), and what the game package draws on a real WebGL2 renderer, in Chromium, WebKit and Firefox (PRODUCT.2).
export default defineTests({
  environment: 'jsdom',
  svelte: true,
  plugins: [svelteTesting()],
  // Boot runs over Ruken's fake host in the unit tests, so `@mcthaydt/automata-host/target` must be the Ruken adapter
  // (DIST spec §5.3) until these tests move to `FakeHosting` (DIST.4).
  conditions: ['automata-ruken'],
  css: true,
  setupFiles: ['./tests/setup.ts'],
})
