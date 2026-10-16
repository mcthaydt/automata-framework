import { publishedBuild } from '../../tooling/release/src/tsdown-shared.ts'

// `@ruken/manifest` (compileHeaders, for the `automata check --csp` step) is bundled, as in ship.
export default publishedBuild(import.meta.url, {
  entry: { index: 'src/index.ts', bin: 'src/bin.ts' },
  platform: 'node',
  bundleRuken: ['@ruken/manifest'],
})
