import { publishedBuild } from '../../tooling/release/src/tsdown-shared.ts'

// The published build (M2.4 spec §3.4): `@ruken/manifest` is bundled; Ruken's built CLI is copied whole to
// `dist/vendor/ruken-cli/`, where `rukenCliPath` finds it, and its runtime dependencies are declared.
export default publishedBuild(import.meta.url, {
  entry: { index: 'src/index.ts', cli: 'src/cli.ts' },
  platform: 'node',
  bundleRuken: ['@ruken/manifest', '@ruken/cli'],
  copy: [{ from: 'node_modules/@ruken/cli/dist/*', to: 'dist/vendor/ruken-cli' }],
})
