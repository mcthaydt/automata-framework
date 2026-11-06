import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defaultClientConditions, defineConfig } from 'vite'

// The game's web build: the `automata-web` condition picks the web host adapter, so the page boots
// on its own, with no host around it. `resolve.conditions` replaces Vite's defaults, so it goes in front of them.
export default defineConfig({
  root: import.meta.dirname,
  plugins: [svelte()],
  resolve: { conditions: ['automata-web', ...defaultClientConditions] },
  build: { outDir: 'dist', emptyOutDir: true, minify: false, target: 'es2022' },
})
