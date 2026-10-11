import { defineConfig } from 'vite'

export default defineConfig({
  // Relative URLs: inside Ruken the game is served from /b/<buildId>/ and on the dev host from
  // /builds/<buildId>/, never from the origin's root (ship prepare refuses root-absolute paths).
  base: './',
  build: { outDir: 'dist', emptyOutDir: true },
})
