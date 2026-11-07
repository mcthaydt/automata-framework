import { defineTests } from '@automata/vitest-preset'
import { svelteTesting } from '@testing-library/svelte/vite'

// One config for the package that used to be nine.
// unit: every behavior test, in jsdom because boot, the default screens and the ui kit mount Svelte components, with
//   real CSS so a component test sees its styles. Tests that need no DOM run here too.
// browser: layout contracts with production CSS, the Audio service on real Web Audio and what the renderer draws,
//   in Chromium, WebKit and Firefox.
// bench: the frame-loop overhead check in Node, kept out of the gate (`pnpm bench`).
export default defineTests({
  environment: 'jsdom',
  svelte: true,
  plugins: [svelteTesting()],
  css: true,
  setupFiles: ['./tests/fixtures/setup.ts'],
  // Boot runs over Ruken's fake host here, so `@automata/framework/target` must be the Ruken adapter
  // until these tests move to `FakeHosting`.
  conditions: ['automata-ruken'],
  // Compiles the Paraglide fixture once, in Node (src/features/locale/testing/global-setup.ts).
  globalSetup: ['./src/features/locale/testing/global-setup.ts'],
  // The fixture lives under node_modules/.cache; transform all of it through Vite, so its messages and its runtime
  // are one module graph and overwriteGetLocale reaches the messages (live bindings).
  inline: [/af-paraglide-fixture/],
})
