import { checkManifest, rukenToml } from '@mcthaydt/automata-ship'
import { compileHeaders } from '@ruken/manifest'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { Effect } from 'effect'
import { defineConfig } from 'vite'
import config from './ship.config.ts'

// `vite preview` serves the build with the headers Ruken would serve it with (compileHeaders on this game's
// manifest: Ruken's CSP with no eval). The page that may frame it is Ruken's local web app (http://localhost:5173).
function previewHeaders(): Record<string, string> {
  return compileHeaders(Effect.runSync(checkManifest(rukenToml(config))), {
    hostOrigins: ['http://localhost:5173'],
  })
}

export default defineConfig({
  // Svelte compiles the ui panels the runtime and the default screens show.
  plugins: [svelte()],
  // Relative URLs: inside Ruken the game is served from /b/<buildId>/ (ship prepare refuses root-absolute paths).
  base: './',
  build: { outDir: 'dist', emptyOutDir: true },
  preview: { headers: previewHeaders() },
})
