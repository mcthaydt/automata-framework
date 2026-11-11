// Spike clinic: serves one page (scene.ts) that draws the converted clinic through @automata/3d, for the screenshots
// (shoot.mjs). Not a product: spikes are exempt from TDD.
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

export default defineConfig({
  root: import.meta.dirname,
  plugins: [svelte()],
  server: { fs: { strict: false } },
})
