import { publishedBuild } from '../../tooling/release/src/tsdown-shared.ts'

// The published build's tsdown pass. `svelte-package` has already turned `src/`
// into `dist/`, one file per module, leaving `.svelte` files as source; this pass overwrites the three build-target
// files with bundles, because Ruken's SDK is not published and must be inlined (D-8):
// - `entries/target/ruken.js` bundles `@ruken/sdk`;
// - `entries/target/web.js` and `entries/target/tauri.js` bundle no SDK code (Tauri's packages stay external: a
//   desktop game installs them);
// - `testing/host/page/ruken/hosting-test.js` bundles `@ruken/sdk` and `@ruken/sdk-host` (the fake Ruken host), so the
//   `/testing` entry and `openRuntimeTest` run without either package installed. It reaches no Svelte rune module, which
//   is why it can be a bundle at all (see `unbundle` in `tsdown-shared.ts`); `openRuntimeTest` itself reaches several, so
//   it stays one file per module and imports this bundle. Their declarations import Ruken types, inlined by the second
//   pass.
// The second pass is `tsdown.dts.config.ts`.
// `clean: false`: tsdown would otherwise empty `dist/` and delete what `svelte-package` wrote there.
export default {
  ...publishedBuild(import.meta.url, {
    entry: {
      'entries/target/ruken': 'src/entries/target/ruken.ts',
      'entries/target/web': 'src/entries/target/web.ts',
      'entries/target/tauri': 'src/entries/target/tauri.ts',
      'testing/host/page/ruken/hosting-test': 'src/testing/host/page/ruken/hosting-test.ts',
    },
    platform: 'browser',
    bundleRuken: ['@ruken/sdk', '@ruken/sdk-host'],
  }),
  clean: false,
}
