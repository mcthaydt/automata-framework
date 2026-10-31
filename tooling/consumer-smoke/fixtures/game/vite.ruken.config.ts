import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defaultClientConditions, defineConfig } from 'vite'

// The game's Ruken build: the `automata-ruken` condition picks the Ruken adapter (DIST spec §5.3), and run.ts checks
// its bundle holds exactly one Ruken SDK.
export default defineConfig({
  root: import.meta.dirname,
  resolve: { conditions: ['automata-ruken', ...defaultClientConditions] },
  plugins: [svelte()],
  build: { outDir: 'dist-ruken', emptyOutDir: true, minify: false, target: 'es2022' },
})
