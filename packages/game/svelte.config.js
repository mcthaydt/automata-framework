import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

// Used by `svelte-package` (the published build, DX.2a, ui's layout, M2.4 spec §3.3): `lang="ts"` in `.svelte`
// files is preprocessed to JavaScript, so the published components are plain Svelte source.
export default {
  preprocess: vitePreprocess({ script: true }),
}
