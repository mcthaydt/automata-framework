import { publishedBuild } from '../../tooling/release/src/tsdown-shared.ts'

// The published build (M2.4 spec §3.4). It imports only Ruken's types, which are inlined into the `.d.ts`.
export default publishedBuild(import.meta.url, {
  entry: { index: 'src/index.ts' },
  platform: 'browser',
  bundleRuken: ['@ruken/sdk'],
})
