import { defineTests } from '@mcthaydt/vitest-preset'

// unit: every behavior test, in jsdom because boot and the page layers mount ui's Svelte components.
// browser: the Audio service on real Web Audio in Chromium, WebKit and Firefox (M5.3).
// bench: the frame-loop overhead check in Node, kept out of the gate (`pnpm bench`).
export default defineTests({
  environment: 'jsdom',
  svelte: true,
  // Boot runs over Ruken's fake host here, so `@mcthaydt/automata-host/target` must be the Ruken adapter (DIST spec
  // §5.3) until these tests move to `FakeHosting` (DIST.4).
  conditions: ['automata-ruken'],
  // Compiles the Paraglide fixture once, in Node (src/locale/testing/global-setup.ts).
  globalSetup: ['./src/locale/testing/global-setup.ts'],
  // The fixture lives under node_modules/.cache; transform all of it through Vite, so its messages and its runtime
  // are one module graph and overwriteGetLocale reaches the messages (live bindings).
  inline: [/af-paraglide-fixture/],
})
