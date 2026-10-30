// Run by game's build after svelte-package and the vendored bundle (DX.2a, ui's layout, M2.4 spec §3.3): drops
// the tests and the test-only device helper, points `@ruken/manifest` at the bundled `SLUG_RE`, and gives every
// relative import its file.
import { finishSvelteDist } from '../../../tooling/release/src/finish-svelte-dist.ts'

finishSvelteDist(new URL('../dist', import.meta.url).pathname, {
  vendoredTypes: {},
  vendoredCode: { '@ruken/manifest': 'vendor/ruken-manifest.js' },
  testOnly: ['input/testing'],
})
