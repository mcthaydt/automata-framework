import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

// The package builds two static pages, each into its own folder, which `automata editor` serves: the 2D editor
// (`index.html`, into `dist/2d/`) and, with `--mode suite`, the 2D-only suite page (`suite.html`, into `dist/suite/`).
// A page is written out as `index.html`, the name every served editor has. Nothing else is set here: a client build
// already resolves modules under the `browser` condition, and a Node test project that read it would load the browser
// build of the code parser. The tests are configured in `vitest.config.ts`.
export default defineConfig(({ mode }) =>
  mode === 'suite'
    ? {
        plugins: [
          svelte(),
          {
            name: 'suite-page-is-index',
            generateBundle(_options, bundle) {
              const page = bundle['suite.html']
              if (page === undefined) return
              bundle['index.html'] = { ...page, fileName: 'index.html' }
              delete bundle['suite.html']
            },
          },
        ],
        build: { outDir: 'dist/suite', emptyOutDir: true, rollupOptions: { input: 'suite.html' } },
      }
    : { plugins: [svelte()], build: { outDir: 'dist/2d', emptyOutDir: true } },
)
