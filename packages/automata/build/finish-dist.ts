// Run by the package's build after `svelte-package` and tsdown's two passes: drops the tests and the
// test-only helpers from `dist/`, gives every relative import its file, and points the declarations' Ruken type
// imports at the types `tsdown.dts.config.ts` inlined into `dist/vendor/` (D-8). The package vendors Ruken's code
// only in `dist/entries/target/ruken.js`, which tsdown bundles (`tsdown.config.ts`).
import { finishSvelteDist } from '../../../tooling/release/src/finish-svelte-dist.ts'

finishSvelteDist(new URL('../dist', import.meta.url).pathname, {
  vendoredTypes: {
    '@ruken/sdk': 'vendor/ruken-sdk.js',
    '@ruken/sdk-host/testing': 'vendor/ruken-sdk-host-testing.js',
  },
  // `svelte-package` also writes the Ruken adapter file by file, with an `@ruken/sdk` import Ruken does not publish.
  // `entries/target/ruken.js` and the fake-host bundle carry the same code with the SDK inside, so nothing in `dist/`
  // points at the loose copy. The locale folder is the Paraglide fixture compile, which only this package's own tests run.
  testOnly: ['features/targets/ruken', 'features/locale/testing'],
})
