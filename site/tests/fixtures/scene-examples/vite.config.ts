import { examplesRunner } from '@automata/examples-runner'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

// The runner's build of the fixture folder, as examples/3d/vite.config.ts is of the real one: the site's e2e build
// (scripts/build-scene-fixture.ts) frames its pages. The one example that imports an unpublished package is built too,
// as the real folder's would be, with that package stood in for by an empty module: nothing here installs it.
export default defineConfig({
  plugins: [
    svelte(),
    examplesRunner({
      root: import.meta.dirname,
      target: process.env.AF_EXAMPLES_TARGET === 'web' ? 'web' : 'ruken',
    }),
  ],
  resolve: {
    alias: { '@automata/lcd-panel': new URL('../scene-stand-ins/lcd-panel.ts', import.meta.url).pathname },
  },
})
