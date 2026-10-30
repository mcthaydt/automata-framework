import { defineConfig } from 'tsdown'
import { writeVendored } from '../../tooling/release/src/write-vendored.ts'

// The second step of game's published build (DX.2a), after svelte-package: the one vendored Ruken value game
// uses, `SLUG_RE`, bundled with its declaration into `dist/vendor/ruken-manifest.js`, which
// `build/finish-dist.ts` points game's JavaScript and declarations at (D-8, DX2A-3). `@ruken/manifest` imports
// smol-toml for `parseManifest`, which `SLUG_RE` does not need; without side effects for modules, the unused
// import is dropped, so game needs no smol-toml dependency.
const packageDir = new URL('.', import.meta.url).pathname

export default defineConfig({
  entry: { 'vendor/ruken-manifest': 'build/ruken-manifest.ts' },
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  fixedExtension: false,
  clean: false,
  dts: { eager: true },
  treeshake: { moduleSideEffects: false },
  deps: {
    neverBundle: ['smol-toml'],
    onlyBundle: [/^@ruken\/manifest(?:\/|$)/],
    onlyImport: [],
  },
  hooks: {
    'build:done': () =>
      writeVendored({
        root: new URL('../..', import.meta.url).pathname,
        packageDir,
        packageName: '@mcthaydt/automata-game',
        bundled: ['@ruken/manifest'],
      }),
  },
})
