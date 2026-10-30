import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

// The game's Ruken build (the default target): run.ts checks its bundle holds exactly one Ruken SDK.
export default defineConfig({
  root: import.meta.dirname,
  plugins: [svelte()],
  build: { outDir: 'dist-ruken', emptyOutDir: true, minify: false, target: 'es2022' },
})
