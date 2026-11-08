import { renameSync } from 'node:fs'
import { join } from 'node:path'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

// The package builds one page, the 2D suite (`suite.html`), into `dist/suite/`, which `automata editor` serves and the
// site's "Try the editor" copies. It is written out as `index.html`, the name every served editor has. Nothing else is set
// here: a client build already resolves modules under the `browser` condition, and a Node test project that read it would
// load the browser build of the code parser. The tests are configured in `vitest.config.ts`.
// The page names its files relative to itself (`base: './'`), so the one build runs at any address: at the root when
// `automata editor` serves it, and at /editor/app/ on the site.
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
