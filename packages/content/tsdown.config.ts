import { publishedBuild } from '../../tooling/release/src/tsdown-shared.ts'

// The published build (M2.4 spec §3.1, §3.4): the library, the Node-only `assets` atlas build (M5.6), the browser-safe `locale` entry (PRODUCT.L2), the Vite
// plugin, the `automata-content` bin, and the browser-safe `game-config` entry (the game config schema, DIST spec §4.4).
// In the workspace the bin is `src/cli/main.ts`, which loads `run-cli.ts` through Vite's module runner; a built
// package has no `.ts` to load, so the published bin is `build/cli.ts`, which calls `runCli` directly.
export default publishedBuild(import.meta.url, {
  entry: {
    index: 'src/entries/index.ts',
    assets: 'src/entries/assets.ts',
    locale: 'src/entries/locale.ts',
    'game-config': 'src/entries/game-config.ts',
    vite: 'src/entries/vite.ts',
    cli: 'build/cli.ts',
  },
  platform: 'node',
  bundleRuken: ['@ruken/manifest'],
})
