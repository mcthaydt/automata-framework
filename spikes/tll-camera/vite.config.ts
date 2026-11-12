// Spike tll-camera: serves one page (scene.ts) that draws a base scene through @automataframework/3d's default gameplay camera at
// one of the eight 45° headings, for the screenshots (shoot.mjs). Not a product: spikes are exempt from TDD.
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

export default defineConfig({
  root: import.meta.dirname,
  plugins: [svelte()],
  server: { fs: { strict: false } },
})
