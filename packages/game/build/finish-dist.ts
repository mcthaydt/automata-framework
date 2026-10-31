// Run by game's build after svelte-package (DX.2a, ui's layout, M2.4 spec §3.3): drops the tests and the test-only
// device helper, and gives every relative import its file. Game vendors nothing of Ruken's (DIST spec §5).
import { finishSvelteDist } from '../../../tooling/release/src/finish-svelte-dist.ts'

finishSvelteDist(new URL('../dist', import.meta.url).pathname, {
  vendoredTypes: {},
  testOnly: ['input/testing'],
})
