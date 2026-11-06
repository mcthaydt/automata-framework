import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

// The editor is a static page (`index.html` and what it imports); the tests are configured in `vitest.config.ts`.
//
// `vite build --mode suite` builds the full suite page (`suite.html`: the editors of `@mcthaydt/automata-editor` plus
// Levels 3D and the Studio) into `dist/suite/`, where `automata editor --app suite` serves it from. The page is written
// out as `index.html`, the name every served editor has. The Studio draws figures with the figures package, which takes
// a few things from the content package; that package's entry reaches Node built-ins, so the page loads the schema and
// palette through a shim (`src/suite-content-shim.ts`).
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
        resolve: {
          alias: [
            {
              find: /^@mcthaydt\/automata-content$/,
              replacement: new URL('./src/suite-content-shim.ts', import.meta.url).pathname,
            },
          ],
        },
        build: { outDir: 'dist/suite', emptyOutDir: true, rollupOptions: { input: 'suite.html' } },
      }
    : { plugins: [svelte()], build: { outDir: 'dist', emptyOutDir: true } },
)
