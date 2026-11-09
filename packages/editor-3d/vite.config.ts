import { renameSync } from 'node:fs'
import { join } from 'node:path'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

// The package builds one page, the full suite (`suite.html`: the editors of `@automata/editor` plus Levels 3D and the
// Studio), into `dist/suite/`, where `automata editor` serves it from for a game whose editor list names a 3D editor. The
// page is written out as `index.html`, the name every served editor has, and names its files relative to itself.
//
// The build carries the private Pixi 3D beta and is not published: `-tools` copies only the editor package's 2D suite and
// scans only that (`packages/tools/scripts/copy-editor.ts`). The tests are configured in `vitest.config.ts`.
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
