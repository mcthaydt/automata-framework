import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { figuresExtension } from '@automata/3d/figures'
import { worldPropContent, worldSwatchContent } from '@automata/3d/world-content'
import { automataContent } from '@automata/content/vite'
import { rukenHeadersOf } from '@automata/tools/internal'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { type Alias, defaultClientConditions, defineConfig } from 'vite'
import config from './ship.config.ts'

// `vite preview` serves the build with the headers Ruken would serve it with (`rukenHeadersOf` on this game's
// manifest: Ruken's CSP with no eval). The page that may frame it is the e2e fake host (AF_E2E_HOST_ORIGIN, set by
// playwright.config.ts), otherwise Ruken's local web app (http://localhost:5173, Ruken's dev port).
function previewHeaders(): Record<string, string> {
  return rukenHeadersOf(config, { hostOrigins: [process.env.AF_E2E_HOST_ORIGIN ?? 'http://localhost:5173'] })
}

/**
 * Where the game's `content/` is: its own folder, or, when an editor journey names a copy (`AF_E2E_CONTENT_ROOT`, which
 * the journey's dev server gets from `runGame`), that copy, so the page plays what the editor saved and the committed
 * files are never touched.
 */
export function contentRootOf(env: Record<string, string | undefined>): string {
  return env.AF_E2E_CONTENT_ROOT ?? fileURLToPath(new URL('.', import.meta.url))
}

/**
 * The room the code imports (`room.ts` reads the level file directly, for the sim) follows the copy as well; without a
 * copy there is nothing to change.
 */
export function roomAliasesOf(env: Record<string, string | undefined>): Alias[] {
  const copy = env.AF_E2E_CONTENT_ROOT
  if (copy === undefined) return []
  return [
    {
      find: /^.*\/content\/levels\/room\.af-sector\.json$/,
      replacement: join(copy, 'content/levels/room.af-sector.json'),
    },
  ]
}

/**
 * The content plugin over the game's `content/` (`virtual:automata/content`): the figures, poses and clips,
 * with the figures extension's kinds, and the room's swatches and props. The page and the tests (vitest.config.ts) both compile it.
 */
export function contentPlugin(): ReturnType<typeof automataContent> {
  return automataContent({
    root: contentRootOf(process.env),
    schemas: [...(figuresExtension.content ?? []), worldSwatchContent, worldPropContent],
    // The game's own words (G3-t): its catalog, compiled with Paraglide into src/paraglide (DESIGN.md §12.3).
    paraglide: { outdir: 'src/paraglide', catalogs: ['src/messages/ui/{locale}.json'] },
  })
}

export default defineConfig({
  // A Ruken build: the Ruken host adapter (DIST spec §5.3), in front of Vite's defaults, which `conditions` replaces.
  resolve: { conditions: ['automata-ruken', ...defaultClientConditions], alias: roomAliasesOf(process.env) },
  // The copy is outside the checkout; the dev server may read it.
  server: {
    fs: {
      allow: [
        '.',
        ...(process.env.AF_E2E_CONTENT_ROOT === undefined ? [] : [process.env.AF_E2E_CONTENT_ROOT]),
        '../..',
      ],
    },
  },
  // Svelte compiles the ui panels the runtime and the default screens show; the content plugin serves the content.
  plugins: [svelte(), contentPlugin()],
  // Relative URLs: inside Ruken the game is served from /b/<buildId>/ (ship prepare refuses root-absolute paths).
  base: './',
  build: { outDir: 'dist', emptyOutDir: true },
  preview: { headers: previewHeaders() },
})
