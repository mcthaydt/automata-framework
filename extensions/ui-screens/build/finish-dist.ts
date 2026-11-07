// Run by the package's build after `svelte-package`: drops the tests and the test-only helpers from `dist/` and
// gives every relative import its file, which Node's loader and nodenext types need.
import { finishSvelteDist } from '../../../tooling/release/src/finish-svelte-dist.ts'

finishSvelteDist(new URL('../dist', import.meta.url).pathname, {
  vendoredTypes: {},
  testOnly: ['testing'],
})
