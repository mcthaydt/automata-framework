import { publishedBuild } from '../../tooling/release/src/tsdown-shared.ts'

// The published build's tsdown pass (M2.4 spec §3.4, DIST spec §5.3). `svelte-package` has already turned `src/`
// into `dist/`, one file per module, leaving `.svelte` files as source; this pass overwrites the three build-target
// files with bundles, because Ruken's SDK is not published and must be inlined (D-8):
// - `entries/target/ruken.js` bundles `@ruken/sdk`;
// - `entries/target/web.js` and `entries/target/tauri.js` bundle no SDK code (Tauri's packages stay external: a
//   desktop game installs them);
// - `entries/testing.js` also bundles `@ruken/sdk-host`, for the Ruken `RuntimeTest` (whose own dependency, zod, is
//   declared in package.json). Its declarations import `@ruken/sdk-host` types, inlined by the second pass.
// The second pass is `tsdown.dts.config.ts`.
// `clean: false`: tsdown would otherwise empty `dist/` and delete what `svelte-package` wrote there.
export default {
  ...publishedBuild(import.meta.url, {
    entry: {
      'entries/target/ruken': 'src/entries/target/ruken.ts',
      'entries/target/web': 'src/entries/target/web.ts',
      'entries/target/tauri': 'src/entries/target/tauri.ts',
    },
    platform: 'browser',
    bundleRuken: ['@ruken/sdk', '@ruken/sdk-host'],
  }),
  clean: false,
}
