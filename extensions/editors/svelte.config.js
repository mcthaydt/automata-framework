import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

// `lang="ts"` in the editors' components, for svelte-check and the suite page's build.
export default {
  preprocess: vitePreprocess({ script: true }),
}
