import { renameSync } from 'node:fs'
import { join } from 'node:path'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

// The editor is a static page (`index.html` and what it imports); the tests are configured in `vitest.config.ts`.
//
// `vite build --mode suite` builds the full suite page (`suite.html`: the editors of `@automata/editor` plus
// Levels 3D and the Studio) into `dist/suite/`, where `automata editor --app suite` serves it from. The page is written
// out as `index.html`, the name every served editor has.
//
// Both builds carry the private Pixi 3D beta and neither is published: `-tools` copies only the editor package's 2D build,
// and its build scans only that package's `2d` and `suite` builds (`packages/tools/scripts/copy-editor.ts`), not these.
export default defineConfig(({ mode }) =>
  mode === 'suite'
    ? {
        plugins: [
          svelte(),
          {
            // Renamed on disk once written: the bundler keeps an HTML page under its input's name whatever
            // `generateBundle` does to the bundle's keys, so the page would stay `suite.html`.
            name: 'suite-page-is-index',
            writeBundle(options) {
              const dir = options.dir ?? 'dist/suite'
              renameSync(join(dir, 'suite.html'), join(dir, 'index.html'))
            },
          },
        ],
        build: { outDir: 'dist/suite', emptyOutDir: true, rollupOptions: { input: 'suite.html' } },
      }
    : { plugins: [svelte()], build: { outDir: 'dist', emptyOutDir: true } },
)
