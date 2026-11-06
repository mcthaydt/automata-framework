import { publishedBuild } from '../../tooling/release/src/tsdown-shared.ts'

// The published build: the library, the Node-only `assets` atlas build, the browser-safe `locale`, `palette` and
// `schema` entries (what a page's packages import without Node), the Vite plugin, the `automata-content` bin, and
// the browser-safe `game-config` entry (the game config schema).
// In the workspace the bin is `src/cli/main.ts`, which loads `run-cli.ts` through Vite's module runner; a built
// package has no `.ts` to load, so the published bin is `build/cli.ts`, which calls `runCli` directly.
export default publishedBuild(import.meta.url, {
  entry: {
    index: 'src/entries/index.ts',
    assets: 'src/entries/assets.ts',
    locale: 'src/entries/locale.ts',
    palette: 'src/entries/palette.ts',
    schema: 'src/entries/schema.ts',
    'game-config': 'src/entries/game-config.ts',
    vite: 'src/entries/vite.ts',
    cli: 'build/cli.ts',
  },
  platform: 'node',
  bundleRuken: ['@ruken/manifest'],
})
