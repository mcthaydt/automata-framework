import { renameSync } from 'node:fs'
import { join } from 'node:path'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

// `vite build --mode suite` builds the suite page with the content editors (`suite.html`) into `dist/suite/`, written
// out as `index.html`, the name every served editor has (`automata editor --app-dir`). `vite` serves it to try.
export default defineConfig({
  plugins: [
    svelte(),
    {
      // Renamed on disk once written: the bundler keeps an HTML page under its input's name.
      name: 'suite-page-is-index',
      writeBundle(options) {
        const dir = options.dir ?? 'dist/suite'
        renameSync(join(dir, 'suite.html'), join(dir, 'index.html'))
      },
    },
  ],
  build: { outDir: 'dist/suite', emptyOutDir: true, rollupOptions: { input: 'suite.html' } },
})
