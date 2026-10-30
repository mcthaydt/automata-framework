// Run by runtime's build after tsdown's two passes (DX.2a): points the declarations' Ruken type imports at the
// types `tsdown.dts.config.ts` inlined into `dist/vendor/` (D-8).
import { finishSvelteDist } from '../../../tooling/release/src/finish-svelte-dist.ts'

finishSvelteDist(new URL('../dist', import.meta.url).pathname, {
  vendoredTypes: {
    '@ruken/manifest': 'vendor/ruken-manifest.js',
    '@ruken/sdk-host/testing': 'vendor/ruken-sdk-host-testing.js',
  },
})
