import { renameSync } from 'node:fs'
import { join } from 'node:path'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

// The package builds its own page (`suite.html`: the editors of `@automata/editor` plus Levels 3D and the Studio) into
// `dist/suite/`, for developing and testing the 3D editors on their own. The page a person gets, from `automata editor`
// and the site's "Try the editor", is the full suite built by `extensions/editors`. The page is written out as
// `index.html`, the name every served editor has, and names its files relative to itself.
//
// The build carries the Pixi 3D beta. `-tools` copies the full suite (`packages/tools/scripts/copy-editor.ts`), so
// `@automata/tools` must not be published until Pixi 3D is. The tests are configured in `vitest.config.ts`.
export default defineConfig({
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
  base: './',
  build: { outDir: 'dist/suite', emptyOutDir: true, rollupOptions: { input: 'suite.html' } },
})
