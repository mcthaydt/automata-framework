import { publishedBuild } from '../../tooling/release/src/tsdown-shared.ts'

// The published build's first pass (M2.4 spec §3.2; DX.2a). Unbundled: `boot/page-layers.svelte.ts` and
// `display/display-policy.svelte.ts` use Svelte runes, and a game's Svelte plugin compiles only files named
// `*.svelte.js`, so each module ships as its own file (DX2A-1). Runtime imports one Ruken type,
// `FakeHostOptions`, for the Ruken `RuntimeTest` (`testing/ruken/`): `tsdown.dts.config.ts` inlines it into
// `dist/vendor/` and `build/finish-dist.ts` points the declarations there (D-8, DX2A-2).
export default publishedBuild(import.meta.url, {
  entry: {
    index: 'src/index.ts',
    extension: 'src/extension/index.ts',
    testing: 'src/testing/index.ts',
  },
  platform: 'browser',
  unbundle: true,
  rukenTypes: ['@ruken/sdk-host'],
})
