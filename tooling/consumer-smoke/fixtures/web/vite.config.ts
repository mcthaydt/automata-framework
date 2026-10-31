import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defaultClientConditions, defineConfig } from 'vite'

// A Ruken build (DIST spec §5.3): the `automata-ruken` condition picks the Ruken adapter, in front of Vite's defaults.
export default defineConfig({
  root: import.meta.dirname,
  resolve: { conditions: ['automata-ruken', ...defaultClientConditions] },
  plugins: [svelte()],
  build: { outDir: 'dist', emptyOutDir: true, minify: false, target: 'es2022' },
})
