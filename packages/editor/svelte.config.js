import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

// Read by the app build, by Vitest and by `svelte-check`: `lang="ts"` in `.svelte` files is preprocessed to JavaScript.
export default {
  preprocess: vitePreprocess({ script: true }),
}
