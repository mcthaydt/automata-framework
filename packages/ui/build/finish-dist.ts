// Run by `ui`'s build after svelte-package and the declarations pass (M2.4 spec §3.3).
import { finishSvelteDist } from '../../../tooling/release/src/finish-svelte-dist.ts'

finishSvelteDist(new URL('../dist', import.meta.url).pathname, {
  vendoredTypes: { '@ruken/sdk': 'vendor/ruken-sdk.js' },
})
