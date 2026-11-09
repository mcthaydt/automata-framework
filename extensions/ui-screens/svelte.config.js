import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

// Used by `svelte-package` (the published build): `lang="ts"` in `.svelte` files is preprocessed to JavaScript, so
// the published components are plain Svelte source.
export default {
  preprocess: vitePreprocess({ script: true }),
}
