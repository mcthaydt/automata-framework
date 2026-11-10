// Spike eb-look: serves one page (scene.ts) that draws a base scene the way EnvironmentBuilder frames it, for the
// baseline screenshots (shoot.mjs). Not a product: spikes are exempt from TDD.
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

export default defineConfig({
  root: import.meta.dirname,
  plugins: [svelte()],
  server: { fs: { strict: false } },
})
