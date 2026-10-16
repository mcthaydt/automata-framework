import { checkManifest, rukenToml } from '@mcthaydt/automata-ship'
import { compileHeaders } from '@ruken/manifest'
import { Effect } from 'effect'
import { defaultClientConditions, defineConfig, type UserConfig } from 'vite'
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

/**
 * `pnpm build:itch` (mode `itch`, PUB spec §3): the `automata-web` condition makes
 * `@mcthaydt/automata-host/target` the web adapter, so the build holds no Ruken SDK, and `__AUTOMATA_TARGET__`
 * names itch.io as the host. `resolve.conditions` replaces Vite's defaults, so they follow the target's.
 */
const itch: UserConfig = {
  resolve: { conditions: ['automata-web', ...defaultClientConditions] },
  define: { __AUTOMATA_TARGET__: JSON.stringify('itch') },
  build: { outDir: 'dist-itch', emptyOutDir: true },
}

export default defineConfig(({ mode }) => ({
  // Relative URLs: inside Ruken the game is served from /b/<buildId>/, on the dev host from /builds/<buildId>/
  // and on itch.io from /html/<uploadId>/, never from the origin's root (ship prepare refuses root-absolute paths).
  base: './',
  build: { outDir: 'dist', emptyOutDir: true },
  preview: { headers: previewHeaders() },
  ...(mode === 'itch' ? itch : {}),
}))
