import { defaultClientConditions, defineConfig } from 'vite'

// An `itch`/`web` target build: `resolve.conditions` replaces Vite's defaults, so the condition
// goes in front of them.
export default defineConfig({
  root: import.meta.dirname,
  resolve: { conditions: ['automata-web', ...defaultClientConditions] },
  build: { outDir: 'dist', emptyOutDir: true, minify: false, target: 'es2022' },
})
