import { fileURLToPath } from 'node:url'
import { automataContent } from '@mcthaydt/automata-content/vite'
import { rukenHeaders } from '@mcthaydt/automata-tools/internal'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { Effect } from 'effect'
import { defaultClientConditions, defineConfig } from 'vite'
import config from './ship.config.ts'
import { contentConfig } from './src/content.config.ts'

// `vite preview` serves the build with the headers Ruken would serve it with (`rukenHeaders` on this game's
// manifest: Ruken's CSP with no eval), so the browser journeys catch a build that breaks under Ruken. The page
// that may frame it is the e2e host page (AF_E2E_SERVER_PORT, set by playwright.config.ts), otherwise Ruken's
// local web app (http://localhost:5173, Ruken's dev port).
function previewHeaders(): Record<string, string> {
  const hostPort = process.env.AF_E2E_SERVER_PORT
  const hostOrigins = [hostPort === undefined ? 'http://localhost:5173' : `http://127.0.0.1:${hostPort}`]
  return Effect.runSync(rukenHeaders(config, { hostOrigins }))
}

/**
 * The content plugin over the game's `content/` (`virtual:automata/content`): the room the 2D editor exports and the
 * tuning. The page and the tests (vitest.config.ts) both compile it. The dev journey points it at a copy of
 * `content/` (AF_E2E_CONTENT_ROOT, package.json `e2e:dev`) that it edits, so the committed files are never touched.
 */
export function contentPlugin(): ReturnType<typeof automataContent> {
  return automataContent({
    root: process.env.AF_E2E_CONTENT_ROOT ?? fileURLToPath(new URL('.', import.meta.url)),
    ...contentConfig,
  })
}

export default defineConfig({
  // A Ruken build: the Ruken host adapter, in front of Vite's defaults, which `conditions` replaces.
  resolve: { conditions: ['automata-ruken', ...defaultClientConditions] },
  // Svelte compiles the ui panels the runtime shows (loader, boot failure) and the game package's screens.
  plugins: [svelte(), contentPlugin()],
  // Relative URLs: inside Ruken the game is served from /b/<buildId>/ and on the dev host from
  // /builds/<buildId>/, never from the origin's root (ship prepare refuses root-absolute paths).
  base: './',
  // `assetsInlineLimit: 0`: Vite would inline an asset under 4 kB as a `data:` URL, which Pixi's loader fetches and
  // Ruken's CSP (`connect-src 'self'`) refuses; a same-origin file is what the CSP allows.
  build: { outDir: 'dist', emptyOutDir: true, assetsInlineLimit: 0 },
  preview: { headers: previewHeaders() },
})
