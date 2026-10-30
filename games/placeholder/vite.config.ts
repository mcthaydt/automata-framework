import { checkManifest, rukenToml } from '@mcthaydt/automata-ship'
import { compileHeaders } from '@ruken/manifest'
import { Effect } from 'effect'
import { defineConfig } from 'vite'
import config from './ship.config.ts'

// `vite preview` serves the build with the headers Ruken would serve it with (compileHeaders on this game's
// manifest: Ruken's CSP with no eval), so the browser journeys catch a build that breaks under Ruken. The page
// that may frame it is the e2e host page (AF_E2E_SERVER_PORT, set by playwright.config.ts), otherwise Ruken's
// local web app (http://localhost:5173, Ruken's dev port).
function previewHeaders(): Record<string, string> {
  const hostPort = process.env.AF_E2E_SERVER_PORT
  const hostOrigins = [hostPort === undefined ? 'http://localhost:5173' : `http://127.0.0.1:${hostPort}`]
  return compileHeaders(Effect.runSync(checkManifest(rukenToml(config))), { hostOrigins })
}

export default defineConfig({
  // Relative URLs: inside Ruken the game is served from /b/<buildId>/ and on the dev host from
  // /builds/<buildId>/, never from the origin's root (ship prepare refuses root-absolute paths).
  base: './',
  // `assetsInlineLimit: 0`: Vite would inline an asset under 4 kB as a `data:` URL, which Pixi's loader fetches and
  // Ruken's CSP (`connect-src 'self'`) refuses; a same-origin file is what the CSP allows.
  build: { outDir: 'dist', emptyOutDir: true, assetsInlineLimit: 0 },
  preview: { headers: previewHeaders() },
})
