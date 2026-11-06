// Run by the package's build after `svelte-package` and tsdown's two passes: drops the tests and the
// test-only helpers from `dist/`, gives every relative import its file, and points the declarations' Ruken type
// imports at the types `tsdown.dts.config.ts` inlined into `dist/vendor/` (D-8). The package vendors Ruken's code
// only in `dist/entries/target/ruken.js`, which tsdown bundles (`tsdown.config.ts`).
import { finishSvelteDist } from '../../../tooling/release/src/finish-svelte-dist.ts'

finishSvelteDist(new URL('../dist', import.meta.url).pathname, {
  vendoredTypes: { '@ruken/sdk-host/testing': 'vendor/ruken-sdk-host-testing.js' },
})
