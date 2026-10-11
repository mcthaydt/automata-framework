import { publishedBuild } from '../../tooling/release/src/tsdown-shared.ts'

// The published build (M2.4 spec §3.1, §3.4): the library, the Vite plugin and the `automata-content` bin.
// In the workspace the bin is `src/cli/main.ts`, which loads `run-cli.ts` through Vite's module runner; a built
// package has no `.ts` to load, so the published bin is `build/cli.ts`, which calls `runCli` directly.
export default publishedBuild(import.meta.url, {
  entry: { index: 'src/index.ts', vite: 'src/vite/index.ts', cli: 'build/cli.ts' },
  platform: 'node',
  bundleRuken: ['@ruken/manifest'],
})
