import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defaultClientConditions, defineConfig } from 'vite'

// An `itch`/`web` target build: `resolve.conditions` replaces Vite's defaults, so the condition
// goes in front of them. The package root holds Svelte components, so the build needs the Svelte plugin.
export default defineConfig({
  root: import.meta.dirname,
  resolve: { conditions: ['automata-web', ...defaultClientConditions] },
  plugins: [svelte()],
  build: { outDir: 'dist', emptyOutDir: true, minify: false, target: 'es2022' },
})
