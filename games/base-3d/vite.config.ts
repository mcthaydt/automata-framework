import { fileURLToPath } from 'node:url'
import { automataContent } from '@mcthaydt/automata-content/vite'
import { figuresExtension } from '@mcthaydt/automata-figures'
import { checkManifest, rukenToml } from '@mcthaydt/automata-ship'
import { compileHeaders } from '@ruken/manifest'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { Effect } from 'effect'
import { defaultClientConditions, defineConfig } from 'vite'
import config from './ship.config.ts'

// `vite preview` serves the build with the headers Ruken would serve it with (compileHeaders on this game's
// manifest: Ruken's CSP with no eval). The page that may frame it is the e2e fake host (AF_E2E_HOST_ORIGIN, set by
// playwright.config.ts), otherwise Ruken's local web app (http://localhost:5173, Ruken's dev port).
function previewHeaders(): Record<string, string> {
  return compileHeaders(Effect.runSync(checkManifest(rukenToml(config))), {
    hostOrigins: [process.env.AF_E2E_HOST_ORIGIN ?? 'http://localhost:5173'],
  })
}

/**
 * The content plugin over src/content (`virtual:automata/content`): the figures, poses and clips,
 * with the figures extension's kinds. The page and the tests (vitest.config.ts) both compile it.
 */
export function contentPlugin(): ReturnType<typeof automataContent> {
  return automataContent({
    root: fileURLToPath(new URL('./src', import.meta.url)),
    schemas: [...(figuresExtension.content ?? [])],
  })
}

export default defineConfig({
  // A Ruken build: the Ruken host adapter (DIST spec §5.3), in front of Vite's defaults, which `conditions` replaces.
  resolve: { conditions: ['automata-ruken', ...defaultClientConditions] },
  // Svelte compiles the ui panels the runtime and the default screens show; the content plugin serves the content.
  plugins: [svelte(), contentPlugin()],
  // Relative URLs: inside Ruken the game is served from /b/<buildId>/ (ship prepare refuses root-absolute paths).
  base: './',
  build: { outDir: 'dist', emptyOutDir: true },
  preview: { headers: previewHeaders() },
})
